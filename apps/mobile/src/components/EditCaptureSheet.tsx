import { AdaptiveText as Text } from './AdaptiveText.tsx';
import { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { Capture } from '../api/types.ts';
import { useSession } from '../session/SessionProvider.tsx';
import { colors, typography } from '../theme.ts';
import { Button, Field, Message, Screen } from './ui.tsx';
import { OrganizationPicker, type OrganizationChoice } from './OrganizationPicker.tsx';
import { useMotionAllowed } from './motion.tsx';

export function EditCaptureSheet({ capture, onClose }: { capture: Capture; onClose: () => void }) {
  const { client } = useSession();
  const motion = useMotionAllowed();
  const [title, setTitle] = useState(capture.sourceTitle || '');
  const [note, setNote] = useState(capture.noteText || '');
  const [organization, setOrganization] = useState<OrganizationChoice>({ folderId: capture.folder?.id || capture.folderId || null, folderName: capture.folder?.name, userTags: capture.userTags || [] });
  const [revision, setRevision] = useState(capture.updatedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const save = async () => {
    if (!capture || saving) return;
    setSaving(true); setError('');
    try { await client.updateCapture(capture.id, { sourceTitle: title.trim() || null, noteText: note.trim() || null, expectedUpdatedAt: revision, folderId: organization.folderId, userTags: organization.userTags }); onClose(); }
    catch (value) {
      const changed = (value as { code?: string }).code === 'capture_changed';
      setConflict(changed); setError(changed ? 'This item changed on another device or finished processing. Reload the latest version before editing.' : (value as Error).message);
    } finally { setSaving(false); }
  };
  const reload = async () => {
    if (!capture || saving) return;
    setSaving(true);
    try { const { capture: latest } = await client.getCapture(capture.id, { reload: true }); setOrganization({ folderId: latest.folder?.id || latest.folderId || null, folderName: latest.folder?.name, userTags: latest.userTags || [] }); setTitle(latest.sourceTitle || ''); setNote(latest.noteText || ''); setRevision(latest.updatedAt); setConflict(false); setError(''); }
    catch (value) { setError((value as Error).message); }
    finally { setSaving(false); }
  };
  return <Modal visible presentationStyle="pageSheet" animationType={motion ? 'slide' : 'none'} onRequestClose={() => { if (!saving) onClose(); }}>
    <Screen keyboard={Platform.OS !== 'ios'}><ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.heading}><Text style={typography.title}>Make it yours.</Text><Text style={typography.small}>Edit the title or add a note. The original source stays attached.</Text></View><Field label="Title" value={title} onChangeText={setTitle} maxLength={1000} /><Field label="Your note" value={note} onChangeText={setNote} multiline maxLength={50_000} /><OrganizationPicker manageFolders={false} value={organization} onChange={setOrganization} /><Message error>{error}</Message>{conflict ? <Button label="Reload latest version" secondary onPress={() => void reload()} loading={saving} /> : <Button label="Save changes" onPress={() => void save()} loading={saving} />}<Button label="Cancel" secondary disabled={saving} onPress={onClose} /></ScrollView></Screen>
  </Modal>;
}
const styles = StyleSheet.create({ page: { padding: 24, paddingBottom: 48, gap: 20 }, heading: { gap: 10, paddingVertical: 12 } });
