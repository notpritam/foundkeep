import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Brand, Button, LegalFooter, Screen } from '../../components/ui.tsx';
import { GlassSurface } from '../../components/ScenicSurface.tsx';
import { colors } from '../../theme.ts';

export default function Welcome() {
  const { fontScale, height } = useWindowDimensions();
  return <Screen immersive><StatusBar style="light" /><ScrollView contentContainerStyle={styles.page}>
    <Brand compact inverse />
    <View style={[styles.hero, { paddingTop: height < 700 ? 24 : 50 }]}>
      <Text style={[styles.title, { fontSize: fontScale > 1.4 ? 40 : 52 }]}>Found it?{`\n`}Keep it.</Text>
      <Text style={styles.copy}>Let your mind wander.{`\n`}Keep the things worth finding again.</Text>
    </View>
    <View style={styles.space} />
    <GlassSurface style={styles.actions}>
      <View style={styles.intro}><Text style={styles.label}>YOUR OWN LITTLE COLLECTION</Text><Text style={styles.description}>Links, photos, words, and everything in between.</Text></View>
      <Button label="Create your account" onPress={() => router.push('/(auth)/register')} />
      <Button label="I already have an account" secondary onPress={() => router.push('/(auth)/sign-in')} />
      <LegalFooter />
    </GlassSurface>
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30, gap: 24 },
  hero: { gap: 18, paddingHorizontal: 4 },
  title: { color: '#FFFFFF', lineHeight: 55, fontWeight: '700', letterSpacing: -2.1, textShadowColor: 'rgba(4,40,65,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 16 },
  copy: { color: '#FFFFFF', fontSize: 17, lineHeight: 25, maxWidth: 310 },
  space: { flex: 1, minHeight: 36 },
  actions: { padding: 18, gap: 10, borderRadius: 28 },
  intro: { gap: 8, paddingBottom: 6 },
  label: { color: colors.accent, fontSize: 10, lineHeight: 15, letterSpacing: 1.25, fontWeight: '700' },
  description: { color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '500' },
});
