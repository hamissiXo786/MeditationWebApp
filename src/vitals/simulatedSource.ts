import type { TraceSample, VitalsSource, VitalsUpdate } from './types';

export type SimulationOptions = {
  /** Breathing rate the simulated user starts at (breaths/min). */
  startBreathingRate?: number;
  /** Heart rate the simulated user starts at (bpm). */
  startHeartRate?: number;
  /** Resting heart rate the simulated user relaxes toward. */
  restingHeartRate?: number;
  /** Seconds (from start) at which a 4 s burst of movement happens. */
  motionAtSec?: number[];
  /** Seed for the deterministic noise generator. Random per session when omitted. */
  seed?: number;
};

const TICK_MS = 100;
const BREATH_FOLLOW_TAU_SEC = 20;
const HR_RELAX_TAU_SEC = 150;

/**
 * A believable stand-in for SmartSpectra so the app can be built, demoed and tested on the web,
 * simulators and CI, without a camera or API credits.
 *
 * It mirrors the real SDK's timing: pulse rate after ~12 s, breathing rate confident after ~30 s,
 * HRV after ~60 s, each reported as a rolling value with confidence/stable flags.
 */
export class SimulatedVitalsSource implements VitalsSource {
  readonly kind = 'simulated' as const;

  private listeners = new Set<(u: VitalsUpdate) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private opts: Required<SimulationOptions>;
  private options: SimulationOptions;

  private elapsedSec = 0;
  private breathingRate: number;
  private heartRate: number;
  private breathPhase = 0; // radians
  private pacerHint: number | null = null;
  private rng: () => number;
  private lastValidation = '';
  private lastReportSec = -1;

  constructor(options: SimulationOptions = {}) {
    this.options = options;
    this.opts = this.resolve(options.seed ?? 7);
    this.breathingRate = this.opts.startBreathingRate;
    this.heartRate = this.opts.startHeartRate;
    this.rng = mulberry32(this.opts.seed);
  }

  /** Fill in defaults. Unspecified starting values vary per session, like a real person. */
  private resolve(seed: number): Required<SimulationOptions> {
    const o = this.options;
    const vary = mulberry32(seed + 1);
    return {
      startBreathingRate: o.startBreathingRate ?? 12 + vary() * 3,
      startHeartRate: o.startHeartRate ?? 70 + vary() * 8,
      restingHeartRate: o.restingHeartRate ?? 62 + vary() * 4,
      motionAtSec: o.motionAtSec ?? [],
      seed,
    };
  }

  /** Start a fresh simulated session: warm-up timing and starting values reset. */
  private reset(seed: number) {
    this.opts = this.resolve(seed);
    this.elapsedSec = 0;
    this.breathingRate = this.opts.startBreathingRate;
    this.heartRate = this.opts.startHeartRate;
    this.breathPhase = 0;
    this.pacerHint = null;
    this.lastValidation = '';
    this.lastReportSec = -1;
    this.rng = mulberry32(seed);
  }

  async start(): Promise<void> {
    if (this.timer) return;
    this.reset(this.options.seed ?? Date.now() % 100_000);
    this.emit({ status: 'starting' });
    this.emit({ status: 'running', validation: { code: 'OK', hint: '' } });
    this.lastValidation = 'OK';
    this.timer = setInterval(() => this.advance(TICK_MS), TICK_MS);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit({ status: 'idle' });
  }

  subscribe(listener: (u: VitalsUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setPacerHint(breathsPerMinute: number | null): void {
    this.pacerHint = breathsPerMinute;
  }

  /** Advance the simulation deterministically (used by the interval and by tests). */
  advance(dtMs: number, now: number = Date.now()): void {
    const dt = dtMs / 1000;
    this.elapsedSec += dt;
    const t = this.elapsedSec;

    // Breathing follows the pacer with a first-order lag, otherwise drifts slowly down.
    const breathTarget = this.pacerHint ?? Math.max(9, this.opts.startBreathingRate - t / 60);
    this.breathingRate += (breathTarget - this.breathingRate) * (dt / BREATH_FOLLOW_TAU_SEC);

    // Heart rate relaxes toward resting; slower breathing helps a little.
    const hrTarget = this.opts.restingHeartRate + Math.max(0, this.breathingRate - 6) * 0.6;
    this.heartRate += (hrTarget - this.heartRate) * (dt / HR_RELAX_TAU_SEC);

    this.breathPhase += 2 * Math.PI * (this.breathingRate / 60) * dt;
    const breath = Math.sin(this.breathPhase);
    // Respiratory sinus arrhythmia: HR rises on inhale. Bigger near 6 breaths/min (resonance).
    const rsaAmplitude = 2 + 4 * Math.exp(-((this.breathingRate - 6) ** 2) / 4);
    const instantHr = this.heartRate + rsaAmplitude * breath;

    const update: VitalsUpdate = {};

    const moving = this.opts.motionAtSec.some((m) => t >= m && t < m + 4);
    const code = moving ? 'EXCESSIVE_MOTION' : 'OK';
    if (code !== this.lastValidation) {
      this.lastValidation = code;
      update.validation = { code, hint: moving ? 'Try to keep still' : '' };
    }

    const breathTrace: TraceSample[] = [{ t: now, v: breath + this.noise(0.05) }];
    update.breathingTrace = breathTrace;
    const beatPhase = (now / 1000) * (instantHr / 60) * 2 * Math.PI;
    update.pulseTrace = [{ t: now, v: Math.max(0, Math.sin(beatPhase)) ** 3 }];

    // Rolling readings at 1 Hz, gated by the SDK's warm-up windows.
    const wholeSec = Math.floor(t);
    if (wholeSec !== this.lastReportSec) {
      this.lastReportSec = wholeSec;
      const motionPenalty = moving ? 35 : 0;

      if (t >= 12) {
        const confidence = clamp(40 + (t - 12) * 2 - motionPenalty, 0, 95);
        update.pulseRate = {
          value: round1(this.heartRate + this.noise(0.8)),
          confidence,
          stable: confidence >= 40,
          timestamp: now,
        };
      }
      if (t >= 10) {
        const confidence = t < 30 ? 0 : clamp(50 + (t - 30) - motionPenalty, 0, 95);
        update.breathingRate = {
          value: round1(this.breathingRate + this.noise(0.3)),
          confidence,
          stable: confidence >= 45,
          timestamp: now,
        };
      }
      if (t >= 30) {
        const confidence = t < 60 ? 0 : clamp(60 + (t - 60) / 2 - motionPenalty, 0, 95);
        const rmssd = 32 + 22 * Math.exp(-((this.breathingRate - 6) ** 2) / 6) + this.noise(1.5);
        update.hrv = {
          rmssd: round1(rmssd),
          sdnn: round1(rmssd * 1.25),
          confidence,
          stable: confidence >= 50,
          timestamp: now,
        };
      }
    }

    this.emit(update);
  }

  private noise(scale: number): number {
    return (this.rng() * 2 - 1) * scale;
  }

  private emit(update: VitalsUpdate) {
    for (const l of this.listeners) l(update);
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
