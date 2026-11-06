export const colors = {
  background: '#0B1220',
  surface: '#141D30',
  surfaceRaised: '#1B263D',
  border: '#26324C',
  text: '#E8EEF8',
  muted: '#8EA0BF',
  faint: '#5B6A88',
  accent: '#7FD4C1',
  inhale: '#7FD4C1',
  exhale: '#A79BFF',
  warn: '#F2C47E',
  danger: '#F08A8A',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { md: 14, lg: 22, pill: 999 };

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: 0.2 },
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  number: { fontSize: 30, fontWeight: '600' as const, color: colors.text, fontVariant: ['tabular-nums' as const] },
};
