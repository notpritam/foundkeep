import { DynamicColorIOS, Platform, StyleSheet, type ColorValue } from 'react-native';

const light = {
  paper: '#F0F6F8', surface: '#FFFFFF', ink: '#182F3A', muted: '#405D6B',
  line: '#CADCE4', accent: '#086CA8', accentPressed: '#075584',
  accentSoft: '#DFEFFA', error: '#A52B22', white: '#FFFFFF', black: '#000000',
  note: '#E8F5E5', pending: '#76551B', errorSurface: '#F8E8E5', onAccent: '#FFFFFF', onError: '#FFFFFF',
  glass: 'rgba(255,255,255,0.82)', glassCard: 'rgba(255,255,255,0.92)', glassEdge: 'rgba(255,255,255,0.88)',
  sceneWash: 'rgba(240,246,248,0.76)', sceneShade: 'rgba(4,47,75,0.30)', shadow: '#194A62',
};
const dark: typeof light = {
  paper: '#10232F', surface: '#193440', ink: '#EFF7FB', muted: '#B2C8D2',
  line: '#38525E', accent: '#85CEF4', accentPressed: '#B2E0F8',
  accentSoft: '#214A60', error: '#F2A79D', white: '#FFFFFF', black: '#000000',
  note: '#253E37', pending: '#E2C887', errorSurface: '#4B302F', onAccent: '#092A3E', onError: '#261B19',
  glass: 'rgba(21,46,59,0.88)', glassCard: 'rgba(25,52,64,0.95)', glassEdge: 'rgba(168,211,231,0.23)',
  sceneWash: 'rgba(9,29,42,0.88)', sceneShade: 'rgba(3,24,40,0.35)', shadow: '#000E18',
};
export const palettes = { light, dark };
export const colors = Object.fromEntries(Object.entries(light).map(([key, value]) => [key,
  Platform.OS === 'ios' ? DynamicColorIOS({ light: value, dark: dark[key as keyof typeof light] })
    // RN Web cannot compose shadowOpacity with a CSS variable color.
    : Platform.OS === 'web' && key !== 'shadow' ? `var(--foundkeep-${key}, ${value})` : value,
])) as Record<keyof typeof light, ColorValue>;

export const typography = StyleSheet.create({
  display: { color: colors.ink, fontSize: 46, lineHeight: 47, fontWeight: '700', letterSpacing: -1.8 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
});
