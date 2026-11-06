import { compare, headline } from '../src/session/summary';
import type { SessionResult } from '../src/session/types';
import { normaliseCode } from '../modules/smartspectra';
import { streakDays } from '../src/storage/history';

const base: SessionResult = {
  id: 'x',
  sessionId: 'arrive',
  title: 'Arrive',
  startedAt: 0,
  endedAt: 0,
  durationSec: 360,
  completed: true,
  source: 'simulated',
  before: { heartRate: 74, breathingRate: 13, hrvRmssd: 32 },
  after: { heartRate: 66, breathingRate: 6.4, hrvRmssd: 51 },
  timeline: [],
  adaptations: [],
  pacerStartBpm: 13,
  pacerEndBpm: 6,
};

describe('summary', () => {
  it('reports calming changes beyond measurement noise', () => {
    const c = compare(base);
    expect(c.find((x) => x.key === 'heartRate')).toMatchObject({ delta: -8, calmer: true });
    expect(c.find((x) => x.key === 'breathingRate')).toMatchObject({ delta: -6.6, calmer: true });
    expect(c.find((x) => x.key === 'hrvRmssd')).toMatchObject({ delta: 19, calmer: true });
    expect(headline(base)).toBe('Your breathing slowed from 13 to 6 breaths a minute. Your heart rate settled by 8 bpm.');
  });

  it('treats changes inside SDK accuracy as steady', () => {
    const r = { ...base, after: { heartRate: 72, breathingRate: 12.5, hrvRmssd: 34 } };
    expect(compare(r).every((c) => c.calmer === null)).toBe(true);
    expect(headline(r)).toMatch(/steady/);
  });

  it('handles missing data honestly', () => {
    const empty = { heartRate: null, breathingRate: null, hrvRmssd: null };
    expect(headline({ ...base, before: empty, after: empty })).toMatch(/couldn.t get a clear reading/);
  });
});

describe('normaliseCode', () => {
  it('maps iOS camelCase and Android names to the same code', () => {
    expect(normaliseCode('noFaceFound')).toBe('NO_FACE_FOUND');
    expect(normaliseCode('NO_FACE_FOUND')).toBe('NO_FACE_FOUND');
    expect(normaliseCode('ok')).toBe('OK');
    expect(normaliseCode('excessiveMotion')).toBe('EXCESSIVE_MOTION');
  });
});

describe('streakDays', () => {
  it('counts consecutive days ending today or yesterday', () => {
    const day = 86_400_000;
    const now = new Date(2026, 10, 6, 12).getTime();
    const mk = (ts: number) => ({ ...base, startedAt: ts });
    expect(streakDays([mk(now), mk(now - day), mk(now - 2 * day)], now)).toBe(3);
    expect(streakDays([mk(now - day), mk(now - 2 * day)], now)).toBe(2);
    expect(streakDays([mk(now - 3 * day)], now)).toBe(0);
  });
});
