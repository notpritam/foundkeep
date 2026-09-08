import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Brand, Button, LegalFooter, Screen } from '../../components/ui.tsx';
import { colors, typography } from '../../theme.ts';

export default function Welcome() {
  const { width, fontScale } = useWindowDimensions();
  return <Screen><ScrollView contentContainerStyle={styles.page}><Brand compact />
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.collage, { height: Math.min(width * .62, 260) }]}>
      <Image source={require('../../../assets/images/welcome-room.webp')} style={styles.photo} resizeMode="cover" />
      <View style={styles.note}><Text style={styles.noteLabel}>A passing thought</Text><Text style={styles.noteText}>Make room for{`\n`}the good things.</Text><View style={styles.noteLine} /></View>
    </View>
    <View style={styles.hero}><Text style={[typography.display, { fontSize: fontScale > 1.4 ? 36 : 46 }]}>Found it?{`\n`}Keep it.</Text><Text style={[typography.body, styles.copy]}>Links, photos, words, and everything in between. One private collection.</Text></View>
    <View style={styles.actions}><Button label="Create your account" onPress={() => router.push('/(auth)/register')} /><Button label="I already have an account" secondary onPress={() => router.push('/(auth)/sign-in')} /><LegalFooter /></View>
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 18, paddingBottom: 28, gap: 28 }, hero: { gap: 16 }, copy: { maxWidth: 350, color: colors.muted }, actions: { gap: 10, marginTop: 'auto' },
  collage: { marginTop: 8, marginBottom: 0, justifyContent: 'center' }, photo: { width: '63%', height: '91%', borderRadius: 12, transform: [{ rotate: '-6deg' }] },
  note: { position: 'absolute', right: 0, bottom: 12, width: '49%', padding: 17, gap: 12, backgroundColor: colors.note, borderWidth: 1, borderColor: colors.line, borderRadius: 9, transform: [{ rotate: '7deg' }] }, noteLabel: { fontSize: 11, color: colors.muted }, noteText: { fontSize: 17, lineHeight: 24, color: colors.ink, fontWeight: '500' }, noteLine: { height: 2, width: 35, backgroundColor: colors.accent, marginTop: 8 },
});
