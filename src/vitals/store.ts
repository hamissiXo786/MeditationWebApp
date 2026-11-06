import { EMPTY_SNAPSHOT, type TraceSample, type VitalsSnapshot, type VitalsUpdate } from './types';

const TRACE_WINDOW_MS = 20_000;
const NOTIFY_INTERVAL_MS = 100;

/**
 * Folds the deltas a source emits into a snapshot that keeps the last known value of each metric
 * (the SDK only sends samples that are new since its previous update).
 *
 * React reads `getSnapshot()` through `useSyncExternalStore` and re-renders at most 10x/second.
 * High-rate waveforms are kept in a ring buffer read directly by animations, not by React.
 */
export class VitalsStore {
  private snapshot: VitalsSnapshot = EMPTY_SNAPSHOT;
  private breath: TraceSample[] = [];
  private pulse: TraceSample[] = [];
  private listeners = new Set<() => void>();
  private pendingNotify: ReturnType<typeof setTimeout> | null = null;
  private lastNotify = 0;

  constructor(private now: () => number = Date.now) {}

  getSnapshot = (): VitalsSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get breathTrace(): readonly TraceSample[] {
    return this.breath;
  }

  get pulseTrace(): readonly TraceSample[] {
    return this.pulse;
  }

  reset() {
    this.snapshot = EMPTY_SNAPSHOT;
    this.breath = [];
    this.pulse = [];
    this.flush();
  }

  apply = (u: VitalsUpdate) => {
    const now = this.now();
    if (u.breathingTrace?.length) this.breath = appendWindow(this.breath, u.breathingTrace, now);
    if (u.pulseTrace?.length) this.pulse = appendWindow(this.pulse, u.pulseTrace, now);

    const prev = this.snapshot;
    const changed =
      u.pulseRate || u.breathingRate || u.hrv || u.validation || u.status || u.error ||
      (u.blinking !== undefined && u.blinking !== prev.blinking) ||
      (u.talking !== undefined && u.talking !== prev.talking);
    if (!changed) return;

    let validation = prev.validation;
    if (u.validation) {
      validation =
        prev.validation && prev.validation.code === u.validation.code
          ? { ...prev.validation, hint: u.validation.hint }
          : { ...u.validation, since: now };
    }

    this.snapshot = {
      pulseRate: u.pulseRate ?? prev.pulseRate,
      breathingRate: u.breathingRate ?? prev.breathingRate,
      hrv: u.hrv ?? prev.hrv,
      validation,
      status: u.status ?? prev.status,
      error: u.error ?? (u.status === 'running' ? null : prev.error),
      blinking: u.blinking ?? prev.blinking,
      talking: u.talking ?? prev.talking,
      updatedAt: now,
    };
    this.scheduleNotify(now);
  };

  private scheduleNotify(now: number) {
    if (now - this.lastNotify >= NOTIFY_INTERVAL_MS) {
      this.flush();
      return;
    }
    if (this.pendingNotify) return;
    this.pendingNotify = setTimeout(() => this.flush(), NOTIFY_INTERVAL_MS - (now - this.lastNotify));
  }

  private flush() {
    if (this.pendingNotify) clearTimeout(this.pendingNotify);
    this.pendingNotify = null;
    this.lastNotify = this.now();
    for (const l of this.listeners) l();
  }
}

function appendWindow(buf: TraceSample[], samples: TraceSample[], now: number): TraceSample[] {
  const cutoff = now - TRACE_WINDOW_MS;
  const next = buf.length && buf[0].t < cutoff ? buf.filter((s) => s.t >= cutoff) : buf.slice();
  for (const s of samples) next.push(s);
  return next;
}
