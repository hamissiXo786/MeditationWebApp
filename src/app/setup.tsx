import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SmartSpectraCameraView } from '../../modules/smartspectra';
import { Button, Card } from '../components/ui';
import { Screen } from '../components/Screen';
import { getSession } from '../content/sessions';
import { colors, radius, space, type } from '../theme';
import { hintFor, positioningReady } from '../vitals/quality';
import { useVitals, useVitalsContext } from '../vitals/VitalsProvider';

const ALLOW_ANYWAY_AFTER_MS = 10_000;

export default function Setup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = getSession(id ?? '');
  const { kind, start, stop } = useVitalsContext();
  const vitals = useVitals();
  const [gaze, setGaze] = useState<'closed' | 'soft'>('closed');
  const [openedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Start measuring now so the SDK's 30-60 s warm-up overlaps with getting comfortable.
    start();
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [start]);

  if (!session) {
    return (
      <Screen>
        <Text style={type.body}>Session not found.</Text>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const ready = positioningReady(vitals.validation, now);
  const canSkip = now - openedAt > ALLOW_ANYWAY_AFTER_MS;
  const error = vitals.error;

  const begin = () =>
    router.replace({ pathname: '/session/[id]', params: { id: session.id, gaze } });

  const cancel = () => {
    stop();
    router.back();
  };

  return (
    <Screen>
      <Text style={type.title}>{session.title}</Text>
      <Text style={type.small}>Let's get the camera a good view of you.</Text>

      <View style={styles.preview}>
        {kind === 'smartspectra' ? (
          <SmartSpectraCameraView style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.demo}>
            <Text style={[type.body, { textAlign: 'center' }]}>Demo mode</Text>
            <Text style={[type.small, { textAlign: 'center' }]}>
              Vitals are simulated here. On a phone with the SmartSpectra SDK and an API key, this shows your camera.
            </Text>
          </View>
        )}
      </View>

      <Card style={{ borderColor: ready ? colors.accent : colors.border }}>
        <Text style={type.body} testID="validation-hint">
          {error ? error.message : hintFor(vitals.validation)}
        </Text>
      </Card>

      <Card style={{ gap: space.sm }}>
        <Text style={type.small}>• Prop the phone up at about arm's length. Breathing needs a steady camera.</Text>
        <Text style={type.small}>• Face and shoulders in view, in soft, even light.</Text>
        <Text style={type.small}>• Avoid a flickering screen behind you, and stay quiet during the session.</Text>
      </Card>

      <View style={styles.gaze}>
        <Text style={type.small}>During the session:</Text>
        <View style={styles.row}>
          <Button
            label="Eyes closed"
            variant={gaze === 'closed' ? 'primary' : 'secondary'}
            onPress={() => setGaze('closed')}
            style={styles.flex}
          />
          <Button
            label="Soft gaze"
            variant={gaze === 'soft' ? 'primary' : 'secondary'}
            onPress={() => setGaze('soft')}
            style={styles.flex}
          />
        </View>
        <Text style={[type.small, { color: colors.faint }]}>
          If readings drop out with your eyes closed, try a soft, downward gaze with eyes open.
        </Text>
      </View>

      <Button label="Begin" onPress={begin} disabled={!ready && !canSkip} testID="begin" />
      {!ready && canSkip ? <Text style={[type.small, styles.center]}>You can begin anyway. Readings may be partial.</Text> : null}
      <Button label="Cancel" variant="ghost" onPress={cancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.sm },
  gaze: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
});
