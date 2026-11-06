import type { Aggregate, SessionResult } from './types';

export type MetricChange = {
  key: keyof Aggregate;
  label: string;
  unit: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  /** Whether the direction of change is the calming one. null when unknown. */
  calmer: boolean | null;
};

const METRICS: { key: keyof Aggregate; label: string; unit: string; calmerWhen: 'lower' | 'higher' }[] = [
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm', calmerWhen: 'lower' },
  { key: 'breathingRate', label: 'Breathing', unit: '/min', calmerWhen: 'lower' },
  { key: 'hrvRmssd', label: 'HRV (RMSSD)', unit: 'ms', calmerWhen: 'higher' },
];

/** Thresholds under which a change is reported as "steady" (inside SmartSpectra's stated accuracy). */
const NOISE: Record<keyof Aggregate, number> = { heartRate: 3, breathingRate: 1, hrvRmssd: 5 };

export function compare(result: Pick<SessionResult, 'before' | 'after'>): MetricChange[] {
  return METRICS.map(({ key, label, unit, calmerWhen }) => {
    const before = result.before[key];
    const after = result.after[key];
    const delta = before != null && after != null ? Math.round((after - before) * 10) / 10 : null;
    let calmer: boolean | null = null;
    if (delta != null && Math.abs(delta) >= NOISE[key]) {
      calmer = calmerWhen === 'lower' ? delta < 0 : delta > 0;
    }
    return { key, label, unit, before, after, delta, calmer };
  });
}

/** One or two plain-language sentences about the session. Never a medical claim. */
export function headline(result: SessionResult): string {
  const changes = compare(result);
  const br = changes.find((c) => c.key === 'breathingRate')!;
  const hr = changes.find((c) => c.key === 'heartRate')!;
  const parts: string[] = [];

  if (br.before != null && br.after != null && br.calmer) {
    parts.push(`Your breathing slowed from ${fmt(br.before)} to ${fmt(br.after)} breaths a minute.`);
  }
  if (hr.delta != null && hr.calmer) {
    parts.push(`Your heart rate settled by ${fmt(Math.abs(hr.delta))} bpm.`);
  }
  if (parts.length) return parts.join(' ');

  const hasData = changes.some((c) => c.before != null || c.after != null);
  if (!hasData) {
    return 'We couldn’t get a clear reading this time. The practice still counts.';
  }
  return 'Your body stayed steady through the session. Consistency is what builds calm over time.';
}

export function fmt(v: number | null, digits = 0): string {
  if (v == null) return '–';
  return v.toFixed(digits);
}
