import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AuthOptions } from '../../components/AuthOptions.tsx';
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
    try { await register({ name: name.trim(), email: email.trim(), password }); }
    catch (value) { setError((value as Error).message); }
    finally { setLoading(false); }
  };
  return <Screen keyboard bottom><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Brand compact /><View style={styles.heading}><Text style={typography.display}>Make it yours.</Text><Text style={styles.subtitle}>Good finds. One home.</Text></View><View style={styles.form}><AuthOptions><Field label="Name" autoFocus value={name} onChangeText={setName} textContentType="name" autoCapitalize="words" returnKeyType="next" /><Field label="Email" value={email} onChangeText={setEmail} textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" /><Field label="Password" value={password} onChangeText={setPassword} textContentType="newPassword" secureTextEntry help="12 characters or more." returnKeyType="done" onSubmitEditing={submit} /><Message error>{error}</Message><Button label="Create account" onPress={submit} loading={loading} /></AuthOptions><LegalFooter /><Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-in')} style={styles.textButton}><Text style={styles.link}>Already have an account? Sign in</Text></Pressable></View></ScrollView></Screen>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24, gap: 32, maxWidth: 480, width: '100%', alignSelf: 'center' },
  heading: { gap: 12, marginTop: 42, marginBottom: 12 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 290 },
  form: { gap: 12 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
