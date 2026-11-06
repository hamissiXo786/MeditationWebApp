import { EntrainmentPacer, type PacerEvent } from '../src/session/pacer';

/** Run the pacer for `seconds`, feeding a measured rate chosen by `measure(currentPacerBpm)`. */
function run(pacer: EntrainmentPacer, seconds: number, measure: (bpm: number) => number | null, t0 = 0) {
  const events: PacerEvent[] = [];
  for (let t = t0; t <= t0 + seconds * 1000; t += 100) {
    events.push(...pacer.update(t, measure(pacer.currentBpm)).events);
  }
  return events;
}

describe('EntrainmentPacer', () => {
  it('starts at the measured rate, clamped to a sensible range', () => {
    expect(new EntrainmentPacer({ targetBpm: 6, startBpm: 13.2 }, 0).currentBpm).toBe(13);
    expect(new EntrainmentPacer({ targetBpm: 6, startBpm: 30 }, 0).currentBpm).toBe(16);
    expect(new EntrainmentPacer({ targetBpm: 6, startBpm: 3 }, 0).currentBpm).toBe(6);
  });

  it('steps down toward the target when the user follows', () => {
    const pacer = new EntrainmentPacer({ targetBpm: 6, startBpm: 12 }, 0);
    const events = run(pacer, 240, (bpm) => bpm); // user matches the pacer exactly
    expect(pacer.currentBpm).toBeLessThan(12);
    expect(events.some((e) => e.type === 'stepped')).toBe(true);
    // never goes below target
    run(pacer, 600, (bpm) => bpm, 240_100);
    expect(pacer.currentBpm).toBe(6);
  });

  it('holds and then eases back when the user cannot follow', () => {
    const pacer = new EntrainmentPacer({ targetBpm: 6, startBpm: 12, struggleCycles: 3 }, 0);
    run(pacer, 30, (bpm) => bpm); // follow for a bit so it steps down once or twice
    const stepped = pacer.currentBpm;
    expect(stepped).toBeLessThan(12);
    const events = run(pacer, 60, () => 15, 30_100); // then breathe much faster than the guide
    expect(events.some((e) => e.type === 'struggling')).toBe(true);
    expect(events.some((e) => e.type === 'eased')).toBe(true);
    expect(pacer.currentBpm).toBeGreaterThan(stepped);
    expect(pacer.currentBpm).toBeLessThanOrEqual(12);
  });

  it('falls back to a slow time-based ladder with no measurement', () => {
    const pacer = new EntrainmentPacer({ targetBpm: 6, startBpm: 10 }, 0);
    run(pacer, 120, () => null);
    expect(pacer.currentBpm).toBeLessThan(10);
  });

  it('produces an inhale then exhale with a longer exhale', () => {
    const pacer = new EntrainmentPacer({ targetBpm: 6, startBpm: 6, inhaleRatio: 0.4 }, 0);
    // 6 bpm => 10 s breath: inhale 0-4 s, exhale 4-10 s
    expect(pacer.update(2000, null).frame.phase).toBe('inhale');
    expect(pacer.update(5000, null).frame.phase).toBe('exhale');
    const peak = pacer.update(3999, null).frame.level;
    expect(peak).toBeGreaterThan(0.99);
  });
});
