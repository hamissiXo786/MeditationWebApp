package expo.modules.smartspectra

import androidx.lifecycle.Observer
import com.presagetech.smartspectra.CameraSelection
import com.presagetech.smartspectra.ProcessingStatus
import com.presagetech.smartspectra.SmartSpectraConfig
import com.presagetech.smartspectra.SmartSpectraError
import com.presagetech.smartspectra.SmartSpectraSdk
import com.presagetech.smartspectra.ValidationStatus
import com.presagetech.smartspectra.proto.MetricsProto.Metrics
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ConfigureOptions : Record {
  @Field val apiKey: String = ""
  @Field val includeFace: Boolean = true
  @Field val enableTelemetry: Boolean = true
}

/**
 * Expo module wrapping `SmartSpectraSdk.shared` (SmartSpectra Android SDK 3.4.0).
 *
 * Metrics come from the lossless `metricsFlow`; status, validation and errors from LiveData
 * observed on the main thread. Each event carries only the samples that are new since the last one.
 */
class SmartSpectraModule : Module() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  private var metricsJob: Job? = null

  private var lastBreathTraceTs = 0L
  private var lastPulseTraceTs = 0L
  private var lastPulseRateTs = 0L
  private var lastBreathingRateTs = 0L
  private var lastHrvTs = 0L

  private val statusObserver = Observer<ProcessingStatus> { status ->
    sendEvent("onStatus", mapOf("status" to status.name.lowercase()))
  }
  private val validationObserver = Observer<ValidationStatus?> { validation ->
    if (validation != null) {
      sendEvent("onValidation", mapOf("code" to validation.code.name, "hint" to validation.hint))
    }
  }
  private val errorObserver = Observer<SmartSpectraError?> { error ->
    if (error != null) {
      sendEvent(
        "onError",
        mapOf("code" to error.code.name, "message" to error.message, "retryable" to error.retryable),
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SmartSpectra")

    Events("onMetrics", "onValidation", "onStatus", "onError")

    AsyncFunction("configure") { options: ConfigureOptions ->
      val sdk = SmartSpectraSdk.shared
      sdk.config.apiKey = options.apiKey
      var metrics = SmartSpectraConfig.breathingMetrics + SmartSpectraConfig.cardioMetrics
      if (options.includeFace) {
        metrics = metrics + SmartSpectraConfig.faceMetrics
      }
      sdk.config.requestedMetrics = metrics
      sdk.config.enableTelemetry = options.enableTelemetry
      // The preview uses CameraX PreviewView (SmartSpectraPreviewView), so bitmap frames aren't needed.
      sdk.config.imageOutputEnabled = false
      sdk.useCamera(CameraSelection.Front)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("start") Coroutine { ->
      withContext(Dispatchers.Main) { beginObserving() }
      SmartSpectraSdk.shared.start()
    }

    AsyncFunction("stop") Coroutine { ->
      SmartSpectraSdk.shared.stop()
      withContext(Dispatchers.Main) { endObserving() }
    }

    AsyncFunction("reset") Coroutine { ->
      SmartSpectraSdk.shared.reset()
      resetCursors()
    }

    OnDestroy {
      endObserving()
      scope.cancel()
    }

    View(SmartSpectraPreviewView::class) {}
  }

  private fun beginObserving() {
    if (metricsJob != null) return
    resetCursors()
    val sdk = SmartSpectraSdk.shared
    sdk.processingStatus.observeForever(statusObserver)
    sdk.validationStatus.observeForever(validationObserver)
    sdk.error.observeForever(errorObserver)
    metricsJob = scope.launch {
      sdk.metricsFlow.collect { metrics -> emitMetrics(metrics) }
    }
  }

  private fun endObserving() {
    val sdk = SmartSpectraSdk.shared
    sdk.processingStatus.removeObserver(statusObserver)
    sdk.validationStatus.removeObserver(validationObserver)
    sdk.error.removeObserver(errorObserver)
    metricsJob?.cancel()
    metricsJob = null
  }

  private fun resetCursors() {
    lastBreathTraceTs = 0L
    lastPulseTraceTs = 0L
    lastPulseRateTs = 0L
    lastBreathingRateTs = 0L
    lastHrvTs = 0L
  }

  private fun ms(microseconds: Long): Double = microseconds / 1000.0

  private fun emitMetrics(m: Metrics) {
    val payload = mutableMapOf<String, Any>()
    var hasNews = false

    if (m.hasCardio()) {
      m.cardio.pulseRateList.lastOrNull()?.let { r ->
        if (r.timestamp > lastPulseRateTs) {
          lastPulseRateTs = r.timestamp
          payload["pulseRate"] = mapOf(
            "value" to r.value.toDouble(), "confidence" to r.confidence.toDouble(),
            "stable" to r.stable, "timestamp" to ms(r.timestamp),
          )
          hasNews = true
        }
      }
      m.cardio.hrvList.lastOrNull()?.let { h ->
        if (h.timestamp > lastHrvTs) {
          lastHrvTs = h.timestamp
          payload["hrv"] = mapOf(
            "rmssd" to h.rmssd, "sdnn" to h.sdnn, "confidence" to h.confidence.toDouble(),
            "stable" to h.stable, "timestamp" to ms(h.timestamp),
          )
          hasNews = true
        }
      }
      val pulse = m.cardio.arterialPressureTraceList.filter { it.timestamp > lastPulseTraceTs }
      pulse.lastOrNull()?.let { lastPulseTraceTs = it.timestamp }
      payload["pulseTrace"] = pulse.map { listOf(ms(it.timestamp), it.value.toDouble()) }
      if (pulse.isNotEmpty()) hasNews = true
    } else {
      payload["pulseTrace"] = emptyList<Any>()
    }

    if (m.hasBreathing()) {
      m.breathing.rateList.lastOrNull()?.let { r ->
        if (r.timestamp > lastBreathingRateTs) {
          lastBreathingRateTs = r.timestamp
          payload["breathingRate"] = mapOf(
            "value" to r.value.toDouble(), "confidence" to r.confidence.toDouble(),
            "stable" to r.stable, "timestamp" to ms(r.timestamp),
          )
          hasNews = true
        }
      }
      val breath = m.breathing.upperTraceList.filter { it.timestamp > lastBreathTraceTs }
      breath.lastOrNull()?.let { lastBreathTraceTs = it.timestamp }
      payload["breathingTrace"] = breath.map { listOf(ms(it.timestamp), it.value.toDouble()) }
      if (breath.isNotEmpty()) hasNews = true
    } else {
      payload["breathingTrace"] = emptyList<Any>()
    }

    if (m.hasFace()) {
      m.face.blinkingList.lastOrNull()?.let { payload["blinking"] = it.detected }
      m.face.talkingList.lastOrNull()?.let { payload["talking"] = it.detected }
    }

    if (hasNews) sendEvent("onMetrics", payload)
  }
}
