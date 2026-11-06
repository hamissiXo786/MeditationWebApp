import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { colors, type } from '../theme';

/** A minimal line chart for one metric over a session. Gaps (null) break the line. */
export function Sparkline({
  points,
  label,
  unit,
  color,
  width = 300,
  height = 70,
}: {
  points: { t: number; v: number | null }[];
  label: string;
  unit: string;
  color: string;
  width?: number;
  height?: number;
}) {
  const values = points.map((p) => p.v).filter((v): v is number => v != null);
  if (values.length < 2) {
    return (
      <View style={styles.wrap}>
        <Text style={type.small}>{label}: not enough signal to chart</Text>
      </View>
    );
  }
  const tMax = Math.max(...points.map((p) => p.t), 1);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const y = (v: number) => height - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * height;
  const x = (t: number) => (t / tMax) * width;

  const segments: string[][] = [[]];
  for (const p of points) {
    if (p.v == null) {
      if (segments[segments.length - 1].length) segments.push([]);
      continue;
    }
    segments[segments.length - 1].push(`${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={type.small}>{label}</Text>
        <Text style={type.small}>
          {Math.round(lo)}–{Math.round(hi)} {unit}
        </Text>
      </View>
      <Svg width={width} height={height}>
        {segments
          .filter((s) => s.length > 1)
          .map((s, i) => (
            <Polyline key={i} points={s.join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
          ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
});

export const chartColors = { hr: colors.exhale, br: colors.inhale };
