import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, Button, Field, LegalFooter, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { colors, typography } from '../../theme.ts';

export default function Register() {
  const { register } = useSession();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (loading) return;
    if (!name.trim() || !email.trim() || password.length < 12) { setError('Enter your name, a valid email, and a password with at least 12 characters.'); return; }
    setLoading(true); setError('');
    try { await register({ name: name.trim(), email: email.trim(), password }); router.replace('/(auth)/recovery-code'); }
    catch (value) { setError((value as Error).message); }
    finally { setLoading(false); }
  };
  return <Screen keyboard><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Brand compact /><View style={styles.heading}><Text style={typography.title}>Start your collection.</Text><Text style={typography.body}>A place for everything you want to keep.</Text></View><View style={styles.form}><Field label="Name" value={name} onChangeText={setName} textContentType="name" autoCapitalize="words" returnKeyType="next" /><Field label="Email" value={email} onChangeText={setEmail} textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" /><Field label="Password" value={password} onChangeText={setPassword} textContentType="newPassword" secureTextEntry help="12 characters or more." returnKeyType="done" onSubmitEditing={submit} /><Message error>{error}</Message><Button label="Create account" onPress={submit} loading={loading} /><LegalFooter /><Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-in')} style={styles.textButton}><Text style={styles.link}>Already have an account? Sign in</Text></Pressable></View></ScrollView></Screen>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 24, gap: 32 }, heading: { gap: 8, marginTop: 12 }, form: { gap: 16 }, textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, link: { color: colors.muted, fontSize: 13, textAlign: 'center' } });
