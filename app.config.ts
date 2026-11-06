import type { ConfigContext, ExpoConfig } from 'expo/config';

// The SmartSpectra API key is read from the environment at build time (see .env.example).
// It is only used for development builds. Store releases should use SmartSpectra OAuth
// (PresageService-Info.plist / presage_services.xml) instead of shipping an API key.
const smartSpectraApiKey = process.env.SMARTSPECTRA_API_KEY ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MeditationWebApp',
  slug: 'MeditationWebApp',
  scheme: 'meditationwebapp',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.example.meditationwebapp',
    infoPlist: {
      NSCameraUsageDescription:
        'The camera measures your breathing and heart rate during sessions. Video never leaves your device.',
    },
  },
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
  plugins: [
    'expo-router',
    'expo-audio',
    [
      'expo-build-properties',
      {
        // SmartSpectra 3.4 requires iOS 17+ and Android API 28+.
        ios: { deploymentTarget: '17.0' },
        android: { minSdkVersion: 28 },
      },
    ],
  ],
  extra: {
    smartSpectraApiKey,
  },
});
