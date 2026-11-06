import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { Button, Card } from '../components/ui';
import { compare, fmt } from '../session/summary';
import type { SessionResult } from '../session/types';
import { loadHistory, streakDays } from '../storage/history';
import { space, type } from '../theme';

export default function History() {
  const [history, setHistory] = useState<SessionResult[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setHistory);
    }, []),
  );

  const totalMin = Math.round(history.reduce((s, r) => s + r.durationSec, 0) / 60);

  return (
    <Screen>
      <Text style={type.title}>History</Text>
      <Text style={type.small}>
        {history.length} sessions · {totalMin} minutes · {streakDays(history)}-day streak. Stored only on this device.
      </Text>

      {history.length === 0 ? <Text style={type.body}>No sessions yet. Your first one is a few breaths away.</Text> : null}

      {history.map((r) => {
        const c = compare(r);
        const hr = c.find((x) => x.key === 'heartRate')!;
        const br = c.find((x) => x.key === 'breathingRate')!;
        return (
          <Pressable key={r.id} onPress={() => router.push({ pathname: '/summary', params: { id: r.id } })}>
            <Card style={styles.item}>
              <View style={styles.row}>
                <Text style={type.heading}>{r.title}</Text>
                <Text style={type.small}>{new Date(r.startedAt).toLocaleString()}</Text>
              </View>
              <Text style={type.small}>
                Breathing {fmt(br.before, 1)} → {fmt(br.after, 1)} /min · Heart {fmt(hr.before)} → {fmt(hr.after)} bpm
                {r.source === 'simulated' ? ' · simulated' : ''}
                {r.completed ? '' : ' · ended early'}
              </Text>
            </Card>
          </Pressable>
        );
      })}

      <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
});
