import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export type OrbSample = { level: number; tone: 'inhale' | 'exhale' | 'neutral' };

/**
 * The breathing orb. `sample()` is called every animation frame and returns the size (0..1)
 * and colour tone, so the orb can be driven by the pacer or by the user's live breathing
 * waveform without re-rendering React.
 */
export function BreathOrb({ sample, label, size = 260 }: { sample: () => OrbSample; label?: string; size?: number }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const exhaleOpacity = useRef(new Animated.Value(0)).current;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  useEffect(() => {
    let raf = 0;
    let tone = 0;
    const loop = () => {
      const s = sampleRef.current();
      scale.setValue(0.55 + 0.45 * clamp01(s.level));
      const target = s.tone === 'exhale' ? 1 : 0;
      tone += (target - tone) * 0.06;
      exhaleOpacity.setValue(tone);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scale, exhaleOpacity]);

  const circle = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.wrap, { width: size * 1.15, height: size * 1.15 }]} testID="breath-orb">
      <Animated.View style={[styles.halo, circle, { transform: [{ scale: Animated.multiply(scale, 1.12) }] }]} />
      <Animated.View style={[styles.orb, circle, { backgroundColor: colors.inhale, transform: [{ scale }] }]} />
      <Animated.View
        style={[styles.orb, circle, { backgroundColor: colors.exhale, opacity: exhaleOpacity, transform: [{ scale }] }]}
      />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: colors.inhale, opacity: 0.08 },
  orb: { position: 'absolute', opacity: 0.85 },
  label: { color: colors.background, fontSize: 20, fontWeight: '600', letterSpacing: 0.5 },
});
