import { router } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { Button, Card } from '../components/ui';
import { clearHistory } from '../storage/history';
import { colors, space, type } from '../theme';
import { useVitalsContext } from '../vitals/VitalsProvider';

const LIVE_STATUS_TEXT = {
  live: 'Live: SmartSpectra is measuring through your camera.',
  'demo-mode': 'Demo mode is on, so vitals are simulated.',
  'no-native-module':
    'Simulated: this build doesn’t include the SmartSpectra module (e.g. Expo Go). Use a development build.',
  'no-api-key': 'Simulated: no SmartSpectra API key was set when this app was built (SMARTSPECTRA_API_KEY).',
  web: 'Simulated: SmartSpectra has no browser SDK, so the web version always uses simulated vitals.',
} as const;

export default function Settings() {
  const { settings, updateSettings, liveStatus } = useVitalsContext();

  return (
    <Screen>
      <Text style={type.title}>Settings</Text>

      <Card style={{ gap: space.xs }}>
        <Text style={type.heading}>Vitals</Text>
        <Text style={type.small} testID="live-status">
          {LIVE_STATUS_TEXT[liveStatus]}
        </Text>
      </Card>

      <Card style={{ gap: space.md }}>
        <Row
          label="Demo mode"
          detail="Use simulated vitals even when the camera is available."
          value={settings.demoMode}
          onChange={(demoMode) => updateSettings({ demoMode })}
        />
        <Row label="Spoken guidance" value={settings.narration} onChange={(narration) => updateSettings({ narration })} />
        <Row label="Ambient sound" value={settings.ambient} onChange={(ambient) => updateSettings({ ambient })} />
        <Row
          label="SmartSpectra telemetry"
          detail="One anonymous summary per session (SDK version, device model, error codes). Never video or your readings."
          value={settings.sdkTelemetry}
          onChange={(sdkTelemetry) => updateSettings({ sdkTelemetry })}
        />
      </Card>

      <Card style={{ gap: space.sm }}>
        <Text style={type.heading}>Privacy</Text>
        <Text style={type.small}>
          Heart and breathing rates are computed on your device by the SmartSpectra SDK. The SDK connects to Presage only
          to authenticate. Your session history is stored only on this device. This app has no account and no server.
        </Text>
        <Text style={type.small}>
          For general wellness only. Not a medical device. Readings are estimates and are not for diagnosis or treatment.
        </Text>
      </Card>

      <Button label="Clear history" variant="secondary" onPress={() => clearHistory()} />
      <Button label="Back" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

function Row({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={type.body}>{label}</Text>
        {detail ? <Text style={type.small}>{detail}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
});
