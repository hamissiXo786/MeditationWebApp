import { trusted } from '../vitals/quality';
import type { VitalsSnapshot, VitalsSourceKind } from '../vitals/types';
import { EntrainmentPacer, type PacerFrame } from './pacer';
import type { Aggregate, SessionDef, SessionResult, Step, TimelinePoint } from './types';

export type EngineEvent =
  | { type: 'stepStarted'; index: number; step: Step }
  | { type: 'cue'; text: string; adaptive: boolean }
  | { type: 'adapted'; note: string }
  | { type: 'finished'; result: SessionResult };

export type EngineView = {
  stepIndex: number;
  step: Step;
  stepElapsedSec: number;
  stepDurationSec: number;
  totalElapsedSec: number;
  remainingSec: number;
  pacer: PacerFrame | null;
  paused: boolean;
  finished: boolean;
  /** The camera hasn't had a usable view of the user for a while. */
  signalLost: boolean;
};

const MEASURE_WINDOW_SEC = 30;
const TIMELINE_EVERY_SEC = 5;
const MOTION_HOLD_MS = 3000;
const MOTION_COOLDOWN_MS = 60_000;
const SIGNAL_LOST_MS = 10_000;
const DEFAULT_PACER_START = 10;

type Sample = { at: number; hr: number | null; br: number | null; hrv: number | null };

/**
 * Runs a declarative session script against live vitals. Pure and clock-injected: give it `now`
 * and a vitals snapshot on every tick and it returns what should happen (cues to speak, step
 * changes, adaptations, the final result). The screen renders; the engine decides.
 */
export class SessionEngine {
  private index = 0;
  private stepElapsedMs = 0;
  private totalElapsedMs = 0;
  private duration: number;
  private lastTick = 0;
  private startedAt = 0;
  private paused = false;
  private pausedAt = 0;
  private finished = false;
  private nextCue = 0;
  private extensions = 0;
  private struggleCueGiven = false;

  private pacer: EntrainmentPacer | null = null;
  private pacerFrame: PacerFrame | null = null;
  private pacerStartBpm: number | null = null;
  private lastPacerBpm: number | null = null;

  private samples: Sample[] = [];
  private before: Aggregate = emptyAggregate();
  private after: Aggregate = emptyAggregate();
  private timeline: TimelinePoint[] = [];
  private nextTimelineSec = 0;
  private adaptations: string[] = [];
  private lastMotionCue = -Infinity;
  private signalLost = false;

  constructor(
    private def: SessionDef,
    private sourceKind: VitalsSourceKind,
    private makeId: () => string = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  ) {
    if (def.steps.length === 0) throw new Error('A session needs at least one step');
    this.duration = def.steps[0].durationSec * 1000;
  }

  start(now: number, vitals: VitalsSnapshot): EngineEvent[] {
    this.startedAt = now;
    this.lastTick = now;
    return this.enterStep(0, now, vitals);
  }

  pause(now: number) {
    if (this.paused || this.finished) return;
    this.advanceClock(now);
    this.paused = true;
    this.pausedAt = now;
  }

  resume(now: number) {
    if (!this.paused) return;
    this.paused = false;
    this.lastTick = now;
    this.pacer?.shift(now - this.pausedAt);
  }

  /** End early (the user tapped "End"). Produces a result marked incomplete. */
  end(now: number, vitals: VitalsSnapshot): EngineEvent[] {
    if (this.finished) return [];
    this.advanceClock(now);
    this.closeMeasurement(vitals, now);
    return [this.finish(now, false)];
  }

  tick(now: number, vitals: VitalsSnapshot): EngineEvent[] {
    if (this.finished || this.paused) return [];
    this.advanceClock(now);
    const events: EngineEvent[] = [];
    const step = this.step;

    this.record(now, vitals);
    this.updateSignal(now, vitals);

    // Scripted cues.
    const elapsedSec = this.stepElapsedMs / 1000;
    while (this.nextCue < step.cues.length && step.cues[this.nextCue].atSec <= elapsedSec) {
      events.push({ type: 'cue', text: step.cues[this.nextCue].text, adaptive: false });
      this.nextCue += 1;
    }

    // Movement during guided parts: one gentle reminder at most once a minute.
    const v = vitals.validation;
    if (
      step.kind === 'guided' &&
      v?.code === 'EXCESSIVE_MOTION' &&
      now - v.since >= MOTION_HOLD_MS &&
      now - this.lastMotionCue >= MOTION_COOLDOWN_MS
    ) {
      this.lastMotionCue = now;
      events.push({ type: 'cue', text: this.def.motionCue, adaptive: true });
      events.push(this.note('Gave a stillness reminder after movement'));
    }

    // Pacer.
    if (this.pacer) {
      const measured = trusted(vitals.breathingRate, now)?.value ?? null;
      const { frame, events: pacerEvents } = this.pacer.update(now, measured);
      this.pacerFrame = frame;
      this.lastPacerBpm = frame.bpm;
      for (const e of pacerEvents) {
        if (e.type === 'struggling' && !this.struggleCueGiven) {
          this.struggleCueGiven = true;
          events.push({ type: 'cue', text: this.def.struggleCue, adaptive: true });
        }
        if (e.type === 'eased') events.push(this.note(`Eased the pace back to ${e.bpm} breaths/min`));
        if (e.type === 'reachedTarget') events.push(this.note(`Reached ${e.bpm} breaths/min with you`));
      }
    }

    // Step end.
    if (this.stepElapsedMs >= this.duration) {
      const extend = step.adapt?.find((r) => r.kind === 'extendWhileBreathingAbove');
      const br = trusted(vitals.breathingRate, now)?.value;
      if (
        extend?.kind === 'extendWhileBreathingAbove' &&
        br != null &&
        br > extend.bpm &&
        this.extensions < extend.maxExtensions
      ) {
        this.extensions += 1;
        this.duration += extend.extendSec * 1000;
        events.push({ type: 'cue', text: extend.cue, adaptive: true });
        events.push(this.note(`Extended "${step.title}" by ${extend.extendSec} s (breathing ${br.toFixed(1)}/min)`));
      } else {
        this.closeMeasurement(vitals, now);
        if (this.index + 1 >= this.def.steps.length) {
          events.push(this.finish(now, true));
        } else {
          events.push(...this.enterStep(this.index + 1, now, vitals));
        }
      }
    }

    return events;
  }

  view(): EngineView {
    const step = this.step;
    const remainingSteps = this.def.steps.slice(this.index + 1).reduce((s, x) => s + x.durationSec, 0);
    return {
      stepIndex: this.index,
      step,
      stepElapsedSec: this.stepElapsedMs / 1000,
      stepDurationSec: this.duration / 1000,
      totalElapsedSec: this.totalElapsedMs / 1000,
      remainingSec: Math.max(0, (this.duration - this.stepElapsedMs) / 1000 + remainingSteps),
      pacer: this.pacer ? this.pacerFrame : null,
      paused: this.paused,
      finished: this.finished,
      signalLost: this.signalLost,
    };
  }

  private get step(): Step {
    return this.def.steps[this.index];
  }

  private advanceClock(now: number) {
    const dt = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    this.stepElapsedMs += dt;
    this.totalElapsedMs += dt;
  }

  private enterStep(index: number, now: number, vitals: VitalsSnapshot): EngineEvent[] {
    const events: EngineEvent[] = [];
    let i = index;
    // Skip steps the user doesn't need (e.g. a settling breath when they're already calm).
    while (i < this.def.steps.length) {
      const skip = this.def.steps[i].adapt?.find((r) => r.kind === 'skipIfBreathingBelow');
      const br = trusted(vitals.breathingRate, now)?.value;
      if (skip?.kind === 'skipIfBreathingBelow' && br != null && br < skip.bpm && i < this.def.steps.length - 1) {
        if (skip.cue) events.push({ type: 'cue', text: skip.cue, adaptive: true });
        events.push(this.note(`Skipped "${this.def.steps[i].title}" (already breathing ${br.toFixed(1)}/min)`));
        i += 1;
        continue;
      }
      break;
    }

    this.index = i;
    const step = this.def.steps[i];
    this.stepElapsedMs = 0;
    this.duration = step.durationSec * 1000;
    this.nextCue = 0;
    this.extensions = 0;
    this.struggleCueGiven = false;
    this.samples = [];

    if (step.pacer) {
      const measured = trusted(vitals.breathingRate, now)?.value;
      const startBpm = this.lastPacerBpm ?? measured ?? this.before.breathingRate ?? DEFAULT_PACER_START;
      this.pacer = new EntrainmentPacer(
        { targetBpm: step.pacer.targetBpm, startBpm, inhaleRatio: step.pacer.inhaleRatio },
        now,
      );
      this.pacerStartBpm ??= this.pacer.currentBpm;
      this.lastPacerBpm = this.pacer.currentBpm;
      this.pacerFrame = this.pacer.update(now, null).frame;
    } else {
      this.pacer = null;
      this.pacerFrame = null;
    }

    events.push({ type: 'stepStarted', index: i, step });
    // Cues scheduled at 0 s fire immediately.
    while (this.nextCue < step.cues.length && step.cues[this.nextCue].atSec <= 0) {
      events.push({ type: 'cue', text: step.cues[this.nextCue].text, adaptive: false });
      this.nextCue += 1;
    }
    return events;
  }

  private record(now: number, vitals: VitalsSnapshot) {
    const hr = trusted(vitals.pulseRate, now)?.value ?? null;
    const br = trusted(vitals.breathingRate, now)?.value ?? null;
    const hrv = trusted(vitals.hrv, now)?.rmssd ?? null;
    const kind = this.step.kind;
    if ((kind === 'checkIn' || kind === 'checkOut') && (hr != null || br != null || hrv != null)) {
      this.samples.push({ at: this.stepElapsedMs / 1000, hr, br, hrv });
    }
    const totalSec = this.totalElapsedMs / 1000;
    if (totalSec >= this.nextTimelineSec) {
      this.timeline.push({ t: Math.round(totalSec), hr, br });
      this.nextTimelineSec += TIMELINE_EVERY_SEC;
    }
  }

  private updateSignal(now: number, vitals: VitalsSnapshot) {
    const v = vitals.validation;
    this.signalLost =
      vitals.status === 'running' && !!v && v.code !== 'OK' && v.code !== 'EXCESSIVE_MOTION' && now - v.since > SIGNAL_LOST_MS;
  }

  /** Aggregate the last 30 s of a check-in / check-out step. */
  private closeMeasurement(vitals: VitalsSnapshot, now: number) {
    const kind = this.step.kind;
    if (kind !== 'checkIn' && kind !== 'checkOut') return;
    const endSec = this.stepElapsedMs / 1000;
    const windowed = this.samples.filter((s) => s.at >= endSec - MEASURE_WINDOW_SEC);
    const pool = windowed.length ? windowed : this.samples;
    const agg: Aggregate = {
      heartRate: median(pool.map((s) => s.hr)),
      breathingRate: median(pool.map((s) => s.br)),
      hrvRmssd: lastNonNull(pool.map((s) => s.hrv)) ?? trusted(vitals.hrv, now)?.rmssd ?? null,
    };
    if (kind === 'checkIn') this.before = agg;
    else this.after = agg;
  }

  private finish(now: number, completed: boolean): EngineEvent {
    this.finished = true;
    this.pacer = null;
    this.pacerFrame = null;
    const result: SessionResult = {
      id: this.makeId(),
      sessionId: this.def.id,
      title: this.def.title,
      startedAt: this.startedAt,
      endedAt: now,
      durationSec: Math.round(this.totalElapsedMs / 1000),
      completed,
      source: this.sourceKind,
      before: this.before,
      after: this.after,
      timeline: this.timeline,
      adaptations: this.adaptations,
      pacerStartBpm: this.pacerStartBpm,
      pacerEndBpm: this.lastPacerBpm,
    };
    return { type: 'finished', result };
  }

  private note(text: string): EngineEvent {
    this.adaptations.push(text);
    return { type: 'adapted', note: text };
  }
}

function emptyAggregate(): Aggregate {
  return { heartRate: null, breathingRate: null, hrvRmssd: null };
}

function median(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  const m = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return Math.round(m * 10) / 10;
}

function lastNonNull(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return values[i];
  return null;
}
