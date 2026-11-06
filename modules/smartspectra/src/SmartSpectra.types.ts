import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Payloads sent from the native SmartSpectra bridge (iOS: Swift, Android: Kotlin).
 * The native side normalises the SDK's protobuf `Metrics` into this small JSON shape so the
 * JS layer never depends on SDK-specific field names.
 *
 * All timestamps are milliseconds since the Unix epoch (the SDK reports microseconds).
 */
export type NativeReading = {
  value: number;
  confidence: number; // 0-100
  stable: boolean;
  timestamp: number;
};

export type NativeHrv = {
  rmssd: number;
  sdnn: number;
  confidence: number;
  stable: boolean;
  timestamp: number;
};

/** [timestampMs, value] pairs, only the samples that arrived since the previous event. */
export type NativeTraceSample = [number, number];

export type NativeMetricsEvent = {
  pulseRate?: NativeReading;
  breathingRate?: NativeReading;
  hrv?: NativeHrv;
  breathingTrace: NativeTraceSample[];
  pulseTrace: NativeTraceSample[];
  blinking?: boolean;
  talking?: boolean;
};

/**
 * Validation codes. iOS reports camelCase enum names and Android SCREAMING_SNAKE names;
 * the JS wrapper normalises both to SCREAMING_SNAKE (e.g. `NO_FACE_FOUND`).
 */
export type NativeValidationEvent = {
  code: string;
  hint: string;
};

export type NativeStatusEvent = {
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
};

export type NativeErrorEvent = {
  code: string;
  message: string;
  retryable: boolean;
};

export type SmartSpectraModuleEvents = {
  onMetrics: (event: NativeMetricsEvent) => void;
  onValidation: (event: NativeValidationEvent) => void;
  onStatus: (event: NativeStatusEvent) => void;
  onError: (event: NativeErrorEvent) => void;
};

export type SmartSpectraConfigureOptions = {
  apiKey: string;
  /** Include face metrics (blinking/talking). Defaults to true. */
  includeFace?: boolean;
  /** SmartSpectra's aggregate session telemetry. Defaults to true in the SDK. */
  enableTelemetry?: boolean;
};

export type SmartSpectraCameraViewProps = {
  style?: StyleProp<ViewStyle>;
};
