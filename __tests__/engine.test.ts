import { ARRIVE } from '../src/content/sessions';
import { SessionEngine, type EngineEvent } from '../src/session/engine';
import type { SessionDef } from '../src/session/types';
import { SimulatedVitalsSource } from '../src/vitals/simulatedSource';
import { VitalsStore } from '../src/vitals/store';
import { EMPTY_SNAPSHOT, type VitalsSnapshot, type VitalsUpdate } from '../src/vitals/types';

jest.useFakeTimers();

const reading = (value: number, now: number) => ({ value, confidence: 90, stable: true, timestamp: now });

function snapshot(now: number, overrides: Partial<VitalsSnapshot> = {}): VitalsSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
    status: 'running',
    validation: { code: 'OK', hint: '', since: 0 },
    pulseRate: reading(72, now),
    breathingRate: reading(12, now),
    updatedAt: now,
    ...overrides,
  };
}

/** Tick the engine every 100 ms of simulated time; `vitalsAt` supplies the snapshot. */
function drive(engine: SessionEngine, fromMs: number, toMs: number, vitalsAt: (now: number) => VitalsSnapshot) {
  const events: EngineEvent[] = [];
  for (let t = fromMs; t <= toMs && !engine.view().finished; t += 100) events.push(...engine.tick(t, vitalsAt(t)));
  return events;
}

const tiny: SessionDef = {
  id: 'tiny',
  title: 'Tiny',
  subtitle: '',
  description: '',
  motionCue: 'be still',
  struggleCue: 'easy',
  steps: [
    { id: 'in', title: 'In', kind: 'checkIn', durationSec: 10, cues: [{ atSec: 0, text: 'hello' }] },
    {
      id: 'settle',
      title: 'Settle',
      kind: 'guided',
      durationSec: 10,
      adapt: [{ kind: 'skipIfBreathingBelow', bpm: 8, cue: 'already calm' }],
      cues: [],
    },
    {
      id: 'breathe',
      title: 'Breathe',
      kind: 'guided',
      durationSec: 20,
      pacer: { targetBpm: 6 },
      adapt: [{ kind: 'extendWhileBreathingAbove', bpm: 9, extendSec: 10, maxExtensions: 2, cue: 'a little longer' }],
      cues: [{ atSec: 5, text: 'follow the light' }],
    },
    { id: 'out', title: 'Out', kind: 'checkOut', durationSec: 10, cues: [] },
  ],
};

describe('SessionEngine', () => {
  it('runs steps in order, speaks cues, and reports before/after', () => {
    const engine = new SessionEngine(tiny, 'simulated', () => 'id1');
    const start = engine.start(0, snapshot(0));
    expect(start).toContainEqual({ type: 'cue', text: 'hello', adaptive: false });

    // Breathing slows over the session: 12 -> 8.5 (above skip threshold 8, below extend threshold 9)
    const events = drive(engine, 100, 120_000, (t) =>
      snapshot(t, { breathingRate: reading(t < 10_000 ? 12 : 8.5, t), pulseRate: reading(t < 10_000 ? 74 : 66, t) }),
    );
    const finished = events.find((e) => e.type === 'finished');
    expect(finished).toBeDefined();
    if (finished?.type !== 'finished') return;

    const { result } = finished;
    expect(result.completed).toBe(true);
    expect(result.before.breathingRate).toBe(12);
    expect(result.after.breathingRate).toBe(8.5);
    expect(result.before.heartRate).toBe(74);
    expect(result.after.heartRate).toBe(66);
    expect(result.pacerStartBpm).toBe(8.5);
    expect(events).toContainEqual({ type: 'cue', text: 'follow the light', adaptive: false });
    expect(result.timeline.length).toBeGreaterThan(5);
  });

  it('skips a settling step when the user is already calm', () => {
    const engine = new SessionEngine(tiny, 'simulated');
    engine.start(0, snapshot(0, { breathingRate: reading(7, 0) }));
    const events = drive(engine, 100, 10_500, (t) => snapshot(t, { breathingRate: reading(7, t) }));
    expect(events).toContainEqual({ type: 'cue', text: 'already calm', adaptive: true });
    expect(engine.view().step.id).toBe('breathe');
  });

  it('extends the breathing step while breathing is still fast, up to the limit', () => {
    const engine = new SessionEngine(tiny, 'simulated');
    engine.start(0, snapshot(0));
    const events = drive(engine, 100, 200_000, (t) => snapshot(t, { breathingRate: reading(12, t) }));
    const extensions = events.filter((e) => e.type === 'cue' && e.text === 'a little longer');
    expect(extensions).toHaveLength(2);
    const finished = events.find((e) => e.type === 'finished');
    expect(finished?.type === 'finished' && finished.result.durationSec).toBe(10 + 10 + 20 + 20 + 10);
  });

  it('gives at most one stillness reminder a minute for sustained movement', () => {
    const engine = new SessionEngine(tiny, 'simulated');
    engine.start(0, snapshot(0));
    const moving = { code: 'EXCESSIVE_MOTION', hint: '', since: 11_000 };
    const events = drive(engine, 100, 39_000, (t) =>
      snapshot(t, { validation: t > 11_000 ? moving : { code: 'OK', hint: '', since: 0 } }),
    );
    expect(events.filter((e) => e.type === 'cue' && e.text === 'be still')).toHaveLength(1);
  });

  it('ignores readings SmartSpectra has not marked stable', () => {
    const engine = new SessionEngine(tiny, 'simulated');
    const unstable = (t: number) => ({ value: 20, confidence: 10, stable: false, timestamp: t });
    engine.start(0, snapshot(0, { breathingRate: unstable(0), pulseRate: unstable(0) }));
    const events = drive(engine, 100, 200_000, (t) => snapshot(t, { breathingRate: unstable(t), pulseRate: unstable(t) }));
    const finished = events.find((e) => e.type === 'finished');
    expect(finished?.type === 'finished' && finished.result.before.breathingRate).toBeNull();
  });

  it('ending early produces an incomplete result', () => {
    const engine = new SessionEngine(tiny, 'simulated');
    engine.start(0, snapshot(0));
    drive(engine, 100, 5_000, (t) => snapshot(t));
    const [finished] = engine.end(5_100, snapshot(5_100));
    expect(finished.type === 'finished' && finished.result.completed).toBe(false);
  });

  it('restarts the simulated body fresh for each session (warm-up applies again)', async () => {
    const source = new SimulatedVitalsSource({ seed: 1 });
    const updates: VitalsUpdate[] = [];
    source.subscribe((u) => updates.push(u));
    await source.start();
    for (let t = 0; t < 40_000; t += 100) source.advance(100, t);
    expect(updates.some((u) => u.pulseRate)).toBe(true);
    await source.stop();

    updates.length = 0;
    await source.start();
    source.advance(100, 50_000);
    expect(updates.some((u) => u.pulseRate)).toBe(false);
    await source.stop();
  });

  it('runs the real "Arrive" session end to end against the simulated body', () => {
    let now = 0;
    const source = new SimulatedVitalsSource({ startBreathingRate: 13, seed: 3 });
    const store = new VitalsStore(() => now);
    source.subscribe(store.apply);

    // Warm up the camera for ~10 s on the setup screen, as in the app.
    store.apply({ status: 'running', validation: { code: 'OK', hint: '' } });
    for (; now < 10_000; now += 100) source.advance(100, now);

    const engine = new SessionEngine(ARRIVE, 'simulated');
    const events: EngineEvent[] = [...engine.start(now, store.getSnapshot())];
    for (; now < 20 * 60_000 && !engine.view().finished; now += 100) {
      source.setPacerHint(engine.view().pacer?.bpm ?? null);
      source.advance(100, now);
      events.push(...engine.tick(now, store.getSnapshot()));
    }
    const finished = events.find((e) => e.type === 'finished');
    expect(finished).toBeDefined();
    if (finished?.type !== 'finished') return;
    const { result } = finished;
    expect(result.before.breathingRate).toBeGreaterThan(11);
    expect(result.after.breathingRate).toBeLessThan(result.before.breathingRate!);
    expect(result.pacerEndBpm).toBeLessThan(result.pacerStartBpm!);
    expect(result.after.hrvRmssd).not.toBeNull();
  });
});
