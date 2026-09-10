import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { OrganizationPicker, type OrganizationChoice } from '../../components/OrganizationPicker.tsx';
import { Button, Field, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { typography } from '../../theme.ts';

export default function NewNote() {
  const { client, policy, updateRequired } = useSession(); const [note, setNote] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [organization, setOrganization] = useState<OrganizationChoice>({ folderId: null, userTags: [] });
  const save = async () => {
    if (loading) return;
    if (!policy.capture.note || updateRequired) { setError('New notes are temporarily unavailable.'); return; }
    if (!note.trim()) { setError('Write something before saving.'); return; }
    setLoading(true); setError('');
    try { await client.createNote({ clientId: Crypto.randomUUID(), noteText: note.trim(), capturedAt: Date.now(), folderId: organization.folderId, userTags: organization.userTags }); setNote(''); router.dismissTo('/(app)/(tabs)/collection'); }
    catch (value) { setError((value as Error).message); }
    finally { setLoading(false); }
  };
  return <Screen keyboard={Platform.OS !== 'ios'} top={false}><ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}><View style={styles.heading}><Text style={typography.label}>A thought worth keeping</Text><Text style={typography.body}>Get it down before it gets away.</Text></View><Field label="Your note" style={styles.editor} value={note} onChangeText={setNote} multiline maxLength={policy.limits.textCharacters} autoFocus placeholder="Get it down before it gets away…" help={`${note.length.toLocaleString()} of ${policy.limits.textCharacters.toLocaleString()} characters`} /><OrganizationPicker value={organization} onChange={setOrganization} /><Message error>{error}</Message><Button label="Save note" onPress={save} loading={loading} disabled={!policy.capture.note || updateRequired} /><Button label="Cancel" secondary onPress={() => router.dismissTo('/(app)/(tabs)/collection')} /></ScrollView></Screen>;
}
const styles = StyleSheet.create({ editor: { minHeight: 260, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, fontSize: 18, lineHeight: 28 }, page: { flexGrow: 1, padding: 24, gap: 18 }, heading: { marginTop: 18, marginBottom: 18, gap: 10 } });
