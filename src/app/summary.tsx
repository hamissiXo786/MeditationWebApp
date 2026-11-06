import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Screen } from '../components/Screen';
import { Sparkline, chartColors } from '../components/Sparkline';
import { Badge, Button, Card } from '../components/ui';
import { compare, fmt, headline } from '../session/summary';
import type { SessionResult } from '../session/types';
import { getResult } from '../storage/history';
import { colors, space, type } from '../theme';

export default function Summary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<SessionResult | null | undefined>(undefined);
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width, 560) - 2 * space.md - 2 * space.md;

  useEffect(() => {
    getResult(id ?? '').then((r) => setResult(r ?? null));
  }, [id]);

  if (result === undefined) return <Screen>{null}</Screen>;
  if (result === null) {
    return (
      <Screen>
        <Text style={type.body}>That session wasn't found.</Text>
        <Button label="Home" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  const changes = compare(result);

  return (
    <Screen>
      <Text style={type.title}>{result.completed ? 'Well done' : 'Session ended'}</Text>
      <View style={styles.row}>
        <Badge label={`${result.title} · ${Math.round(result.durationSec / 60)} min`} />
        {result.source === 'simulated' ? <Badge label="Simulated vitals" tone="warn" /> : null}
      </View>
      <Text style={type.body} testID="headline">
        {headline(result)}
      </Text>

      <View style={styles.metrics}>
        {changes.map((c) => (
          <Card key={c.key} style={styles.metric}>
            <Text style={type.small}>{c.label}</Text>
            <Text style={type.number}>
              {fmt(c.after, c.key === 'breathingRate' ? 1 : 0)}
              <Text style={type.small}> {c.unit}</Text>
            </Text>
            <Text style={[type.small, c.calmer ? { color: colors.accent } : null]}>
              {c.delta == null
                ? 'not enough signal'
                : `${c.delta > 0 ? '+' : ''}${fmt(c.delta, c.key === 'breathingRate' ? 1 : 0)} from ${fmt(c.before, c.key === 'breathingRate' ? 1 : 0)}`}
            </Text>
          </Card>
        ))}
      </View>

      <Card style={{ gap: space.md }}>
        <Sparkline
          label="Breathing over the session"
          unit="/min"
          color={chartColors.br}
          width={chartWidth}
          points={result.timeline.map((p) => ({ t: p.t, v: p.br }))}
        />
        <Sparkline
          label="Heart rate over the session"
          unit="bpm"
          color={chartColors.hr}
          width={chartWidth}
          points={result.timeline.map((p) => ({ t: p.t, v: p.hr }))}
        />
      </Card>

      {result.adaptations.length ? (
        <Card style={{ gap: space.xs }}>
          <Text style={type.heading}>How the session adapted to you</Text>
          {result.adaptations.map((a, i) => (
            <Text key={i} style={type.small}>
              • {a}
            </Text>
          ))}
          {result.pacerStartBpm != null && result.pacerEndBpm != null ? (
            <Text style={type.small}>
              • Guide moved from {result.pacerStartBpm} to {result.pacerEndBpm} breaths/min with you
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Text style={[type.small, { color: colors.faint }]}>
        Readings are camera-based estimates for general wellness, not medical measurements. Changes within normal
        measurement error are shown as steady.
      </Text>

      <Button label="Done" onPress={() => router.dismissTo('/')} testID="done" />
      <Button label="History" variant="ghost" onPress={() => router.replace('/history')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  metrics: { flexDirection: 'row', gap: space.sm },
  metric: { flex: 1, gap: 2, padding: space.sm + 4 },
});
