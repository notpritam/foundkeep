import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../session/SessionProvider.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { colors } from '../../theme.ts';

export const unstable_settings = { initialRouteName: '(tabs)' };
export default function AppLayout() {
  const { ready, account } = useSession();
  const motion = useMotionAllowed();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.moss} /></View>;
  if (!account) return <Redirect href="/(auth)/sign-in" />;
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTintColor: colors.ink, headerShadowVisible: false, contentStyle: { backgroundColor: colors.paper }, animation: motion ? 'default' : 'fade', headerBackButtonDisplayMode: 'minimal' }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="capture/[id]" options={{ title: 'Saved item' }} />
    <Stack.Screen name="batch/[id]" options={{ title: 'Saved together' }} />
    <Stack.Screen name="new-note" options={{ title: 'New note', presentation: 'modal' }} />
    <Stack.Screen name="onboarding" options={{ title: 'Save from anywhere', presentation: 'modal' }} />
  </Stack>;
}
