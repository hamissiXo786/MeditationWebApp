import type { OrbSample } from '../components/BreathOrb';
import type { TraceSample } from '../vitals/types';

const WINDOW_MS = 12_000;
const STALE_MS = 1_500;

/**
 * Turns the live breathing waveform (SmartSpectra `upperTrace`, arbitrary units) into an orb
 * level, so outside the paced section the orb shows the user's *own* breath.
 * Normalises over a rolling window and smooths; with no recent data it idles gently.
 */
export class BreathMirror {
  private level = 0.5;
  private prevRaw: number | null = null;
  private tone: OrbSample['tone'] = 'neutral';

  sample(trace: readonly TraceSample[], now: number): OrbSample {
    const last = trace[trace.length - 1];
    if (!last || now - last.t > STALE_MS) {
      // Idle: a slow, shallow drift so the orb never looks frozen.
      this.level += (0.5 + 0.08 * Math.sin((now / 10_000) * 2 * Math.PI) - this.level) * 0.05;
      return { level: this.level, tone: 'neutral' };
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = trace.length - 1; i >= 0 && now - trace[i].t <= WINDOW_MS; i--) {
      lo = Math.min(lo, trace[i].v);
      hi = Math.max(hi, trace[i].v);
    }
    const span = hi - lo;
    const raw = span > 1e-6 ? (last.v - lo) / span : 0.5;
    this.level += (raw - this.level) * 0.15;
    if (this.prevRaw != null && Math.abs(raw - this.prevRaw) > 0.01) {
      this.tone = raw > this.prevRaw ? 'inhale' : 'exhale';
    }
    this.prevRaw = raw;
    return { level: this.level, tone: this.tone };
  }
}
