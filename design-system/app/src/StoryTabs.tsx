// The tab shell around a tab screen: the app's real DockProvider and
// FloatingDock, given the navigation state expo-router's Tabs would pass.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { action } from 'storybook/actions';
import { DockProvider, FloatingDock } from '../../../apps/mobile/src/components/FloatingDock.tsx';

const routes = [{ key: 'collection', name: 'collection', params: undefined }, { key: 'settings', name: 'settings', params: undefined }];
const titles: Record<string, string> = { collection: 'Gallery', settings: 'You' };

export function StoryTabs({ active, children }: { active: 'collection' | 'settings'; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const state = { key: 'tabs', index: routes.findIndex(r => r.name === active), routes, routeNames: routes.map(r => r.name), type: 'tab', stale: false, history: [] };
  const descriptors = Object.fromEntries(routes.map(route => [route.key, { route, options: { title: titles[route.name] }, navigation: {}, render: () => null }]));
  const navigation = { emit: () => ({ defaultPrevented: false }), navigate: action('tabs.navigate') };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = { state, descriptors, navigation, insets } as any;
  return <DockProvider><View style={{ flex: 1 }}>{children}<FloatingDock {...props} /></View></DockProvider>;
}
