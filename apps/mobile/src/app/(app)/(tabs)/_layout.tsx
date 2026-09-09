import { Tabs } from 'expo-router';
import { DockProvider, FloatingDock } from '../../../components/FloatingDock.tsx';
import { colors } from '../../../theme.ts';
export default function CollectionTabs() {
  return <DockProvider><Tabs tabBar={props => <FloatingDock {...props} />} screenOptions={{ headerShown: false, tabBarStyle: { position: 'absolute' }, sceneStyle: { backgroundColor: colors.paper } }}>
    <Tabs.Screen name="collection" options={{ title: 'Gallery' }} />
    <Tabs.Screen name="settings" options={{ title: 'You' }} />
  </Tabs></DockProvider>;
}
