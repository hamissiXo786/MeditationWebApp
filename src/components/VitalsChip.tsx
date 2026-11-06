import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '../theme';
import { trusted } from '../vitals/quality';
import { useVitals } from '../vitals/VitalsProvider';

/** Small live readout. Shows "–" until SmartSpectra marks a reading stable. */
export function VitalsChip() {
  const v = useVitals();
  const now = v.updatedAt;
  const hr = trusted(v.pulseRate, now);
  const br = trusted(v.breathingRate, now);
  return (
    <View style={styles.chip} testID="vitals-chip">
      <Text style={styles.text}>♥ {hr ? Math.round(hr.value) : '–'} bpm</Text>
      <Text style={styles.dot}>·</Text>
      <Text style={styles.text}>≋ {br ? br.value.toFixed(1) : '–'} /min</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    gap: space.sm,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { color: colors.muted, fontSize: 14, fontVariant: ['tabular-nums'] },
  dot: { color: colors.faint },
});
