import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BreathOrb, type OrbSample } from '../../components/BreathOrb';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui';
import { VitalsChip } from '../../components/VitalsChip';
import { getSession } from '../../content/sessions';
import { BreathMirror } from '../../session/breathMirror';
import { SessionEngine, type EngineEvent, type EngineView } from '../../session/engine';
import type { SessionDef, SessionResult } from '../../session/types';
import { saveResult } from '../../storage/history';
import { colors, space, type } from '../../theme';
import { hintFor } from '../../vitals/quality';
import { useVitalsContext } from '../../vitals/VitalsProvider';

const UI_REFRESH_MS = 250;

function withGaze(def: SessionDef, gaze: string | undefined): SessionDef {
  if (gaze !== 'soft') return def;
  const [first, ...rest] = def.steps;
  const cue = { atSec: 6, text: 'Keep your eyes softly open, resting your gaze on the floor a little way ahead.' };
  return { ...def, steps: [{ ...first, cues: [...first.cues, cue].sort((a, b) => a.atSec - b.atSec) }, ...rest] };
}

export default function SessionScreen() {
  // On the web the browser may refuse a wake lock; that's fine, so don't warn when releasing it.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  const { id, gaze } = useLocalSearchParams<{ id: string; gaze?: string }>();
  const base = getSession(id ?? '');
  const def = useMemo(() => (base ? withGaze(base, gaze) : null), [base, gaze]);
  const { store, source, kind, stop, settings } = useVitalsContext();

  const ambient = useAudioPlayer(require('../../../assets/audio/ambient.wav'));
  const bell = useAudioPlayer(require('../../../assets/audio/bell.wav'));

  const engineRef = useRef<SessionEngine | null>(null);
  const [mirror] = useState(() => new BreathMirror());
  const done = useRef(false);
  const [view, setView] = useState<EngineView | null>(null);
  const [caption, setCaption] = useState('');
  const [showVitals, setShowVitals] = useState(false);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const complete = useCallback(
    async (result: SessionResult) => {
      done.current = true;
      Speech.stop();
      safe(() => ambient.pause());
      await saveResult(result).catch(() => {});
      await stop();
      router.replace({ pathname: '/summary', params: { id: result.id } });
    },
    [ambient, stop],
  );

  const handle = useCallback(
    (events: EngineEvent[]) => {
      for (const e of events) {
        if (e.type === 'cue') {
          setCaption(e.text);
          if (settingsRef.current.narration) Speech.speak(e.text, { rate: 0.85, pitch: 0.95 });
        } else if (e.type === 'stepStarted' && e.index > 0) {
          safe(() => {
            bell.seekTo(0);
            bell.volume = 0.6;
            bell.play();
          });
        } else if (e.type === 'finished') {
          complete(e.result);
        }
      }
    },
    [bell, complete],
  );

  useEffect(() => {
    if (!def) return;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const engine = new SessionEngine(def, kind);
    engineRef.current = engine;
    // Opening events are handled on the first animation frame rather than synchronously here.
    let pending: EngineEvent[] | null = engine.start(Date.now(), store.getSnapshot());
    if (settingsRef.current.ambient) {
      safe(() => {
        ambient.loop = true;
        ambient.volume = 0.3;
        ambient.play();
      });
    }

    let raf = 0;
    let lastUi = 0;
    const loop = () => {
      if (pending) {
        handle(pending);
        pending = null;
      }
      const now = Date.now();
      const events = engine.tick(now, store.getSnapshot());
      if (events.length) handle(events);
      const v = engine.view();
      source.setPacerHint?.(v.pacer?.bpm ?? null);
      if (now - lastUi >= UI_REFRESH_MS || v.finished) {
        lastUi = now;
        setView(v);
      }
      if (!v.finished) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      Speech.stop();
      if (!done.current) stop();
    };
    // The engine is created once per mounted session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sample = useCallback((): OrbSample => {
    const pacer = engineRef.current?.view().pacer;
    if (pacer) return { level: pacer.level, tone: pacer.phase };
    return mirror.sample(store.breathTrace, Date.now());
  }, [mirror, store]);

  if (!def) {
    return (
      <Screen>
        <Text style={type.body}>Session not found.</Text>
        <Button label="Home" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  const togglePause = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const now = Date.now();
    if (engine.view().paused) {
      engine.resume(now);
      if (settings.ambient) safe(() => ambient.play());
    } else {
      engine.pause(now);
      Speech.stop();
      safe(() => ambient.pause());
    }
    setView(engine.view());
  };

  const end = () => {
    const engine = engineRef.current;
    if (!engine) return;
    handle(engine.end(Date.now(), store.getSnapshot()));
  };

  const pacer = view?.pacer;
  const orbLabel = pacer ? (pacer.phase === 'inhale' ? 'In' : 'Out') : undefined;

  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.top}>
        <Text style={type.small} testID="step-title">
          {view?.step.title ?? def.steps[0].title}
        </Text>
        <Text style={[type.small, styles.time]}>{formatTime(view?.remainingSec ?? 0)} left</Text>
      </View>

      <View style={styles.center}>
        <BreathOrb sample={sample} label={orbLabel} />
        <Text style={[type.small, styles.mode]} testID="orb-mode">
          {pacer
            ? `Guiding at ${pacer.bpm} breaths/min`
            : kind === 'smartspectra'
              ? 'Mirroring your breath'
              : 'Mirroring your breath (simulated)'}
        </Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.caption} testID="caption">
          {caption}
        </Text>
        {view?.signalLost ? (
          <Text style={[type.small, styles.warn]}>Camera can’t see you clearly. {hintFor(store.getSnapshot().validation)}</Text>
        ) : null}
        {showVitals ? <VitalsChip /> : null}
        <View style={styles.controls}>
          <Pressable onPress={() => setShowVitals((s) => !s)} accessibilityRole="button">
            <Text style={styles.link}>{showVitals ? 'Hide vitals' : 'Show vitals'}</Text>
          </Pressable>
          <Pressable onPress={togglePause} accessibilityRole="button" testID="pause">
            <Text style={styles.link}>{view?.paused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
          <Pressable onPress={end} accessibilityRole="button" testID="end">
            <Text style={styles.link}>End</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function formatTime(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Audio is a nice-to-have; never let a player error break the session. */
function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // ignore
  }
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontVariant: ['tabular-nums'] },
  center: { alignItems: 'center', gap: space.md },
  mode: { color: colors.faint },
  bottom: { gap: space.md, minHeight: 170, justifyContent: 'flex-end' },
  caption: { ...type.body, textAlign: 'center', color: colors.text, minHeight: 70 },
  warn: { textAlign: 'center', color: colors.warn },
  controls: { flexDirection: 'row', justifyContent: 'space-around' },
  link: { color: colors.muted, fontSize: 15, padding: space.sm },
});
