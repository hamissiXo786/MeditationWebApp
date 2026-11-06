import { PermissionsAndroid, Platform } from 'react-native';

import SmartSpectra, { normaliseCode, type NativeMetricsEvent } from '../../modules/smartspectra';
import type { VitalsSource, VitalsUpdate } from './types';

export type SmartSpectraSourceOptions = {
  apiKey: string;
  enableTelemetry: boolean;
};

/** Live vitals from the phone camera through the native SmartSpectra bridge. */
export class SmartSpectraVitalsSource implements VitalsSource {
  readonly kind = 'smartspectra' as const;

  private listeners = new Set<(u: VitalsUpdate) => void>();
  private nativeSubs: { remove(): void }[] = [];
  private configured = false;

  constructor(private options: SmartSpectraSourceOptions) {}

  static isAvailable(): boolean {
    return SmartSpectra != null;
  }

  async start(): Promise<void> {
    const native = SmartSpectra;
    if (!native) throw new Error('SmartSpectra native module is not available in this build');

    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        this.emit({
          status: 'error',
          error: { code: 'CAMERA_PERMISSION_DENIED', message: 'Camera permission is needed to measure vitals.', retryable: true },
        });
        return;
      }
    }

    if (!this.configured) {
      await native.configure({
        apiKey: this.options.apiKey,
        includeFace: true,
        enableTelemetry: this.options.enableTelemetry,
      });
      this.configured = true;
    }

    if (this.nativeSubs.length === 0) {
      this.nativeSubs = [
        native.addListener('onMetrics', (e) => this.emit(toUpdate(e))),
        native.addListener('onValidation', (e) =>
          this.emit({ validation: { code: normaliseCode(e.code), hint: e.hint } }),
        ),
        native.addListener('onStatus', (e) => this.emit({ status: e.status })),
        native.addListener('onError', (e) =>
          this.emit({ error: { code: normaliseCode(e.code), message: e.message, retryable: e.retryable } }),
        ),
      ];
    }

    await native.start();
  }

  async stop(): Promise<void> {
    await SmartSpectra?.stop();
    for (const s of this.nativeSubs) s.remove();
    this.nativeSubs = [];
  }

  subscribe(listener: (u: VitalsUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(update: VitalsUpdate) {
    for (const l of this.listeners) l(update);
  }
}

export function toUpdate(e: NativeMetricsEvent): VitalsUpdate {
  return {
    pulseRate: e.pulseRate,
    breathingRate: e.breathingRate,
    hrv: e.hrv,
    breathingTrace: e.breathingTrace?.map(([t, v]) => ({ t, v })),
    pulseTrace: e.pulseTrace?.map(([t, v]) => ({ t, v })),
    blinking: e.blinking,
    talking: e.talking,
  };
}
