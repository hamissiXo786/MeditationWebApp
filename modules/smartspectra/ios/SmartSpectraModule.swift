import ExpoModulesCore
import SmartSpectra

struct ConfigureOptions: Record {
  @Field var apiKey: String = ""
  @Field var includeFace: Bool = true
  @Field var enableTelemetry: Bool = true
}

/// Expo module wrapping `SmartSpectraSDK.shared` (SmartSpectra Swift SDK 3.4.0).
///
/// The SDK is main-actor isolated and exposes its state as properties (`metrics`,
/// `validationStatus`, `processingStatus`, `error`, `imageOutput`). `MetricsPump` reads them on the
/// main actor, sends only data that is new since the last event, and forwards it to JavaScript.
public class SmartSpectraModule: Module {
  private var pump: MetricsPump?

  public func definition() -> ModuleDefinition {
    Name("SmartSpectra")

    Events("onMetrics", "onValidation", "onStatus", "onError")

    AsyncFunction("configure") { (options: ConfigureOptions) in
      MainActor.assumeIsolated {
        let sdk = SmartSpectraSDK.shared
        sdk.config.apiKey = options.apiKey
        var metrics = SmartSpectraConfig.breathingMetrics + SmartSpectraConfig.cardioMetrics
        if options.includeFace {
          metrics += SmartSpectraConfig.faceMetrics
        }
        sdk.config.requestedMetrics = metrics
        sdk.config.enableTelemetry = options.enableTelemetry
        sdk.config.imageOutputEnabled = true
        try? sdk.useCamera(.front)
      }
    }.runOnQueue(.main)

    AsyncFunction("start") { (promise: Promise) in
      Task { @MainActor in
        do {
          self.ensurePump().begin()
          try await SmartSpectraSDK.shared.start()
          promise.resolve(nil)
        } catch {
          promise.reject("ERR_SMARTSPECTRA_START", String(describing: error))
        }
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      Task { @MainActor in
        do {
          try await SmartSpectraSDK.shared.stop()
          self.pump?.end()
          promise.resolve(nil)
        } catch {
          promise.reject("ERR_SMARTSPECTRA_STOP", String(describing: error))
        }
      }
    }

    AsyncFunction("reset") { (promise: Promise) in
      Task { @MainActor in
        do {
          try await SmartSpectraSDK.shared.reset()
          self.pump?.resetCursors()
          promise.resolve(nil)
        } catch {
          promise.reject("ERR_SMARTSPECTRA_RESET", String(describing: error))
        }
      }
    }

    OnDestroy {
      Task { @MainActor in
        self.pump?.end()
        try? await SmartSpectraSDK.shared.stop()
      }
    }

    View(SmartSpectraPreviewView.self) {}
  }

  @MainActor
  private func ensurePump() -> MetricsPump {
    if let pump { return pump }
    let created = MetricsPump { [weak self] name, body in
      self?.sendEvent(name, body)
    }
    pump = created
    return created
  }
}

/// Reads SDK state on the main actor and emits deltas.
///
/// Two triggers keep this robust to how the SDK publishes changes: Observation tracking (fires
/// immediately if the SDK type is `@Observable`) and a 10 Hz timer as a fallback. Timestamp
/// cursors make both paths idempotent, so a sample is never sent twice.
@MainActor
final class MetricsPump {
  private let emit: (String, [String: Any]) -> Void
  private var timer: Timer?
  private var active = false

  private var lastBreathTraceTs: Int64 = 0
  private var lastPulseTraceTs: Int64 = 0
  private var lastPulseRateTs: Int64 = 0
  private var lastBreathingRateTs: Int64 = 0
  private var lastHrvTs: Int64 = 0
  private var lastStatus = ""
  private var lastValidation = ""
  private var lastError = ""

  init(emit: @escaping (String, [String: Any]) -> Void) {
    self.emit = emit
  }

  func begin() {
    guard !active else { return }
    active = true
    resetCursors()
    timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.poll() }
    }
    observe()
  }

  func end() {
    active = false
    timer?.invalidate()
    timer = nil
    poll()
  }

  func resetCursors() {
    lastBreathTraceTs = 0
    lastPulseTraceTs = 0
    lastPulseRateTs = 0
    lastBreathingRateTs = 0
    lastHrvTs = 0
    lastValidation = ""
    lastError = ""
  }

  private func observe() {
    guard active else { return }
    withObservationTracking {
      _ = SmartSpectraSDK.shared.metrics
      _ = SmartSpectraSDK.shared.validationStatus
    } onChange: { [weak self] in
      Task { @MainActor in
        self?.poll()
        self?.observe()
      }
    }
  }

  private static func name<T>(_ value: T) -> String {
    String(describing: value).trimmingCharacters(in: CharacterSet(charactersIn: "."))
  }

  private static func ms(_ microseconds: Int64) -> Double {
    Double(microseconds) / 1000.0
  }

  func poll() {
    let sdk = SmartSpectraSDK.shared

    let status = Self.name(sdk.processingStatus)
    if status != lastStatus {
      lastStatus = status
      emit("onStatus", ["status": status])
    }

    if let validation = sdk.validationStatus {
      let code = Self.name(validation.code)
      let key = "\(code)|\(validation.hint)"
      if key != lastValidation {
        lastValidation = key
        emit("onValidation", ["code": code, "hint": validation.hint])
      }
    }

    if let error = sdk.error {
      let code = Self.name(error.code)
      let key = "\(code)|\(error.message)"
      if key != lastError {
        lastError = key
        emit("onError", ["code": code, "message": error.message, "retryable": error.retryable])
      }
    }

    guard let metrics = sdk.metrics else { return }
    var payload: [String: Any] = [:]
    var hasNews = false

    if let r = metrics.cardio.pulseRate.last, r.timestamp > lastPulseRateTs {
      lastPulseRateTs = r.timestamp
      payload["pulseRate"] = [
        "value": Double(r.value), "confidence": Double(r.confidence),
        "stable": r.stable, "timestamp": Self.ms(r.timestamp),
      ]
      hasNews = true
    }

    if let r = metrics.breathing.rate.last, r.timestamp > lastBreathingRateTs {
      lastBreathingRateTs = r.timestamp
      payload["breathingRate"] = [
        "value": Double(r.value), "confidence": Double(r.confidence),
        "stable": r.stable, "timestamp": Self.ms(r.timestamp),
      ]
      hasNews = true
    }

    if let h = metrics.cardio.hrv.last, h.timestamp > lastHrvTs {
      lastHrvTs = h.timestamp
      payload["hrv"] = [
        "rmssd": h.rmssd, "sdnn": h.sdnn, "confidence": Double(h.confidence),
        "stable": h.stable, "timestamp": Self.ms(h.timestamp),
      ]
      hasNews = true
    }

    let breath = metrics.breathing.upperTrace.filter { $0.timestamp > lastBreathTraceTs }
    if let last = breath.last { lastBreathTraceTs = last.timestamp }
    payload["breathingTrace"] = breath.map { [Self.ms($0.timestamp), Double($0.value)] }

    let pulse = metrics.cardio.arterialPressureTrace.filter { $0.timestamp > lastPulseTraceTs }
    if let last = pulse.last { lastPulseTraceTs = last.timestamp }
    payload["pulseTrace"] = pulse.map { [Self.ms($0.timestamp), Double($0.value)] }

    if !breath.isEmpty || !pulse.isEmpty { hasNews = true }

    if let blink = metrics.face.blinking.last { payload["blinking"] = blink.detected }
    if let talk = metrics.face.talking.last { payload["talking"] = talk.detected }

    if hasNews {
      emit("onMetrics", payload)
    }
  }
}
