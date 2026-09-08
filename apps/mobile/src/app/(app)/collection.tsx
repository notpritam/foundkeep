import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Capture, CaptureType } from '../../api/types.ts';
import { Brand, Message, Screen } from '../../components/ui.tsx';
import { captureTitle, filterCaptures, groupCaptures } from '../../collection/model.ts';
import { useSession } from '../../session/SessionProvider.tsx';
import { colors, typography } from '../../theme.ts';

const filters: Array<{ type: CaptureType | null; label: string }> = [
  { type: null, label: 'Everything' }, { type: 'bookmark', label: 'Links' }, { type: 'image', label: 'Images' },
  { type: 'document', label: 'Documents' }, { type: 'audio', label: 'Audio' }, { type: 'video', label: 'Video' }, { type: 'note', label: 'Notes' }, { type: 'file', label: 'Files' },
];
const kindLabel = (type: CaptureType) => ({ bookmark: 'Link', selection: 'Highlight', screenshot: 'Screenshot', image: 'Image', document: 'Document', audio: 'Audio', video: 'Video', note: 'Note', tweet: 'Post', file: 'File' }[type]);
const formatDate = (value: number) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));

function CaptureCard({ capture, groupCount }: { capture: Capture; groupCount: number }) {
  const excerpt = capture.selectionText || capture.noteText || capture.summary || capture.articleText;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${kindLabel(capture.type)} ${captureTitle(capture)}`} onPress={() => router.push({ pathname: '/(app)/capture/[id]', params: { id: capture.id } })} style={({ pressed }) => [styles.card, pressed && { opacity: .72 }]}>
    <View style={styles.cardMeta}><Text style={typography.label}>{kindLabel(capture.type)}</Text><Text style={typography.small}>{formatDate(capture.capturedAt)}</Text></View>
    <Text style={styles.cardTitle} numberOfLines={3}>{captureTitle(capture)}</Text>
    {excerpt && excerpt !== captureTitle(capture) ? <Text style={styles.excerpt} numberOfLines={3}>{excerpt}</Text> : null}
    <View style={styles.cardFoot}><Text style={typography.small} numberOfLines={1}>{capture.provenance?.siteName || capture.provenance?.sourceApplication || capture.fileMime || 'Saved in Foundkeep'}</Text>{groupCount > 1 ? <Text style={styles.batch}>+{groupCount - 1} together</Text> : <Ionicons name="arrow-forward" size={16} color={colors.muted} />}</View>
  </Pressable>;
}

export default function CollectionScreen() {
  const { client, account, refresh: refreshAccount } = useSession();
  const [captures, setCaptures] = useState<Capture[]>([]); const [query, setQuery] = useState(''); const [type, setType] = useState<CaptureType | null>(null);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true); setError('');
    try { const result = await client.listCaptures({}); setCaptures(result.captures); await refreshAccount(); }
    catch (value) { setError((value as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [client, refreshAccount]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const groups = useMemo(() => groupCaptures(filterCaptures(captures, query, type)), [captures, query, type]);
  return <Screen><FlatList
    data={groups} keyExtractor={group => group.key} contentContainerStyle={[styles.list, !groups.length && { flexGrow: 1 }]}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
    ListHeaderComponent={<View style={styles.header}><Brand compact /><View style={styles.titleRow}><View><Text style={typography.title}>Your collection.</Text><Text style={typography.small}>{account?.name ? `Good to see you, ${account.name}.` : 'Everything worth coming back to.'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Write a new note" onPress={() => router.push('/(app)/new-note')} style={styles.add}><Ionicons name="add" size={26} color={colors.white} /></Pressable></View><View style={styles.search}><Ionicons name="search" size={18} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Find something you saved…" placeholderTextColor="#878D84" style={styles.searchInput} returnKeyType="search" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map(filter => <Pressable key={filter.label} onPress={() => setType(filter.type)} style={[styles.filter, type === filter.type && styles.filterActive]}><Text style={[styles.filterText, type === filter.type && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}</ScrollView><Message error>{error}</Message></View>}
    renderItem={({ item }) => <CaptureCard capture={item.items[0]!} groupCount={item.items.length} />}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListEmptyComponent={loading ? <View style={styles.empty}><ActivityIndicator color={colors.accent} /><Text style={typography.small}>Opening your collection…</Text></View> : <View style={styles.empty}><Ionicons name="bookmark-outline" size={34} color={colors.moss} /><Text style={typography.heading}>{query || type ? 'No finds this time.' : 'Your first good find goes here.'}</Text><Text style={[typography.body, { textAlign: 'center', color: colors.muted }]}>{query || type ? 'Try another word or choose Everything.' : 'Share something to Foundkeep from Safari, Photos, Files, or any app.'}</Text></View>}
  /></Screen>;
}
const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 42 }, header: { gap: 20, marginBottom: 24 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  add: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  search: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface }, searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  filters: { gap: 7, paddingRight: 16 }, filter: { paddingHorizontal: 13, minHeight: 36, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, filterActive: { backgroundColor: colors.paleMoss, borderColor: colors.moss }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '600' }, filterTextActive: { color: colors.ink },
  card: { minHeight: 176, padding: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface, gap: 11 }, cardMeta: { flexDirection: 'row', justifyContent: 'space-between' }, cardTitle: { color: colors.ink, fontSize: 23, lineHeight: 27, fontWeight: '700', letterSpacing: -.5 }, excerpt: { color: colors.muted, fontSize: 14, lineHeight: 20 }, cardFoot: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, batch: { color: colors.moss, fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, minHeight: 340, alignItems: 'center', justifyContent: 'center', gap: 13, paddingHorizontal: 34 },
});
