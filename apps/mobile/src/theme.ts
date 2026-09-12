import { DynamicColorIOS, Platform, StyleSheet, type ColorValue } from 'react-native';

const light = {
  paper: '#F8F8F4', surface: '#FFFFFF', ink: '#263A41', muted: '#52676A',
  line: '#DEDFDA', accent: '#285D75', accentPressed: '#214C60',
  accentSoft: '#E3E9E8', error: '#A52B22', white: '#FFFFFF', black: '#000000',
  note: '#E9EDDF', pending: '#76551B', errorSurface: '#F8E8E5', onAccent: '#FFFFFF', onError: '#FFFFFF',
  glass: 'rgba(255,255,255,0.82)', glassCard: 'rgba(255,255,255,0.92)', glassEdge: 'rgba(255,255,255,0.88)',
  shadow: '#263A41',
};
const dark: typeof light = {
  paper: '#192426', surface: '#223035', ink: '#F1F3EF', muted: '#B5C5C2',
  line: '#41514F', accent: '#A6D0DD', accentPressed: '#C7E3EA',
  accentSoft: '#304649', error: '#F2A79D', white: '#FFFFFF', black: '#000000',
  note: '#303C32', pending: '#E2C887', errorSurface: '#4B302F', onAccent: '#192426', onError: '#261B19',
  glass: 'rgba(34,48,53,0.88)', glassCard: 'rgba(34,48,53,0.95)', glassEdge: 'rgba(181,197,194,0.23)',
  shadow: '#000E18',
};
export const palettes = { light, dark };
export const colors = Object.fromEntries(Object.entries(light).map(([key, value]) => [key,
  Platform.OS === 'ios' ? DynamicColorIOS({ light: value, dark: dark[key as keyof typeof light] })
    // RN Web cannot compose shadowOpacity with a CSS variable color.
    : Platform.OS === 'web' && key !== 'shadow' ? `var(--foundkeep-${key}, ${value})` : value,
])) as Record<keyof typeof light, ColorValue>;

export const typography = StyleSheet.create({
  display: { color: colors.ink, fontSize: 40, lineHeight: 44, fontWeight: '600', letterSpacing: -1.5 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 37, fontWeight: '600', letterSpacing: -0.8 },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.3 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
});
