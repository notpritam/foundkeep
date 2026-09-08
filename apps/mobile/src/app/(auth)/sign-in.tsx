import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, Button, Field, LegalFooter, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { colors, typography } from '../../theme.ts';

export default function SignIn() {
  const { login, consumePendingRoute } = useSession();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { if (loading || !email.trim() || !password) return; setLoading(true); setError(''); try { await login({ email: email.trim(), password }); router.replace((consumePendingRoute() || '/(app)/(tabs)/collection') as Href); } catch (value) { setError((value as Error).message); } finally { setLoading(false); } };
  return <Screen keyboard><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Brand compact /><View style={styles.heading}><Text style={typography.title}>Welcome back.</Text><Text style={typography.body}>Your good finds are right here.</Text></View><View style={styles.form}><Field label="Email" value={email} onChangeText={setEmail} textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /><Field label="Password" value={password} onChangeText={setPassword} textContentType="password" secureTextEntry returnKeyType="done" onSubmitEditing={submit} /><Message error>{error}</Message><Button label="Sign in" onPress={submit} loading={loading} disabled={!email || !password} /><Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/recover')} style={styles.textButton}><Text style={styles.link}>Forgot password? Use your recovery code</Text></Pressable><LegalFooter /><Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/register')} style={styles.textButton}><Text style={styles.link}>New here? Create an account</Text></Pressable></View></ScrollView></Screen>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 24, gap: 32 }, heading: { gap: 8, marginTop: 24 }, form: { gap: 16 }, textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, link: { color: colors.muted, fontSize: 13, textAlign: 'center' } });
