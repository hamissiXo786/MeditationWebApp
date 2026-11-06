package expo.modules.smartspectra

import android.content.Context
import androidx.camera.view.PreviewView
import com.presagetech.smartspectra.SmartSpectraSdk
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * CameraX preview bound to the SDK through `config.previewSurfaceProvider`. Mount it before
 * calling `start()` so the SDK binds the preview when the camera opens.
 */
class SmartSpectraPreviewView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val previewView = PreviewView(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
  }

  init {
    addView(previewView)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    SmartSpectraSdk.shared.config.previewSurfaceProvider = previewView.surfaceProvider
  }

  override fun onDetachedFromWindow() {
    if (SmartSpectraSdk.shared.config.previewSurfaceProvider === previewView.surfaceProvider) {
      SmartSpectraSdk.shared.config.previewSurfaceProvider = null
    }
    super.onDetachedFromWindow()
  }
}
