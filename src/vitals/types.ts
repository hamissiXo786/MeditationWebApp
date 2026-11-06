export type Reading = {
  value: number;
  /** 0-100 as reported by SmartSpectra. */
  confidence: number;
  /** SmartSpectra's "stable" verdict (HR ±3 bpm, breathing ±1 /min, HRV ±5 ms). */
  stable: boolean;
  timestamp: number;
};

export type HrvReading = {
  rmssd: number;
  sdnn: number;
  confidence: number;
  stable: boolean;
  timestamp: number;
};

export type TraceSample = { t: number; v: number };

export type ValidationCode =
  | 'OK'
  | 'NO_FACE_FOUND'
  | 'MULTIPLE_FACES_FOUND'
  | 'FACE_NOT_CENTERED'
  | 'FACE_SIZE_OUT_OF_RANGE'
  | 'TOO_DARK'
  | 'TOO_BRIGHT'
  | 'CHEST_NOT_VISIBLE'
  | 'CAMERA_TUNING'
  | 'FRAME_RATE_TOO_LOW'
  | 'EXCESSIVE_MOTION'
  | 'FACE_TOO_CLOSE'
  | 'FACE_TOO_FAR'
  | 'FACE_TOO_HIGH'
  | 'FACE_TOO_LOW'
  | 'FACE_NOT_FORWARD'
  | (string & {});

export type Validation = { code: ValidationCode; hint: string; since: number };

export type SourceStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

export type VitalsError = { code: string; message: string; retryable: boolean };

/** Latest known values. Readings are kept until replaced (the SDK only sends deltas). */
export type VitalsSnapshot = {
  pulseRate: Reading | null;
  breathingRate: Reading | null;
  hrv: HrvReading | null;
  validation: Validation | null;
  status: SourceStatus;
  error: VitalsError | null;
  blinking: boolean;
  talking: boolean;
  updatedAt: number;
};

/** What a source pushes to listeners. */
export type VitalsUpdate = {
  pulseRate?: Reading;
  breathingRate?: Reading;
  hrv?: HrvReading;
  breathingTrace?: TraceSample[];
  pulseTrace?: TraceSample[];
  validation?: { code: ValidationCode; hint: string };
  status?: SourceStatus;
  error?: VitalsError;
  blinking?: boolean;
  talking?: boolean;
};

export type VitalsSourceKind = 'smartspectra' | 'simulated';

export interface VitalsSource {
  readonly kind: VitalsSourceKind;
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: (update: VitalsUpdate) => void): () => void;
  /**
   * Simulated source only: lets the simulated body "follow" the breathing pacer so the demo
   * behaves like a real user. The SmartSpectra source ignores it.
   */
  setPacerHint?(breathsPerMinute: number | null): void;
}

export const EMPTY_SNAPSHOT: VitalsSnapshot = {
  pulseRate: null,
  breathingRate: null,
  hrv: null,
  validation: null,
  status: 'idle',
  error: null,
  blinking: false,
  talking: false,
  updatedAt: 0,
};
