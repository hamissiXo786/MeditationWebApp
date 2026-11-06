import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card } from '../components/ui';
import { Screen } from '../components/Screen';
import { SESSIONS } from '../content/sessions';
import { headline } from '../session/summary';
import type { SessionResult } from '../session/types';
import { loadHistory, streakDays } from '../storage/history';
import { colors, space, type } from '../theme';
import { useVitalsContext } from '../vitals/VitalsProvider';

export default function Home() {
  const { kind } = useVitalsContext();
  const [history, setHistory] = useState<SessionResult[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setHistory);
    }, []),
  );

  const last = history[0];
  const streak = streakDays(history);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={type.title}>Breathe with your body</Text>
        <Text style={type.small}>
          Guided sessions that listen. Your phone’s camera reads your breathing and heart rate, and the guidance adapts
          to you.
        </Text>
        <View style={styles.row}>
          {kind === 'smartspectra' ? (
            <Badge label="Live camera vitals" tone="accent" />
          ) : (
            <Badge label="Demo: simulated vitals" tone="warn" />
          )}
          {streak > 0 ? <Badge label={`${streak}-day streak`} /> : null}
        </View>
      </View>

      {SESSIONS.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          testID={`session-${s.id}`}
          onPress={() => router.push({ pathname: '/setup', params: { id: s.id } })}
        >
          {({ pressed }) => (
            <Card style={[styles.session, pressed && { opacity: 0.85 }]}>
              <Text style={type.heading}>{s.title}</Text>
              <Text style={[type.small, { color: colors.accent }]}>{s.subtitle}</Text>
              <Text style={type.body}>{s.description}</Text>
            </Card>
          )}
        </Pressable>
      ))}

      {last ? (
        <Card>
          <Text style={type.small}>Last session · {last.title}</Text>
          <Text style={[type.body, { marginTop: space.xs }]}>{headline(last)}</Text>
        </Card>
      ) : null}

      <View style={styles.row}>
        <Button label="History" variant="secondary" onPress={() => router.push('/history')} style={styles.flex} />
        <Button label="Settings" variant="secondary" onPress={() => router.push('/settings')} style={styles.flex} />
      </View>

      <Text style={[type.small, styles.disclaimer]}>
        For general wellness only. Not a medical device and not for diagnosis or treatment.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  session: { gap: space.xs },
  flex: { flex: 1 },
  disclaimer: { textAlign: 'center', color: colors.faint, marginTop: space.md },
});
