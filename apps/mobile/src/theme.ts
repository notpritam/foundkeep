import { DynamicColorIOS, Platform, StyleSheet, type ColorValue } from 'react-native';

const light = {
  paper: '#F3F3F0', surface: '#FAFAF7', ink: '#171917', muted: '#5C6557',
  line: '#D7DBD1', accent: '#C63B23', accentPressed: '#A82E1B', moss: '#6B7553',
  paleMoss: '#E2E6DA', error: '#A52B22', white: '#FFFFFF', black: '#000000', note: '#F1EDDF', pending: '#806024', errorSurface: '#F5E0DD', onAccent: '#FFFFFF', onError: '#FFFFFF',
};
const dark: typeof light = {
  paper: '#1B1E1B', surface: '#252A24', ink: '#F2F2EC', muted: '#AFB7AA',
  line: '#3C4438', accent: '#EA826C', accentPressed: '#D56C55', moss: '#B3C19B',
  paleMoss: '#323D2A', error: '#F1998B', white: '#FFFFFF', black: '#000000', note: '#383327', pending: '#DBB777', errorSurface: '#452A28', onAccent: '#171917', onError: '#171917',
};
export const colors = Object.fromEntries(Object.entries(light).map(([key, value]) => [key,
  Platform.OS === 'ios' ? DynamicColorIOS({ light: value, dark: dark[key as keyof typeof light] }) : value,
])) as Record<keyof typeof light, ColorValue>;

export const typography = StyleSheet.create({
  display: { color: colors.ink, fontSize: 46, lineHeight: 47, fontWeight: '700', letterSpacing: -1.8 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
});
