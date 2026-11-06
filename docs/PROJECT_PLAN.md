# Project plan and timeline

*Last updated: 6 November 2026 · Solo developer, full-time · Platforms: Android + web*

## Goal and scope

Launch a guided meditation app on **Google Play** that uses the phone camera, through Presage's SmartSpectra SDK, to read breathing and heart rate and adapt each session to the user. Alongside it runs a **web demo** with simulated vitals, for sharing, design reviews and content work. **No iOS version is planned.**

Background and design rationale: [RESEARCH.md](RESEARCH.md).

## Timeline

Plan: 10 working weeks from Monday 9 November 2026 to a public launch in mid-January 2027, with a two-week holiday buffer.

| Week | Dates | Focus | Deliverables | Milestone |
|---|---|---|---|---|
| 0 ✅ | 2–6 Nov | Research and MVP | Research report. Expo app with an adaptive session engine, breath-following guide, before/after summary and two sessions. Simulated vitals source. Kotlin SmartSpectra bridge (not yet compiled). Tests. | MVP in repo |
| 1 | 9–13 Nov | Deploy and first device build | Web demo live on GitHub Pages and EAS Hosting. Expo account and SmartSpectra API key. First Android development build via EAS Build. Fix any compile issues in the Kotlin bridge. | **M1: first live reading on Android** |
| 2 | 16–20 Nov | Device validation and onboarding | Test on 2–3 Android phones, including a mid-range one. Compare eyes closed vs. soft gaze, breath-mirror direction, narration vs. signal quality, and lighting. Tune the guide and warm-up thresholds. Add a camera-positioning tutorial and explain the camera permission before asking. | **M2: validation notes** |
| 3 | 23–27 Nov (short week) | Content | Better narration (recorded voice or improved TTS). 2–3 new sessions, such as a 3-minute reset and a sleep wind-down. | |
| 4 | 30 Nov–4 Dec | Resonance finder | Extract beat intervals from the pulse waveform. Run a guided test at 4.5–7 breaths/min and save the user's personal pace. Stretch goal: a heartbeat-tapping (interoception) exercise. | |
| 5 | 7–11 Dec | Habit loop; start production readiness | Reminders (expo-notifications), a weekly trends screen, streak UI. SmartSpectra OAuth for release builds: register the package name and SHA-256 fingerprint, so no API key ships in the app. Draft a privacy policy. | |
| 6 | 14–18 Dec | Production readiness and beta | Play Data Safety form. Error states (`CREDIT_EXHAUSTED`, no network, camera denied). Crash reporting. Accessibility pass. Create a Play Console account and upload to internal testing, then start a **closed test with at least 12 testers**. | **M3: closed beta starts** |
| 7–8 | 21 Dec–1 Jan | Holiday buffer | The closed test keeps running; Google requires 14 consecutive days for new personal developer accounts. Light bug fixes only. | |
| 9 | 4–8 Jan 2027 | Beta feedback and store prep | Fix issues from beta feedback. Agree production pricing with Presage. Store listing: screenshots, description, feature graphic. Apply for production access. | |
| 10 | 11–15 Jan 2027 | Launch | Production release on Google Play, with buffer for review time. | **M4: public launch, about mid-January 2027** |

## Milestones

| Milestone | Target | Done when |
|---|---|---|
| M1: live reading | 13 Nov | Heart rate and breathing appear in a session on a real Android phone |
| M2: validated | 20 Nov | A validation notes doc covers 2–3 devices, with thresholds tuned |
| M3: closed beta | 18 Dec | At least 12 testers opted in through Play closed testing |
| M4: launch | ~15 Jan | Live on Google Play |

## Accounts and costs

| Item | Cost | Needed by |
|---|---|---|
| Expo account (EAS Build, EAS Hosting) | Free tier | Week 1 |
| SmartSpectra Developer Portal API key | Free trial, then volume pricing (team@presagetech.com) | Week 1 |
| Google Play Console | $25, one-off | Week 6 |
| At least 12 closed-test testers | Friends, family, community | Week 6 |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The Kotlin bridge doesn't compile first time; it was written to the docs but never built | Delays M1 | All of week 1 is set aside for this. The SDK's sample app is the reference. |
| Poor readings with eyes closed (not documented by Presage) | Core experience | Soft-gaze mode already exists; make it the default if testing confirms. |
| Camera quality varies across Android devices | Unreliable readings on some phones | Test on a mid-range device. Signal-quality hints, and graceful "not enough signal" summaries. |
| SDK credit costs at scale | Margins | Get pricing in week 9. Measure only during sessions, never in the background. |
| Play review of health-related claims | Rejection | Wellness-only wording everywhere. No diagnostic language. |
| SDK needs a connection (no offline mode) | Sessions fail offline | Detect offline and fall back to an unmeasured session with the guide. |
| The 14-day closed-test rule | Launch date | The test starts on 14–18 Dec so it completes over the holidays. |

## Open decisions

- **Business model:** free, freemium (paid advanced sessions or resonance finder), or subscription. This affects the SDK cost plan.
- **Narration voice:** recorded voice actor vs. high-quality TTS.
- **App name and branding** (currently "MeditationWebApp").

## Deployment

| Target | URL | How it deploys |
|---|---|---|
| Web demo (GitHub Pages) | <https://hamissixo786.github.io/MeditationWebApp/> | Automatically on every push, via `.github/workflows/deploy-web.yml`. One-time: repo Settings → Pages → Source: **GitHub Actions**. |
| Web demo (EAS Hosting) | `https://<project>.expo.app`, shown in the workflow log | Same workflow, once the `EXPO_TOKEN` secret and `EAS_PROJECT_ID` variable are added to the repo. |
| Android development build (week 1) | Install link from EAS | `npx eas-cli@latest build --profile development --platform android` |
| Android release (week 6+) | Google Play | EAS Build plus Play Console (internal → closed → production) |

The web demo always uses **simulated vitals**, because SmartSpectra has no browser SDK.
