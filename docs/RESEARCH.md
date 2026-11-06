# Research: a biofeedback guided-meditation app on SmartSpectra

*November 2026. Covers SmartSpectra SDK v3.4.0.*

## 1. Summary

- Mainstream meditation apps (Headspace, Calm) can't tell anything about the person using them. They play the same audio whether you are calm or racing.
- Biofeedback apps (HeartMath Inner Balance, HRVibe, Respirix, shii·haa) do respond to the user's body, but they need a chest strap, ear clip or watch.
- **SmartSpectra removes the hardware.** The phone's front camera, already pointed at the user, measures heart rate, breathing rate, HRV and a live breathing waveform.
- That makes three things possible that neither category offers together:
  1. A breathing guide that **follows the user**, not a fixed metronome.
  2. Sessions whose script **adapts to the body** in real time.
  3. A **before/after reading** that shows the session worked.
- The main constraints:
  - There is **no browser SDK**, so live vitals need the native app.
  - Readings take a **30–60 s warm-up**.
  - The phone has to be **propped up**, with the user **still and quiet**.
  - Readings are for **general wellness only**.

## 2. How guided meditation apps usually work

| Aspect | Typical pattern |
|---|---|
| **Content** | A library of single sessions plus multi-day courses. Headspace "Basics" runs 30 days and "Managing Anxiety" 10 days. Calm has 500+ sessions of 2–30 min, including a new 10-minute "Daily Calm" each day. Both offer selectable lengths (3/5/10 min) and an unguided timer for experienced users. |
| **Session arc** | Settle / arrive → anchor on the breath → core technique (body scan, noting, loving-kindness, visualisation) → return / close. |
| **Media** | Narration over an ambient bed. Minimal visuals: often a shape that expands and contracts for breathing. |
| **Habit loop** | Streaks, total minutes, reminders, buddy features, mood check-ins before and after. |
| **Breathwork / biofeedback apps** | A pacer at ~6 breaths/min ("resonance"), live HRV or coherence graphs, signal-quality indicators, and RMSSD after the session. They need external sensors: a BLE chest strap, ear clip or watch. Respirix runs a resonance-finding assessment across 6 paces. shii·haa opens with a free-breathing phase, then adapts the guide's timing to the user. |

### What the science says

- **Resonance breathing.** Heart rate and breathing synchronise at about 0.1 Hz (~6 breaths/min).
  - Each person's resonance rate is individual, typically 4.5–7.0 breaths/min. The most common is 5.5.
  - In a randomised study (Steffen et al., 2017, *Frontiers in Public Health*, n = 95), breathing at one's resonance rate raised positive mood and the LF/HF HRV ratio, compared with breathing 1/min faster or sitting quietly.
- **Biofeedback vs. simple pacing.** A 2022 *Frontiers in Computer Science* study found that simple paced breathing gave the same *immediate* benefits as full HRV biofeedback.
  - The implication: biofeedback's value lies less in displaying raw data than in **personalisation**, **motivation** and **showing proof that the session worked**.
  - That is the design brief for this app.

## 3. What SmartSpectra provides

Camera-based (rPPG and optical breathing) on-device processing. Native SDKs for iOS (Swift, iOS 17+), Android (Kotlin, minSdk 28), C++ (macOS Apple Silicon supported; Windows/Linux experimental) and Node.js/Electron. **No browser SDK.**

| Signal | Window / latency | Accuracy note | Use in a meditation app |
|---|---|---|---|
| Pulse rate (40–110 BPM) | 12 s average, first value ~12 s | `stable` at confidence ≥ 40 ≈ ±3 bpm | Calming trend, before/after |
| Pulse waveform (`arterialPressureTrace`, unitless) | Real time | Not blood pressure | Heartbeat-synced visuals/haptics, interoception exercises |
| HRV: RMSSD, SDNN, mean NN, Baevsky | 60 s window, confidence 0 until 60 s | `stable` ≥ 50 ≈ ±5 ms | Before/after "recovery", resonance testing |
| Breathing rate (5–40/min) | 30 s average, confident after ~30 s | `stable` ≥ 45 ≈ ±1/min | Session adaptation |
| Breathing waveforms: `upperTrace` (chest), `lowerTrace` (belly) | Real time | Arbitrary units | **Live breath mirror**, belly-vs-chest coaching |
| Inhale/exhale ratio, amplitude, apnea, baseline | Continuous | | Coaching longer exhales |
| Face: blinking, talking, 8 expression classes, 478 landmarks | Real time | | Settling / restlessness proxies, auto mood check-in |
| `validationStatus` with codes such as `TOO_DARK`, `EXCESSIVE_MOTION`, `FACE_TOO_FAR` and `CHEST_NOT_VISIBLE`, plus a user-facing `hint` | Real time | | Positioning guide, gentle "settle" cues |

### Constraints that shape the design

- **Warm-up.** Breathing becomes confident after about 30 s and HRV after about 60 s. Every session opens with a 60-second "arriving" check-in, which meditation has anyway, and the camera starts on the setup screen so the warm-up overlaps with getting comfortable.
- **Stability.** Heart rate tolerates a handheld phone; breathing does not. The setup screen insists on propping the phone up with face and shoulders in view.
- **Failure modes.** Talking, motion, flickering light (a TV behind the user), dark or tightly striped clothing, and face rotation. The app narrates and the user stays silent, which suits meditation.
- **Unknown: eyes closed.** The docs don't cover eyes-closed quality. The app offers a "soft gaze" (eyes-open) mode as a fallback. **Test this on a real device first.**
- **Connectivity and cost.** Processing is on-device, but the SDK authenticates with Presage (a summary of Presage's docs said there is no offline mode) and is credit-metered (`CREDIT_EXHAUSTED`). Free trial, then volume pricing (team@presagetech.com).
- **Authentication.** An API key works for development. Store releases should use OAuth, which registers the bundle ID / SHA-256 in the Developer Portal, so no key ships in the app.
- **Privacy and compliance.**
  - Telemetry is on by default: one aggregate summary per session, with no frames and no metric values. Disclose it, and offer the opt-out (`enableTelemetry = false`).
  - The SDK metrics are "general wellness" and not FDA-cleared. Only "SmartSpectra Vital Signs Monitor 1.0" (iOS/Android) has 510(k) clearance, K254169. **Make no medical claims.**

## 4. Innovation ideas

Ranked by value for effort. ✅ = in this MVP.

1. ✅ **Breath-following pacer (entrainment ladder).** The guide starts at the user's measured breathing rate and slows by 0.5/min only after the user has followed for two breaths. If they can't keep up, it eases back and offers reassurance. Fixed-pace apps make many beginners feel they are "failing"; this one meets them where they are. (`src/session/pacer.ts`)
2. ✅ **Breath mirror.** Outside the paced section the orb is driven by the user's own chest waveform, so they see their real breath settle. (`src/session/breathMirror.ts`)
3. ✅ **Proof it worked.** A 60-second check-in and check-out give, for example, "Breathing 13 → 6/min, heart rate −8 bpm, HRV +19 ms". Changes smaller than the SDK's stated accuracy are reported as "steady", never overclaimed. (`src/session/summary.ts`)
4. ✅ **Adaptive scripts.** The narration branches on the body:
   - It skips the settling section if the user is already breathing slowly.
   - It extends the breathing section (up to twice) if breathing is still fast.
   - It gives a stillness cue on sustained movement, at most once a minute.
   - It gives reassurance when the user can't follow the pacer.

   The session summary lists every adaptation. (`src/session/engine.ts`)
5. **Camera-only resonance finder.** Breathe at 4.5–7/min for about 2 minutes at each pace, then pick the pace with the largest heart-rate swing (RSA), computed from beat intervals in the pulse waveform. Save it as the personal target. *Needs device validation.*
6. **Interoception training.** "Tap each heartbeat you feel", then compare with the measured pulse. Body awareness is a core mindfulness skill, and few apps train it.
7. **Bio-reactive soundscape and haptics.** Ambient layers soften as heart rate falls. Optional haptics synced to the heartbeat.
8. **Trends and insights.** Weekly resting HR, breathing and HRV, and the best time of day to practise. Optionally, the SDK's LLM Insights for reflections (opt-in, because it sends computed vitals).
9. **Belly-breathing coach.** Compare `lowerTrace` with `upperTrace` amplitude. Needs the waist in frame.
10. **Desktop edition.** An Electron build on `@smartspectra/node-sdk` would give real vitals from a laptop webcam, for desk breaks.

## 5. Why React Native + Expo

- One TypeScript codebase for iOS, Android and web.
- The SDK is wrapped in a thin local Expo module, written in Swift and Kotlin (`modules/smartspectra`).
- The web build runs the full experience with simulated vitals. It is useful for content, design reviews and demos, but can never show live vitals.

## Sources

- Presage SmartSpectra SDK: <https://presagetech.com/smartspectra-sdk>
- SmartSpectra docs, including data types, Swift and Android API references, model cards and limitations, and telemetry and privacy: <https://presagetech.com/docs/smartspectra-sdk/>
- Swift SDK examples: <https://github.com/Presage-Security/SmartSpectraSwiftSDK-Examples>
- SmartSpectra SDK repository mirror: <https://github.com/wei/SmartSpectra>
- "Resonance", an open-source SwiftUI breathing pacer built on SmartSpectra: <https://github.com/dizzyfrogs/resonance>
- Lucid, a HackCanada 2026 project built on SmartSpectra: <https://github.gg22.workers.dev/DivyamBanga/Lucid>
- Steffen et al. (2017), *The Impact of Resonance Frequency Breathing on Measures of HRV, Blood Pressure, and Mood*: <https://pmc.ncbi.nlm.nih.gov/articles/PMC5575449/>
- Paced breathing vs. HRV biofeedback (2022): <https://www.frontiersin.org/articles/10.3389/fcomp.2022.926649>
- Headspace vs. Calm overviews: <https://healthline.com/health/headspace-vs-calm>, <https://carepaths.com/calm-app-vs-headspace/>
- HRV biofeedback apps:
  - Respirix: <https://apps.apple.com/app/id6758206591>
  - HRVibe: <https://www.producthunt.com/products/hrvibe>
  - Biofeedback breathwork apps: <https://dev.to/felix_zeller_6f3c43a7513f/beyond-the-timer-how-biofeedback-changes-everything-about-breathwork-apps-5hdp>
- FDA clearance press release (July 2026): <https://digital-release.wowktv.com/business/press-releases/cision/20260707PH98609/presage-technologies-earns-fda-clearance-for-contactless-vital-signs-makes-them-available-for-free>
