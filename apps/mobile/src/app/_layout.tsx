import { MotionProvider } from '../components/motion.tsx';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../session/SessionProvider.tsx';
import { colors, palettes } from '../theme.ts';
import { NavigationController } from '../linking/NavigationController.tsx';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const palette = palettes[scheme];
  const theme = { ...base, colors: { ...base.colors, primary: palette.accent, background: palette.paper, card: palette.paper, text: palette.ink, border: palette.line, notification: palette.accent } };
  return <ThemeProvider value={theme}><SessionProvider><MotionProvider><StatusBar style="auto" /><NavigationController /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'fade' }} /></MotionProvider></SessionProvider></ThemeProvider>;
}
