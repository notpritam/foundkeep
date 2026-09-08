import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../session/SessionProvider.tsx';
import { colors } from '../theme.ts';

export default function Index() {
  const { ready, account, recoveryCode } = useSession();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}><ActivityIndicator color={colors.accent} /></View>;
  if (recoveryCode) return <Redirect href="/(auth)/recovery-code" />;
  return <Redirect href={account ? '/(app)/(tabs)/collection' : '/(auth)/welcome'} />;
}
