# MeditationWebApp: guided meditation that listens

A guided meditation app for **Android and the web**. It uses the phone's camera, through Presage's **SmartSpectra SDK**, to read breathing and heart rate, and the guidance adapts to you as you go:

- **A breathing guide that follows you.** It starts at your own breathing pace and slows down step by step, only once you've caught up.
- **A breath mirror.** Outside the guided part, the orb moves with your *real* breathing.
- **Sessions that adapt.** For example: skip the settling section if you're already calm, give a little more breathing time if you aren't, and add a gentle stillness cue if you're moving.
- **Before/after proof.** For example: "Your breathing slowed from 13 to 6 breaths a minute."

Built with React Native + Expo (SDK 58). Live vitals work on Android; the web build uses simulated vitals because SmartSpectra has no browser SDK. There is no iOS version.

- **Try the web demo:** <https://hamissixo786.github.io/MeditationWebApp/> (live once GitHub Pages is enabled; see [Deploying](#deploying))
- **Research:** [docs/RESEARCH.md](docs/RESEARCH.md)
- **Timeline:** [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)

## Where it runs

| Where | What you get |
|---|---|
| **Browser** (web demo or `npm run web`) | The full app with **simulated** vitals: sessions, guide, narration, summary, history. |
| **Expo Go** | Same as the browser (simulated). Expo Go can't load the SmartSpectra native module. |
| **Android development build** + API key | **Live** vitals from the front camera. |

## Quick start (web, simulated)

```bash
npm install
```

```bash
npm run web
```

## Live vitals on Android

1. Get an API key from the SmartSpectra Developer Portal (<https://physiology.presagetech.com/auth/register>).
2. Copy the example env file, then put your key in `.env` (git-ignored):

   ```bash
   cp .env.example .env
   ```

3. Build and install a development build. The SDK needs native code, so Expo Go won't do.
   - With a phone connected over USB, with developer mode on (needs Android Studio / the Android SDK on your PC):

     ```bash
     npm run android
     ```

   - Or build in the cloud with EAS, and install from the link it gives you. Add the key as an EAS environment variable named `SMARTSPECTRA_API_KEY`:

     ```bash
     npx eas-cli@latest build --profile development --platform android
     ```

4. Start a session and prop the phone up at arm's length with your face and shoulders in view.

The **Settings** screen shows whether vitals are live or simulated, and why.

### First-device checklist

The native bridge (`modules/smartspectra`, Kotlin) was written against the SmartSpectra 3.4.0 API reference but **hasn't been compiled yet**. On the first device build, check that:

- [ ] Gradle resolves `com.presagetech:smartspectra:3.4.0`, and the Kotlin imports match the SDK (`ValidationStatus`, `SmartSpectraError`, `MetricsProto.Metrics`).
- [ ] The setup screen shows the camera preview, and positioning hints change as you move.
- [ ] Heart rate appears within ~15 s and breathing within ~30 s ("Show vitals" during a session).
- [ ] **Eyes closed vs. soft gaze:** do readings hold up with eyes closed? (Not documented by Presage.)
- [ ] The breath mirror moves *up* when you inhale. If it's inverted, flip the sign in `src/session/breathMirror.ts`.
- [ ] Narration doesn't degrade the breathing signal.

## Deploying

`.github/workflows/deploy-web.yml` runs typecheck, lint and tests on every push to `main` or `claude/sweet-brown-wajvgv`, then deploys the web demo:

| Target | One-time setup | URL |
|---|---|---|
| **GitHub Pages** | Repo **Settings → Pages → Source: GitHub Actions**. Then re-run the workflow, or push. | <https://hamissixo786.github.io/MeditationWebApp/> |
| **EAS Hosting** | 1. Create a free account at expo.dev and a project named `MeditationWebApp`; copy its **Project ID**. 2. Create an access token (expo.dev → Account settings → Access tokens). 3. In repo **Settings → Secrets and variables → Actions**, add the secret `EXPO_TOKEN` and the variable `EAS_PROJECT_ID`. | Shown in the workflow log (`https://<name>.expo.app`) |

The EAS Hosting job is skipped, with a notice, until both values exist.

## Project layout

```
src/app/               Screens (Expo Router): home, setup, session/[id], summary, history, settings
src/session/           Pure TS logic: pacer.ts (breath-following guide), engine.ts (adaptive session
                       state machine), summary.ts (before/after), breathMirror.ts
src/content/           Session scripts (Arrive, Body scan)
src/vitals/            VitalsSource interface, SmartSpectra source, simulated source, store, quality gating
modules/smartspectra/  Local Expo module: Kotlin bridge around the SmartSpectra Android SDK
assets/audio/          Ambient drone + bell, synthesised by scripts/generate-audio.mjs
__tests__/             Unit tests (pacer, engine incl. a full simulated session, summary)
docs/                  RESEARCH.md, PROJECT_PLAN.md
.github/workflows/     Web deploy (GitHub Pages + EAS Hosting)
```

## Development

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

`src/vitals/simulatedSource.ts` mirrors the SDK's timing (pulse after ~12 s, breathing after ~30 s, HRV after ~60 s), and the simulated body follows the guide with a realistic lag. Everything except the camera can be built and tested without a phone or API credits.

## Privacy and disclaimer

- Vitals are computed on-device by the SDK, which connects to Presage only to authenticate.
- Session history stays on the device. The app has no server and no account.
- SmartSpectra's anonymous session telemetry can be turned off in Settings.
- **For general wellness only. Not a medical device. Not for diagnosis or treatment.**
