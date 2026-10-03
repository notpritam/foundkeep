import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Capture } from '../api/types.ts';
import { useAppearance } from '../appearance/AppearanceProvider.tsx';
import type { FolderPlace, Place } from '../collection/places.ts';
import { palettes } from '../theme.ts';
import { AdaptiveText as Text } from './AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from './AdaptiveIcon.tsx';
import { CapturePreview } from './CapturePreview.tsx';

// Jump back in (Pritam, 2026-10-03, locked): where your saves have been going, newest first —
// each folder as a small card with its last few saves and how many, then the tags as chips
// (#Cooking). Tapping one shows just its saves; tapping it again, everything. Worked out from
// the library (collection/places), so it keeps up as you save.
export type PlaceFilter = { kind: 'folder' | 'tag'; id: string; name: string } | null;

export function JumpBackIn({ places, selected, onChoose }: { places: { folders: FolderPlace[]; tags: Place[] }; selected: PlaceFilter; onChoose: (place: PlaceFilter) => void }) {
  const P = palettes[useAppearance().scheme];
  if (!places.folders.length && !places.tags.length) return null;
  const on = (kind: 'folder' | 'tag', id: string) => selected?.kind === kind && selected.id === id;
  return <View style={styles.block}>
    <Text style={[styles.label, { color: P.muted }]}>Jump back in</Text>
    {places.folders.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {places.folders.map(folder => { const chosen = on('folder', folder.id); return <Pressable key={folder.id} accessibilityRole="button" accessibilityLabel={`${folder.name}, ${folder.count} ${folder.count === 1 ? 'save' : 'saves'}`} accessibilityState={{ selected: chosen }}
        onPress={() => onChoose(chosen ? null : { kind: 'folder', id: folder.id, name: folder.name })} style={({ pressed }): StyleProp<ViewStyle> => [styles.card, { backgroundColor: chosen ? P.ink : P.surface, borderColor: chosen ? P.ink : P.line }, pressed && styles.pressed]}>
        <View style={styles.thumbs}>{folder.saves.slice(0, 3).map((capture, i) => <View key={capture.id} style={[styles.thumb, { left: i * 20, zIndex: 3 - i, borderColor: chosen ? P.ink : P.surface, backgroundColor: P.note }]}><Thumb capture={capture} tint={P.accent} /></View>)}</View>
        <Text style={[styles.name, { color: chosen ? P.paper : P.ink }]} numberOfLines={1}>{folder.name}</Text>
        <Text style={[styles.count, { color: chosen ? P.paper : P.muted }]}>{folder.count} {folder.count === 1 ? 'save' : 'saves'}</Text>
      </Pressable>; })}
    </ScrollView> : null}
    {places.tags.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {places.tags.map(tag => { const chosen = on('tag', tag.name); return <Pressable key={tag.name} accessibilityRole="button" accessibilityLabel={`Tag ${tag.name}, ${tag.count} ${tag.count === 1 ? 'save' : 'saves'}`} accessibilityState={{ selected: chosen }}
        onPress={() => onChoose(chosen ? null : { kind: 'tag', id: tag.name, name: tag.name })} style={({ pressed }): StyleProp<ViewStyle> => [styles.chip, { backgroundColor: chosen ? P.ink : P.surface, borderColor: chosen ? P.ink : P.line }, pressed && styles.pressed]}>
        <Text style={[styles.hash, { color: chosen ? P.paper : P.accent }]}>#</Text><Text style={[styles.chipText, { color: chosen ? P.paper : P.ink }]}>{tag.name}</Text>
      </Pressable>; })}
    </ScrollView> : null}
  </View>;
}
function Thumb({ capture, tint }: { capture: Capture; tint: string }) {
  if (capture.type === 'note' || capture.type === 'selection') return <View style={styles.words}><Ionicons name={capture.type === 'note' ? 'create-outline' : 'chatbox-ellipses-outline'} size={18} color={tint} /></View>;
  return <CapturePreview capture={capture} compact style={styles.fill} />;
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20 },
  row: { gap: 10, paddingHorizontal: 20 },
  pressed: { opacity: 0.75 },
  card: { width: 140, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 3 },
  thumbs: { height: 46, marginBottom: 8 },
  thumb: { position: 'absolute', width: 46, height: 46, borderRadius: 12, overflow: 'hidden', borderWidth: 2 },
  name: { fontSize: 15, fontWeight: '700' },
  count: { fontSize: 12.5 },
  chip: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth },
  hash: { fontSize: 15, fontWeight: '700' },
  chipText: { fontSize: 14.5, fontWeight: '600' },
  words: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%', aspectRatio: undefined },
});
