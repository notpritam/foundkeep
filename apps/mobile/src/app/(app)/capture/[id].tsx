import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Capture } from '../../../api/types.ts';
import { CapturePreview } from '../../../components/CapturePreview.tsx';
import { EditCaptureSheet } from '../../../components/EditCaptureSheet.tsx';
import { Shimmer } from '../../../components/Shimmer.tsx';
import { Button, Message, Screen } from '../../../components/ui.tsx';
import { captureTitle } from '../../../collection/model.ts';
import { useSession } from '../../../session/SessionProvider.tsx';
import { colors, typography } from '../../../theme.ts';

const readableBytes = (value: number) => value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1048576).toFixed(1)} MB`;
const date = (value?: number | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Unknown';
function Row({ label, value }: { label: string; value?: string | number | null }) { if (value === null || value === undefined || value === '') return null; return <View style={styles.row}><Text style={typography.label}>{label}</Text><Text selectable style={styles.rowValue}>{String(value)}</Text></View>; }

import FoundkeepShared from '../../../../modules/foundkeep-shared/src';

export default function CaptureDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { client } = useSession(); const [capture, setCapture] = useState<Capture | null>(null); const [error, setError] = useState(''); const [opening, setOpening] = useState(false);
  const [editing, setEditing] = useState<Capture | null>(null);
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  pending.current = capture?.status === 'pending' || capture?.status === 'processing';
  useFocusEffect(useCallback(() => {
    let live = true, request = 0;
    let inFlight = false;
    setCapture(null); setError('');
    const load = async (reload = false, replace = false) => {
      if (inFlight && !replace) return;
      inFlight = true;
      const current = ++request;
      try {
        const value = await client.getCapture(id, { reload });
        if (live && current === request) { setCapture(value.capture); setError(''); }
      } catch (value) {
        if (live && current === request) setError((value as Error).message);
      } finally { if (current === request) inFlight = false; }
    };
    void load();
    const unsubscribe = client.subscribeInvalidation(() => void load(true, true));
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void load(true); });
    const poll = setInterval(() => { if (AppState.currentState === 'active' && pending.current) void load(true); }, 5_000);
    return () => { live = false; request++; clearInterval(poll); unsubscribe(); appState.remove(); };
  }, [client, id, retry]));
  const remove = () => Alert.alert('Delete this capture?', 'This permanently removes it from your Foundkeep account.', [{ text: 'Keep it', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await client.deleteCapture(id); router.replace('/(app)/(tabs)/collection'); } catch (value) { setError((value as Error).message); } } }]);
  const openFile = async () => {
    if (!capture?.fileName) return;
    setOpening(true); setError('');
    try {
      const localUrl = await FoundkeepShared.downloadCaptureFile(capture.id, capture.fileName);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
      await Sharing.shareAsync(localUrl, { dialogTitle: capture.fileName, mimeType: capture.fileMime || undefined });
    } catch (value) { setError((value as Error).message || 'Foundkeep could not open this file.'); }
    finally { setOpening(false); }
  };
  if (!capture) return <Screen top={false}><View style={styles.loading}>{error ? <><Message error>{error}</Message><Button label="Try again" secondary onPress={() => setRetry(value => value + 1)} /></> : <View accessibilityRole="progressbar" accessibilityLabel="Loading saved item" style={{ gap: 22 }}><Shimmer style={{ height: 240, borderRadius: 14 }} /><Shimmer style={{ height: 30, width: '85%', borderRadius: 6 }} /><Shimmer style={{ height: 18, width: '60%', borderRadius: 4 }} /></View>}</View></Screen>;
  const source = capture.provenance?.pageUrl || capture.sourceUrl;
  return <Screen top={false}><ScrollView contentContainerStyle={styles.page}>{!['note', 'selection'].includes(capture.type) ? <CapturePreview capture={capture} contain={capture.type === 'image' || capture.type === 'screenshot'} style={{ borderRadius: 14 }} /> : null}<View style={styles.hero}><Text style={typography.label}>{capture.type}</Text><Text style={typography.title}>{captureTitle(capture)}</Text><Text style={typography.small}>Saved {date(capture.capturedAt)}</Text></View>{pending.current ? <Message>Saved. Your details are being prepared.</Message> : capture.status === 'failed' ? <Message>Saved safely. Some details could not be prepared.</Message> : null}<Button label="Edit and organize" secondary onPress={() => setEditing(capture)} />{capture.batchId ? <Button label="View items saved together" secondary onPress={() => router.push({ pathname: '/(app)/batch/[id]', params: { id: capture.batchId! } })} /> : null}{source ? <Button label="Open original source" secondary onPress={() => void Linking.openURL(source).catch(() => setError('This source could not be opened.'))} /> : null}{capture.fileName ? <><View style={styles.file}><Ionicons name={capture.type === 'audio' ? 'musical-notes-outline' : capture.type === 'video' ? 'videocam-outline' : 'document-outline'} size={28} color={colors.moss} /><View style={{ flex: 1 }}><Text style={styles.fileName}>{capture.fileName}</Text><Text style={typography.small}>{capture.fileMime || 'File'} · {readableBytes(capture.fileBytes)}</Text></View></View><Button label={opening ? 'Preparing file…' : 'Open or share file'} disabled={opening} onPress={() => void openFile()} /></> : null}{capture.selectionText ? <Row label="Highlight" value={capture.selectionText} /> : null}{capture.noteText ? <Row label="Note" value={capture.noteText} /> : null}{capture.summary ? <Row label="Summary" value={capture.summary} /> : null}{capture.articleText ? <Row label="Saved text" value={capture.articleText} /> : null}<Row label="Folder" value={capture.folder?.name} /><Row label="Your tags" value={capture.userTags?.map(tag => `#${tag}`).join('  ')} /><Row label="Suggested tags" value={capture.tags?.map(tag => `#${tag}`).join('  ')} /><View style={styles.origin}><Text style={typography.heading}>Original source</Text><Text style={typography.small}>Enough context to trace this item back to where it came from.</Text><Row label="Page" value={source} /><Row label="Canonical page" value={capture.provenance?.canonicalUrl} /><Row label="Original title" value={capture.provenance?.pageTitle} /><Row label="Publisher" value={capture.provenance?.siteName} /><Row label="Source app" value={capture.provenance?.sourceApplication} /><Row label="Original file" value={capture.provenance?.originalFileName} /><Row label="Declared type" value={capture.provenance?.declaredMime} /><Row label="Original size" value={capture.provenance?.byteSize ? readableBytes(capture.provenance.byteSize) : null} /></View><Message error>{error}</Message><Button label="Delete capture" secondary onPress={remove} /><Text style={styles.authNote}>Only you can access this saved item.</Text></ScrollView>{editing ? <EditCaptureSheet capture={editing} onClose={() => setEditing(null)} /> : null}</Screen>;
}
const styles = StyleSheet.create({ page: { padding: 22, paddingBottom: 48, gap: 20 }, loading: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 }, back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 }, backText: { color: colors.ink, fontSize: 15, fontWeight: '600' }, hero: { gap: 10, marginBottom: 8 }, file: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface }, fileName: { color: colors.ink, fontSize: 16, fontWeight: '700' }, row: { gap: 7, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line }, rowValue: { color: colors.ink, fontSize: 15, lineHeight: 23 }, origin: { gap: 4, padding: 18, borderRadius: 12, backgroundColor: colors.paleMoss }, authNote: { ...typography.small, textAlign: 'center' } });
