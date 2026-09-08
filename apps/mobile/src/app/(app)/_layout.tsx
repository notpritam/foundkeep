import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '../../theme.ts';

export default function AppLayout() {
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
