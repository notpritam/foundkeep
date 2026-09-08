import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Field, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { typography } from '../../theme.ts';

export default function NewNote() {
  const { client, policy, updateRequired } = useSession(); const [note, setNote] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!policy.capture.note || updateRequired) { setError('New notes are temporarily unavailable.'); return; }
    if (!note.trim()) { setError('Write something before saving.'); return; }
    setLoading(true); setError('');
    try { await client.createNote({ clientId: Crypto.randomUUID(), noteText: note.trim(), capturedAt: Date.now() }); setNote(''); router.replace('/(app)/collection'); }
    catch (value) { setError((value as Error).message); }
    finally { setLoading(false); }
  };
  return <Screen keyboard><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><View style={styles.heading}><Text style={typography.label}>A thought worth keeping</Text><Text style={typography.title}>New note.</Text><Text style={typography.body}>Add it directly to the same collection as everything you share.</Text></View><Field label="Your note" value={note} onChangeText={setNote} multiline maxLength={policy.limits.textCharacters} autoFocus placeholder="Get it down before it gets away…" help={`${note.length.toLocaleString()} of ${policy.limits.textCharacters.toLocaleString()} characters`} /><Message error>{error}</Message><Button label="Save note" onPress={save} loading={loading} disabled={!policy.capture.note || updateRequired} /><Button label="Cancel" secondary onPress={() => router.replace('/(app)/collection')} /></ScrollView></Screen>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 24, gap: 18 }, heading: { marginTop: 18, marginBottom: 18, gap: 10 } });
