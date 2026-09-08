import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Brand, Button, Screen } from '../../components/ui.tsx';
import { colors, typography } from '../../theme.ts';

export default function Welcome() {
  return <Screen><View style={styles.page}><Brand /><View style={styles.hero}><Text style={typography.label}>Your private collection</Text><Text style={typography.display}>Found it?{`\n`}Keep it.</Text><Text style={[typography.body, styles.copy]}>Save links, words, photos, documents, audio and video from any app. The source stays attached.</Text></View><View style={styles.actions}><Button label="Create your account" onPress={() => router.push('/(auth)/register')} /><Button label="I already have an account" secondary onPress={() => router.push('/(auth)/sign-in')} /><Text style={styles.privacy}>Your collection is private to your account. Foundkeep only receives items you choose to share.</Text></View></View></Screen>;
}
const styles = StyleSheet.create({ page: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 }, hero: { flex: 1, justifyContent: 'center', gap: 18 }, copy: { maxWidth: 350, color: colors.muted }, actions: { gap: 12 }, privacy: { ...typography.small, textAlign: 'center', marginTop: 5 } });
