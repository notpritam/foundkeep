import { DynamicColorIOS, Platform, StyleSheet, type ColorValue } from 'react-native';

const light = {
  paper: '#F7F6FA', surface: '#FFFFFF', ink: '#211A2D', muted: '#655D71',
  line: '#E2DDEA', accent: '#7041C7', accentPressed: '#5B2CA9',
  accentSoft: '#EEE6FB', error: '#A52B22', white: '#FFFFFF', black: '#000000',
  note: '#EEE6FB', pending: '#806024', errorSurface: '#F5E0DD', onAccent: '#FFFFFF', onError: '#FFFFFF',
};
const dark: typeof light = {
  paper: '#19161F', surface: '#231F2B', ink: '#F3EEFB', muted: '#B8ADC8',
  line: '#40364E', accent: '#BC98FA', accentPressed: '#A47CE6',
  accentSoft: '#37294C', error: '#F1998B', white: '#FFFFFF', black: '#000000',
  note: '#37294C', pending: '#DBB777', errorSurface: '#452A28', onAccent: '#211A2D', onError: '#211A2D',
};
export const palettes = { light, dark };
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
