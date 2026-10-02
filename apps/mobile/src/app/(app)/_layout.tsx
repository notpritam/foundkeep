import { BillingProvider } from '../../billing/BillingProvider.tsx';
import { Redirect, router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { firstRun } from '../../first-run/deviceFlags.ts';
import { useSession } from '../../session/SessionProvider.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { useAppearance } from '../../appearance/AppearanceProvider.tsx';
import { palettes } from '../../theme.ts';

export const unstable_settings = { initialRouteName: '(tabs)' };
export default function AppLayout() {
  const { ready, account } = useSession();
  const motion = useMotionAllowed();
  const { scheme } = useAppearance();
  const palette = palettes[scheme];
  // Right after signing in, first run, once on this device.
  useEffect(() => {
    if (!account) return;
    let live = true;
    void firstRun.takeAfterSignIn().then(due => { if (live && due) router.push('/(app)/onboarding'); });
    return () => { live = false; };
  }, [account?.id]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.accent} /></View>;
  if (!account) return <Redirect href="/(auth)/sign-in" />;
  return <BillingProvider><Stack screenOptions={{ headerStyle: { backgroundColor: palette.paper }, headerTintColor: palette.accent, headerTitleStyle: { color: palette.ink, fontSize: 17, fontWeight: '600' }, headerShadowVisible: false, contentStyle: { backgroundColor: palette.paper }, animation: motion ? 'default' : 'fade', headerBackButtonDisplayMode: 'minimal' }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="capture/[id]" options={{ title: 'Saved item' }} />
    <Stack.Screen name="batch/[id]" options={{ title: 'Saved together' }} />
    <Stack.Screen name="new-note" options={{ title: 'New note', presentation: 'modal' }} />
    <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
    <Stack.Screen name="subscription" options={{ title: 'Your plan' }} />
  </Stack></BillingProvider>;
}
