import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FrostedPanel } from '../../components/ScenicSurface.tsx';
import { Brand, Button, Field, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { typography } from '../../theme.ts';

export default function Recover() {
  const { recover } = useSession();
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { setLoading(true); setError(''); try { await recover({ email: email.trim(), recoveryCode: code.trim(), password }); router.replace('/(auth)/recovery-code'); } catch (value) { setError((value as Error).message); } finally { setLoading(false); } };
  return <Screen keyboard><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><Brand compact /><View style={styles.heading}><Text style={typography.title}>Recover your collection.</Text><Text style={typography.body}>Your recovery code replaces the old password and disconnects other devices.</Text></View><FrostedPanel style={styles.form}><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /><Field label="Recovery code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} /><Field label="New password" value={password} onChangeText={setPassword} secureTextEntry help="12 characters or more." /><Message error>{error}</Message><Button label="Recover account" onPress={submit} loading={loading} disabled={!email || !code || password.length < 12} /><Button label="Back" secondary onPress={() => router.back()} /></FrostedPanel></ScrollView></Screen>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 22, gap: 24 }, heading: { gap: 10 }, form: { gap: 16, marginHorizontal: -6 } });
