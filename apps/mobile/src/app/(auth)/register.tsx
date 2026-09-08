import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, Button, Field, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { colors, typography } from '../../theme.ts';

export default function Register() {
  const { register } = useSession();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!name.trim() || !email.trim() || password.length < 12) { setError('Enter your name, a valid email, and a password with at least 12 characters.'); return; }
    setLoading(true); setError('');
    try { await register({ name: name.trim(), email: email.trim(), password }); router.replace('/(auth)/recovery-code'); }
    catch (value) { setError((value as Error).message); }
    finally { setLoading(false); }
  };
  return <Screen keyboard><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Brand compact /><View style={styles.heading}><Text style={typography.title}>Start your collection.</Text><Text style={typography.body}>One account keeps every browser and iPhone share together.</Text></View><View style={styles.form}><Field label="Name" value={name} onChangeText={setName} textContentType="name" autoCapitalize="words" returnKeyType="next" /><Field label="Email" value={email} onChangeText={setEmail} textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" /><Field label="Password" value={password} onChangeText={setPassword} textContentType="newPassword" secureTextEntry help="12 characters or more." returnKeyType="done" onSubmitEditing={submit} /><Message error>{error}</Message><Button label="Create account" onPress={submit} loading={loading} /><Button label="Back" secondary onPress={() => router.back()} /></View></ScrollView></Screen>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 24, gap: 42 }, heading: { gap: 10 }, form: { gap: 12 }, });
