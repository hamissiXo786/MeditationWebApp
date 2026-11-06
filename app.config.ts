import type { ConfigContext, ExpoConfig } from 'expo/config';

// The SmartSpectra API key is read from the environment at build time (see .env.example).
// It is only used for development builds. Play Store releases should use SmartSpectra OAuth
// (presage_services.xml) instead of shipping an API key.
const smartSpectraApiKey = process.env.SMARTSPECTRA_API_KEY ?? '';

// Web hosting: GitHub Pages serves the site under /MeditationWebApp, EAS Hosting at the root.
const baseUrl = process.env.EXPO_BASE_URL || undefined;
// EAS project (needed by EAS Build / EAS Hosting). Set EAS_PROJECT_ID once the project exists.
const easProjectId = process.env.EAS_PROJECT_ID || undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MeditationWebApp',
  slug: 'MeditationWebApp',
  scheme: 'meditationwebapp',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  // Android (live camera vitals via SmartSpectra) and web (simulated vitals). No iOS build.
  platforms: ['android', 'web'],
  android: {
    package: 'com.example.meditationwebapp',
    permissions: ['android.permission.CAMERA', 'android.permission.INTERNET'],
    adaptiveIcon: {
      backgroundColor: '#0E1726',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    output: 'single',
  },
  experiments: {
    ...(baseUrl ? { baseUrl } : {}),
  },
  plugins: [
    'expo-router',
    'expo-audio',
    [
      'expo-build-properties',
      {
        // SmartSpectra 3.4 requires Android API 28+.
        android: { minSdkVersion: 28 },
      },
    ],
  ],
  extra: {
    smartSpectraApiKey,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
});
