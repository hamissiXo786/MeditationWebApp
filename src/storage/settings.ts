import AsyncStorage from '@react-native-async-storage/async-storage';

export type Settings = {
  /** Use simulated vitals even when the camera SDK is available. */
  demoMode: boolean;
  /** SmartSpectra's aggregate session telemetry (no video, no metric values). */
  sdkTelemetry: boolean;
  /** Spoken guidance on/off. */
  narration: boolean;
  /** Ambient sound on/off. */
  ambient: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  demoMode: false,
  sdkTelemetry: true,
  narration: true,
  ambient: true,
};

const KEY = 'settings:v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; failing to persist them must not break a session.
  }
}
