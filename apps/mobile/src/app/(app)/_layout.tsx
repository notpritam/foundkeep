import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../../session/SessionProvider.tsx';
import { colors } from '../../theme.ts';

export default function AppLayout() {
  const { ready, account } = useSession();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
  if (!account) return <Redirect href="/(auth)/sign-in" />;
  return <Tabs screenOptions={{
    headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 84, paddingTop: 8 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700', paddingBottom: 8 }, sceneStyle: { backgroundColor: colors.paper },
  }}>
    <Tabs.Screen name="collection" options={{ title: 'Collection', tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="new-note" options={{ title: 'New note', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="capture/[id]" options={{ href: null }} />
  </Tabs>;
}
