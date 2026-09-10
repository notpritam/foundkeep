import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Capture } from '../api/types.ts';
import { captureTitle } from '../collection/model.ts';
import { CapturePreview, captureIcons, captureLabels } from './CapturePreview.tsx';
import { colors } from '../theme.ts';
import { useMaterial } from './ScenicSurface.tsx';

export const GalleryCard = memo(function GalleryCard({ capture, onOpen }: { capture: Capture; onOpen: (capture: Capture) => void }) {
  const { opaque } = useMaterial();
  const written = capture.type === 'note' || capture.type === 'selection';
  const excerpt = capture.noteText || capture.selectionText || capture.summary || capture.articleText;
  let domain = '';
  try { domain = capture.sourceUrl ? new URL(capture.sourceUrl).hostname.replace(/^www\./, '') : ''; } catch {}
  const source = capture.provenance?.siteName || capture.provenance?.sourceApplication || domain || captureLabels[capture.type];
  const pending = capture.status === 'pending' || capture.status === 'processing';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${captureLabels[capture.type]} ${captureTitle(capture)}`} accessibilityHint={pending ? 'Saved. Details are being prepared.' : undefined} onPress={() => onOpen(capture)} style={({ pressed }) => [styles.card, { backgroundColor: opaque ? colors.surface : colors.glassCard }, written && styles.written, pressed && styles.pressed]}>
    {!written ? <CapturePreview capture={capture} /> : null}
    <View style={styles.copy}>
      <View style={styles.source}><Ionicons name={captureIcons[capture.type]} size={13} color={colors.muted} /><Text style={styles.sourceText} numberOfLines={1}>{source}</Text></View>
      <Text style={styles.title} numberOfLines={4}>{captureTitle(capture)}</Text>
      {written && excerpt && excerpt !== captureTitle(capture) ? <Text style={styles.excerpt} numberOfLines={6}>{excerpt}</Text> : null}
      {capture.folder ? <View style={styles.state}><Ionicons name="folder-outline" size={12} color={colors.accent} /><Text style={styles.sourceText} numberOfLines={1}>{capture.folder.name}</Text></View> : null}
      {capture.userTags?.length ? <Text style={styles.sourceText} numberOfLines={2}>{capture.userTags.slice(0, 2).map(tag => `#${tag}`).join('  ')}{capture.userTags.length > 2 ? ` +${capture.userTags.length - 2}` : ''}</Text> : null}
      {capture.batchId ? <View style={styles.state}><Ionicons name="layers-outline" size={12} color={colors.muted} /><Text style={styles.sourceText}>Saved together</Text></View> : null}
      {pending ? <View style={styles.state}><Ionicons name="time-outline" size={12} color={colors.pending} /><Text style={[styles.stateText, { color: colors.pending }]}>Preparing details</Text></View> : capture.status === 'failed' ? <Text style={styles.stateText}>Saved · details unavailable</Text> : null}
    </View>
  </Pressable>;
});
const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.glassEdge, backgroundColor: colors.surface, overflow: 'hidden' },
  written: { backgroundColor: colors.note }, pressed: { opacity: .84, transform: [{ scale: .985 }] }, copy: { padding: 14, gap: 9 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 5 }, sourceText: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  title: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -.2 },
  excerpt: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingBottom: 5 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 4 }, stateText: { fontSize: 12, color: colors.muted },
});
