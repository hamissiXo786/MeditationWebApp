export type PacerConfig = {
  /** Where we are guiding the user (breaths/min). ~6 is the population resonance rate. */
  targetBpm: number;
  /** Where the pacer starts. Normally the user's measured breathing rate at check-in. */
  startBpm: number;
  /** Size of each slowdown step. */
  stepBpm?: number;
  /** Measured rate within this many breaths/min of the pacer counts as "following". */
  tolerance?: number;
  /** Consecutive followed cycles before stepping down. */
  confirmCycles?: number;
  /** With no measurement (camera lost / no signal), step down after this many cycles anyway. */
  fallbackCyclesPerStep?: number;
  /** Cycles of not following before the pacer eases back up one step. */
  struggleCycles?: number;
  /** Fraction of each breath spent inhaling (0.4 = 4:6 inhale:exhale, a longer calming exhale). */
  inhaleRatio?: number;
};

export type PacerFrame = {
  phase: 'inhale' | 'exhale';
  /** Progress through the current phase, 0..1. */
  progress: number;
  /** Orb size 0..1 (eased). */
  level: number;
  bpm: number;
  cycle: number;
};

export type PacerEvent =
  | { type: 'stepped'; bpm: number }
  | { type: 'eased'; bpm: number }
  | { type: 'struggling'; bpm: number }
  | { type: 'reachedTarget'; bpm: number };

const MIN_START = 6;
const MAX_START = 16;

/**
 * Breath-following pacer ("entrainment ladder").
 *
 * Instead of imposing a fixed 6 breaths/min from the first second, it starts at the user's own
 * measured rate and slows down one small step at a time, only once their measured breathing has
 * caught up. If they can't follow for a while it eases back a step. With no measurement available
 * it degrades to a gentle time-based ladder.
 */
export class EntrainmentPacer {
  private cfg: Required<PacerConfig>;
  private bpm: number;
  private cycleStart: number;
  private cycle = 0;
  private followed = 0;
  private holding = 0;
  private unmeasured = 0;
  private reached = false;

  constructor(config: PacerConfig, startTime: number) {
    this.cfg = {
      stepBpm: 0.5,
      tolerance: 1,
      confirmCycles: 2,
      fallbackCyclesPerStep: 3,
      struggleCycles: 6,
      inhaleRatio: 0.4,
      ...config,
    };
    const start = clamp(config.startBpm, Math.max(MIN_START, config.targetBpm), MAX_START);
    this.bpm = roundHalf(start);
    this.cfg.startBpm = this.bpm;
    this.cycleStart = startTime;
    this.reached = this.bpm <= this.cfg.targetBpm;
  }

  get currentBpm() {
    return this.bpm;
  }

  /** Shift the schedule forward (after a pause) so no breaths are "missed". */
  shift(ms: number) {
    this.cycleStart += ms;
  }

  /**
   * Advance to `now`. `measuredBpm` is the latest trusted breathing rate, or null.
   * Returns the frame to render and any ladder events that happened at cycle boundaries.
   */
  update(now: number, measuredBpm: number | null): { frame: PacerFrame; events: PacerEvent[] } {
    const events: PacerEvent[] = [];
    let cycleMs = this.cycleMs();
    while (now >= this.cycleStart + cycleMs) {
      this.cycleStart += cycleMs;
      this.cycle += 1;
      const e = this.completeCycle(measuredBpm);
      if (e) events.push(...e);
      cycleMs = this.cycleMs();
    }
    return { frame: this.frameAt(now, cycleMs), events };
  }

  private cycleMs() {
    return (60 / this.bpm) * 1000;
  }

  private frameAt(now: number, cycleMs: number): PacerFrame {
    const pos = (now - this.cycleStart) / cycleMs; // 0..1 through this breath
    const r = this.cfg.inhaleRatio;
    if (pos < r) {
      const progress = pos / r;
      return { phase: 'inhale', progress, level: easeInOut(progress), bpm: this.bpm, cycle: this.cycle };
    }
    const progress = (pos - r) / (1 - r);
    return { phase: 'exhale', progress, level: 1 - easeInOut(progress), bpm: this.bpm, cycle: this.cycle };
  }

  private completeCycle(measured: number | null): PacerEvent[] | null {
    const { targetBpm, tolerance, confirmCycles, fallbackCyclesPerStep, struggleCycles, stepBpm } = this.cfg;
    if (this.bpm <= targetBpm) return null;

    if (measured == null) {
      this.unmeasured += 1;
      if (this.unmeasured >= fallbackCyclesPerStep) return this.stepDown();
      return null;
    }
    this.unmeasured = 0;

    if (measured <= this.bpm + tolerance) {
      this.holding = 0;
      this.followed += 1;
      if (this.followed >= confirmCycles) return this.stepDown();
      return null;
    }

    this.followed = 0;
    this.holding += 1;
    if (this.holding >= struggleCycles) {
      this.holding = 0;
      const eased = Math.min(this.cfg.startBpm, this.bpm + stepBpm);
      const events: PacerEvent[] = [{ type: 'struggling', bpm: this.bpm }];
      if (eased !== this.bpm) {
        this.bpm = eased;
        events.push({ type: 'eased', bpm: this.bpm });
      }
      return events;
    }
    return null;
  }

  private stepDown(): PacerEvent[] {
    this.followed = 0;
    this.unmeasured = 0;
    this.bpm = Math.max(this.cfg.targetBpm, roundHalf(this.bpm - this.cfg.stepBpm));
    const events: PacerEvent[] = [{ type: 'stepped', bpm: this.bpm }];
    if (!this.reached && this.bpm <= this.cfg.targetBpm) {
      this.reached = true;
      events.push({ type: 'reachedTarget', bpm: this.bpm });
    }
    return events;
  }
}

function easeInOut(p: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp(p, 0, 1));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function roundHalf(v: number) {
  return Math.round(v * 2) / 2;
}
