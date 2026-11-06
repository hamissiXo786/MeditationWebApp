import ExpoModulesCore
import SmartSpectra
import UIKit

/// Shows the SDK's live preview frames (`SmartSpectraSDK.shared.imageOutput`, a `UIImage?`).
class SmartSpectraPreviewView: ExpoView {
  private let imageView = UIImageView()
  private var timer: Timer?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    imageView.contentMode = .scaleAspectFill
    addSubview(imageView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    imageView.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    timer?.invalidate()
    timer = nil
    guard window != nil else { return }
    timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 15.0, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated {
        guard let self else { return }
        if let frame = SmartSpectraSDK.shared.imageOutput, frame !== self.imageView.image {
          self.imageView.image = frame
        }
      }
    }
  }
}
