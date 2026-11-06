import Constants from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../storage/settings';
import { SimulatedVitalsSource } from './simulatedSource';
import { SmartSpectraVitalsSource } from './smartSpectraSource';
import { VitalsStore } from './store';
import type { VitalsSnapshot, VitalsSource, VitalsSourceKind } from './types';

type VitalsContextValue = {
  store: VitalsStore;
  source: VitalsSource;
  kind: VitalsSourceKind;
  /** Why live vitals are or aren't in use, for the settings screen. */
  liveStatus: 'live' | 'demo-mode' | 'no-native-module' | 'no-api-key' | 'web';
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const VitalsContext = createContext<VitalsContextValue | null>(null);

const apiKey: string = (Constants.expoConfig?.extra?.smartSpectraApiKey as string | undefined) ?? '';

function liveStatusFor(settings: Settings): VitalsContextValue['liveStatus'] {
  if (Platform.OS === 'web') return 'web';
  if (!SmartSpectraVitalsSource.isAvailable()) return 'no-native-module';
  if (!apiKey) return 'no-api-key';
  if (settings.demoMode) return 'demo-mode';
  return 'live';
}

export function VitalsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const store = useMemo(() => new VitalsStore(), []);
  const liveStatus = liveStatusFor(settings);

  const source = useMemo<VitalsSource>(
    () =>
      liveStatus === 'live'
        ? new SmartSpectraVitalsSource({ apiKey, enableTelemetry: settings.sdkTelemetry })
        : new SimulatedVitalsSource({ startBreathingRate: 12 + Math.random() * 3, seed: Date.now() % 1000 }),
    [liveStatus, settings.sdkTelemetry],
  );

  const running = useRef(false);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const unsubscribe = source.subscribe(store.apply);
    return () => {
      unsubscribe();
      if (running.current) {
        running.current = false;
        source.stop().catch(() => {});
      }
    };
  }, [source, store]);

  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    store.reset();
    try {
      await source.start();
    } catch (e) {
      running.current = false;
      store.apply({
        status: 'error',
        error: { code: 'START_FAILED', message: e instanceof Error ? e.message : String(e), retryable: true },
      });
    }
  }, [source, store]);

  const stop = useCallback(async () => {
    if (!running.current) return;
    running.current = false;
    source.setPacerHint?.(null);
    await source.stop().catch(() => {});
  }, [source]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ store, source, kind: source.kind, liveStatus, settings, updateSettings, start, stop }),
    [store, source, liveStatus, settings, updateSettings, start, stop],
  );

  return <VitalsContext.Provider value={value}>{children}</VitalsContext.Provider>;
}

export function useVitalsContext(): VitalsContextValue {
  const ctx = useContext(VitalsContext);
  if (!ctx) throw new Error('useVitalsContext must be used inside <VitalsProvider>');
  return ctx;
}

/** Latest vitals snapshot; re-renders at most 10x per second. */
export function useVitals(): VitalsSnapshot {
  const { store } = useVitalsContext();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
