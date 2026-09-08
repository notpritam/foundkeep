import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../session/SessionProvider.tsx';
import { colors } from '../theme.ts';

export default function RootLayout() {
  return <SessionProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'fade' }} /></SessionProvider>;
}
