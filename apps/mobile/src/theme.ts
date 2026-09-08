import { StyleSheet } from 'react-native';

export const colors = {
  paper: '#F3F3F0', surface: '#FAFAF7', ink: '#171917', muted: '#687064',
  line: '#D7DBD1', accent: '#C63B23', accentPressed: '#A82E1B', moss: '#6B7553',
  paleMoss: '#E2E6DA', error: '#A52B22', white: '#FFFFFF', black: '#000000',
};

export const typography = StyleSheet.create({
  display: { color: colors.ink, fontSize: 46, lineHeight: 47, fontWeight: '700', letterSpacing: -1.8 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  heading: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  small: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
});
