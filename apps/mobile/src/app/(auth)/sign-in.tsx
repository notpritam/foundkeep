import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AuthOptions } from '../../components/AuthOptions.tsx';
import { Brand, Button, Field, LegalFooter, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { colors, typography } from '../../theme.ts';

export default function SignIn() {
  const { login } = useSession();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { if (loading || !email.trim() || !password) return; setLoading(true); setError(''); try { await login({ email: email.trim(), password }); } catch (value) { setError((value as Error).message); } finally { setLoading(false); } };
  return <Screen keyboard bottom><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Brand compact /><View style={styles.heading}><Text style={typography.display}>Your collection awaits.</Text><Text style={styles.subtitle}>Keep the things you want to come back to.</Text></View><View style={styles.form}><AuthOptions><Field label="Email" autoFocus value={email} onChangeText={setEmail} textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /><Field label="Password" value={password} onChangeText={setPassword} textContentType="password" secureTextEntry returnKeyType="done" onSubmitEditing={submit} /><Message error>{error}</Message><Button label="Sign in" onPress={submit} loading={loading} disabled={!email || !password} /><Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/recover')} style={styles.textButton}><Text style={styles.link}>Use a recovery code</Text></Pressable></AuthOptions><LegalFooter /><Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/register')} style={styles.textButton}><Text style={styles.link}>New here? Create an account</Text></Pressable></View></ScrollView></Screen>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24, gap: 32, maxWidth: 480, width: '100%', alignSelf: 'center' },
  heading: { gap: 12, marginTop: 42, marginBottom: 12 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 290 },
  form: { gap: 12 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
