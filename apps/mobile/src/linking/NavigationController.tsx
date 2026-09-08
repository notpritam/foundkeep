import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { useSession } from '../session/SessionProvider.tsx';
import { notificationLink } from '../notifications/notifications.ts';
import { parseFoundkeepLink } from './deepLinks.ts';

export function NavigationController() {
  const { ready, account, setPendingRoute } = useSession();
  const lastOpen = useRef<{ url: string; at: number } | null>(null);
  const open = useCallback((url: string | null) => {
    if (!ready || !url) return;
    const now = Date.now();
    if (lastOpen.current?.url === url && now - lastOpen.current.at < 1_000) return;
    const target = parseFoundkeepLink(url);
    if (!target) return;
    lastOpen.current = { url, at: now };
    if (target.requiresAuth && !account) {
      setPendingRoute(target.href);
      router.replace('/(auth)/sign-in');
      return;
    }
    if (!target.requiresAuth && account) {
      router.replace('/(app)/collection');
      return;
    }
    router.replace(target.href as Href);
  }, [account, ready, setPendingRoute]);

  useEffect(() => {
    if (!ready) return;
    void Linking.getInitialURL().then(open);
    const linkSubscription = Linking.addEventListener('url', event => open(event.url));
    const responseSubscription = Platform.OS === 'web' ? null : Notifications.addNotificationResponseReceivedListener(response => open(notificationLink(response)));
    if (Platform.OS !== 'web') {
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse) {
        open(notificationLink(lastResponse));
        Notifications.clearLastNotificationResponse();
      }
    }
    return () => { linkSubscription.remove(); responseSubscription?.remove(); };
  }, [open, ready]);
  return null;
}
