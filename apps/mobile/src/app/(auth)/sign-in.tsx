import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, Button, Field, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { typography } from '../../theme.ts';

export default function SignIn() {
  const { login } = useSession();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { setLoading(true); setError(''); try { await login({ email: email.trim(), password }); router.replace('/(app)/collection'); } catch (value) { setError((value as Error).message); } finally { setLoading(false); } };
  return <Screen keyboard><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Brand compact /><View style={styles.heading}><Text style={typography.title}>Welcome back.</Text><Text style={typography.body}>Open the collection you already started.</Text></View><View style={styles.form}><Field label="Email" value={email} onChangeText={setEmail} textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /><Field label="Password" value={password} onChangeText={setPassword} textContentType="password" secureTextEntry returnKeyType="done" onSubmitEditing={submit} /><Message error>{error}</Message><Button label="Sign in" onPress={submit} loading={loading} disabled={!email || !password} /><Button label="Use recovery code" secondary onPress={() => router.push('/(auth)/recover')} /><Button label="Back" secondary onPress={() => router.back()} /></View></ScrollView></Screen>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 24, gap: 42 }, heading: { gap: 10 }, form: { gap: 12 } });
