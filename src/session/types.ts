import type { VitalsSourceKind } from '../vitals/types';

export type Cue = { atSec: number; text: string };

export type AdaptRule =
  /** At the end of the step, extend it while the user's breathing is still above `bpm`. */
  | { kind: 'extendWhileBreathingAbove'; bpm: number; extendSec: number; maxExtensions: number; cue: string }
  /** When the step starts, skip it if the user is already breathing below `bpm`. */
  | { kind: 'skipIfBreathingBelow'; bpm: number; cue?: string };

export type StepKind = 'checkIn' | 'guided' | 'checkOut';

export type Step = {
  id: string;
  title: string;
  kind: StepKind;
  durationSec: number;
  cues: Cue[];
  /** Show the breath-following pacer during this step. */
  pacer?: { targetBpm: number; inhaleRatio?: number };
  adapt?: AdaptRule[];
};

export type SessionDef = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  steps: Step[];
  /** Spoken when sustained movement is detected (at most once a minute). */
  motionCue: string;
  /** Spoken when the user can't follow the pacer for a while. */
  struggleCue: string;
};

export type Aggregate = {
  heartRate: number | null;
  breathingRate: number | null;
  hrvRmssd: number | null;
};

export type TimelinePoint = { t: number; hr: number | null; br: number | null };

export type SessionResult = {
  id: string;
  sessionId: string;
  title: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  completed: boolean;
  source: VitalsSourceKind;
  before: Aggregate;
  after: Aggregate;
  timeline: TimelinePoint[];
  /** Human-readable log of what the session adapted, e.g. "Extended breathing by 30 s". */
  adaptations: string[];
  pacerStartBpm: number | null;
  pacerEndBpm: number | null;
};
