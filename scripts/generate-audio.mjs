// Synthesises the app's two sounds so no third-party audio is needed:
//   assets/audio/ambient.wav - a soft, seamlessly looping drone (16 s)
//   assets/audio/bell.wav    - a gentle singing-bowl style chime for step changes
// Run: node scripts/generate-audio.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');
mkdirSync(outDir, { recursive: true });

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Ambient: every frequency completes a whole number of cycles in LOOP seconds, so the loop is seamless.
const LOOP = 16;
const n = RATE * LOOP;
const cyc = (hz) => Math.round(hz * LOOP) / LOOP;
const voices = [
  { hz: cyc(55), amp: 0.22 },
  { hz: cyc(110), amp: 0.16 },
  { hz: cyc(164.81), amp: 0.09 },
  { hz: cyc(220.5), amp: 0.05 },
  { hz: cyc(329.6), amp: 0.025 },
];
const ambient = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const t = i / RATE;
  const swell = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / LOOP); // one slow swell per loop
  const shimmer = 0.5 + 0.5 * Math.sin((2 * Math.PI * 2 * t) / LOOP + 1);
  let s = 0;
  voices.forEach((v, k) => {
    const mod = k >= 3 ? shimmer : 1;
    s += v.amp * mod * Math.sin(2 * Math.PI * v.hz * t + k);
  });
  ambient[i] = s * swell * 0.8;
}
writeFileSync(join(outDir, 'ambient.wav'), wav(ambient));

// Bell: inharmonic partials with exponential decay.
const BELL = 4;
const bell = new Float32Array(RATE * BELL);
const partials = [
  { ratio: 1, amp: 0.5, decay: 1.6 },
  { ratio: 2.0, amp: 0.22, decay: 1.1 },
  { ratio: 2.76, amp: 0.16, decay: 0.8 },
  { ratio: 5.4, amp: 0.07, decay: 0.45 },
];
const base = 392;
for (let i = 0; i < bell.length; i++) {
  const t = i / RATE;
  const attack = Math.min(1, t / 0.01);
  let s = 0;
  for (const p of partials) {
    s += p.amp * Math.exp(-t / p.decay) * Math.sin(2 * Math.PI * base * p.ratio * t + 1.2 * Math.sin(2 * Math.PI * 3 * t));
  }
  bell[i] = s * attack * 0.7;
}
writeFileSync(join(outDir, 'bell.wav'), wav(bell));

console.log('Wrote', join(outDir, 'ambient.wav'), 'and', join(outDir, 'bell.wav'));
