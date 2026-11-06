# MeditationWebApp: guided meditation that listens

A guided meditation app that uses the phone's camera, through Presage's **SmartSpectra SDK**, to read breathing and heart rate. The guidance adapts to you as you go:

- **A breathing guide that follows you.** It starts at your own breathing pace and slows down step by step, only once you've caught up.
- **A breath mirror.** Outside the guided part, the orb moves with your *real* breathing.
- **Sessions that adapt.** For example: skip the settling section if you're already calm, give a little more breathing time if you aren't, and add a gentle stillness cue if you're moving.
- **Before/after proof.** For example: "Your breathing slowed from 13 to 6 breaths a minute."

Built with React Native + Expo (SDK 58), so it targets **iOS, Android and the web**. Live vitals work on iOS/Android only, because SmartSpectra has no browser SDK; the web build uses simulated vitals.

Research behind the design, including how meditation apps work, what the SDK provides, and more ideas: **[docs/RESEARCH.md](docs/RESEARCH.md)**.

## Where it runs

| Where | What you get |
|---|---|
| **Browser** (`npm run web`) | The full app with **simulated** vitals: sessions, guide, narration, summary, history. Good for content and design work. |
| **Expo Go** | Same as the browser (simulated). Expo Go can't load the SmartSpectra native module. |
| **Development build on a phone** + API key | **Live** vitals from the front camera. |
| **Desktop with webcam** | Not in this build. SmartSpectra's Node/Electron SDK could power a desktop edition later (see RESEARCH.md §4). |

## Quick start (web, simulated)

```bash
npm install
```

```bash
npm run web
```

## Live vitals on a phone

1. Get an API key from the SmartSpectra Developer Portal (<https://physiology.presagetech.com/auth/register>).
2. Copy the example env file, then put your key in `.env` (git-ignored):

   ```bash
   cp .env.example .env
   ```

3. Build and run a development build (the SDK needs native code, so Expo Go won't do).
   - **Android** (any OS, phone connected over USB with developer mode on):

     ```bash
     npm run android
     ```

   - **iOS** needs a Mac with Xcode:

     ```bash
     npm run ios -- --device
     ```

     Without a Mac, use EAS cloud builds:

     ```bash
     npx eas-cli@latest build --profile development --platform ios
     ```

4. Start a session and prop the phone up at arm's length with your face and shoulders in view.

The **Settings** screen shows whether vitals are live or simulated, and why.

### First-device checklist

The native bridge (`modules/smartspectra`) was written against the SmartSpectra 3.4.0 API reference but **has not been compiled yet**, because this repo was set up without a Mac or Android toolchain. On the first device build, check that:

- [ ] iOS: `pod install` adds the `SmartSpectra-Swift` package (via React Native's `spm_dependency`), and the app builds.
- [ ] Android: Gradle resolves `com.presagetech:smartspectra:3.4.0`, and the Kotlin imports match the SDK (`ValidationStatus`, `SmartSpectraError`, `MetricsProto.Metrics`).
- [ ] The setup screen shows the camera preview and positioning hints change as you move.
- [ ] Heart rate appears within ~15 s and breathing within ~30 s ("Show vitals" during a session).
- [ ] **Eyes closed vs. soft gaze:** do readings hold up with eyes closed? (Not documented by Presage.)
- [ ] The breath mirror moves *up* when you inhale. If it's inverted, flip the sign in `src/session/breathMirror.ts`.
- [ ] Narration doesn't degrade the breathing signal (the speaker, not the user, is talking).

## Project layout

```
src/app/               Screens (Expo Router): home, setup, session/[id], summary, history, settings
src/session/           Pure TS logic: pacer.ts (breath-following guide), engine.ts (adaptive session
                       state machine), summary.ts (before/after), breathMirror.ts
src/content/           Session scripts (Arrive, Body scan)
src/vitals/            VitalsSource interface, SmartSpectra source, simulated source, store, quality gating
modules/smartspectra/  Local Expo module: Swift + Kotlin bridge around the SmartSpectra SDK
assets/audio/          Ambient drone + bell, synthesised by scripts/generate-audio.mjs
__tests__/             Unit tests (pacer, engine incl. a full simulated session, summary)
docs/RESEARCH.md       Research report
```

## Development

```bash
npm test
```

```bash
npm run typecheck
```

`src/vitals/simulatedSource.ts` mirrors the SDK's timing (pulse after ~12 s, breathing after ~30 s, HRV after ~60 s), and the simulated body follows the guide with a realistic lag. Everything except the camera can be built and tested without a phone or API credits.

## Privacy and disclaimer

- Vitals are computed on-device by the SDK, which connects to Presage only to authenticate.
- Session history stays on the device. The app has no server and no account.
- SmartSpectra's anonymous session telemetry can be turned off in Settings.
- **For general wellness only. Not a medical device. Not for diagnosis or treatment.**
