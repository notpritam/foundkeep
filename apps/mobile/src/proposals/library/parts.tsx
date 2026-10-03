// The parts the Library proposals are built from (2026-10-02): the large
// title and its round icon buttons, the kind pills, a save's picture (or, for
// what was written, its words), the small mark that says what kind of save it
// is, the headline and byline a save is shown by, and days to group saves in.
// All on the app's palette, so every look follows light and dark.
import { router } from 'expo-router';
import { useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Capture, CaptureType } from '../../api/types.ts';
import { useAppearance } from '../../appearance/AppearanceProvider.tsx';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { CapturePreview, captureLabels } from '../../components/CapturePreview.tsx';
import { captureTitle } from '../../collection/model.ts';
import { palettes } from '../../theme.ts';
import { ScrollEdge } from '../../components/ScrollEdge';
import { useScrollEdges } from '../../components/useScrollEdges.ts';
import { useDockOnScroll } from '../../components/useDockOnScroll.ts';
import { savedAge, sourcePlatform } from '../../../../../packages/shared/src/collection-presentation.ts';

export function usePalette() { const { scheme } = useAppearance(); return { ...palettes[scheme], dark: scheme === 'dark' }; }
export type Palette = ReturnType<typeof usePalette>;

export type Kind = { label: string; type?: CaptureType };
export const KINDS: Kind[] = [{ label: 'All' }, { label: 'Videos', type: 'video' }, { label: 'Posts', type: 'tweet' }, { label: 'Links', type: 'bookmark' }, { label: 'Images', type: 'image' }, { label: 'Notes', type: 'note' }];
export const GLYPH: Record<CaptureType, string> = { video: 'play', tweet: 'chatbubble', bookmark: 'link', image: 'image', note: 'create', selection: 'text', screenshot: 'scan', document: 'document-text', audio: 'mic', file: 'document' };

export const written = (capture: Capture) => capture.type === 'note' || capture.type === 'selection';
/** Whether there is a picture to show: a preview, or the image itself. */
export const pictured = (capture: Capture) => !written(capture) && Boolean(capture.previewUrl || capture.blobUrl || (capture.fileUrl && capture.fileMime?.startsWith('image/')));
/** What a save is called: a post by what it says, anything else by its title. */
export function headline(capture: Capture) {
  if (capture.type === 'tweet' && capture.selectionText) return capture.selectionText;
  return captureTitle(capture);
}
/** Who or where it came from: a post's author, a site, or what kind of thing it is. */
export function byline(capture: Capture) {
  if (capture.type === 'tweet') return capture.provenance?.authors?.[0] || sourcePlatform(capture) || 'Post';
  if (written(capture)) return capture.type === 'note' ? 'Note' : capture.provenance?.siteName || 'Highlight';
  return sourcePlatform(capture) || capture.provenance?.siteName || (capture.savedVia === 'iphone' ? 'From your iPhone' : captureLabels[capture.type]);
}
export const age = (capture: Capture) => savedAge(capture);
export const openSave = (capture: Capture) => router.push({ pathname: '/(app)/capture/[id]', params: { id: capture.id } });

/** Days to group saves in: Today, Yesterday, a weekday this week, then the date. */
export function dayOf(time: number, now = Date.now()) {
  const day = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diff = Math.round((day(now) - day(time)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return new Date(time).toLocaleDateString('en-GB', { weekday: 'long' });
  return new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}
export function byDay(captures: Capture[]) {
  const groups: { label: string; items: Capture[] }[] = [];
  for (const capture of captures) {
    const label = dayOf(capture.capturedAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(capture); else groups.push({ label, items: [capture] });
  }
  return groups;
}

/** The bar that stays put while the library scrolls under it (Pritam's reference, 2026-10-02):
 * its buttons always, the small title once the large one has scrolled away; behind it, and
 * behind the dock, the scroll edge — what passes under blurs, strongest at the edge. */
export const BAR = 52;
export function useScrollY() {
  const y = useRef(new Animated.Value(0)).current;
  const dock = useDockOnScroll();
  return { y, onScroll: Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: false, listener: dock }) };
}
export function Edges({ y, title, children }: { y: Animated.Value; title: string; children?: React.ReactNode }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const edges = useScrollEdges(BAR);
  return <>
    <ScrollEdge edge="bottom" height={edges.bottom.height} hold={edges.bottom.hold} color={P.paper} />
    <ScrollEdge edge="top" height={edges.top.height} hold={edges.top.hold} color={P.paper} />
    <View pointerEvents="box-none" style={[styles.bar, { paddingTop: insets.top, height: insets.top + BAR }]}>
      <Animated.Text accessibilityRole="header" style={[styles.barTitle, { color: P.ink, opacity: y.interpolate({ inputRange: [30, 60], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>{title}</Animated.Text>
      <View style={styles.barButtons}>{children}</View>
    </View>
  </>;
}

export function Header({ title, children, sub }: { title: string; sub?: string; children?: React.ReactNode }) {
  const P = usePalette();
  return <View style={styles.header}>
    <View style={styles.headerWords}><Text maxFontSizeMultiplier={1.3} style={[styles.title, { color: P.ink }]}>{title}</Text>{sub ? <Text style={[styles.sub, { color: P.muted }]}>{sub}</Text> : null}</View>
    <View style={styles.buttons}>{children}</View>
  </View>;
}
export function IconButton({ icon, label, onPress = () => {} }: { icon: string; label: string; onPress?: () => void }) {
  const P = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }): StyleProp<ViewStyle> => [styles.iconButton, { backgroundColor: P.surface, borderColor: P.line }, pressed && styles.pressed]}>
    <Ionicons name={icon as 'search'} size={19} color={P.ink} />
  </Pressable>;
}
export function Pills({ value, onChange }: { value: Kind; onChange: (kind: Kind) => void }) {
  const P = usePalette();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
    {KINDS.map(kind => { const on = kind.label === value.label; return <Pressable key={kind.label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(kind)}
      style={({ pressed }): StyleProp<ViewStyle> => [styles.pill, { backgroundColor: on ? P.ink : P.surface, borderColor: on ? P.ink : P.line }, pressed && styles.pressed]}>
      <Text maxFontSizeMultiplier={1.3} style={[styles.pillText, { color: on ? P.paper : P.ink }]}>{kind.label}</Text>
    </Pressable>; })}
  </ScrollView>;
}
export function SearchField({ placeholder = 'Search your library' }: { placeholder?: string }) {
  const P = usePalette();
  return <View style={[styles.search, { backgroundColor: P.surface, borderColor: P.line }]}><Ionicons name="search" size={17} color={P.muted} /><Text style={[styles.searchText, { color: P.muted }]}>{placeholder}</Text></View>;
}

/** A save's picture, or — for a note or a highlight, or anything without a picture yet — its words on a soft tint. */
export function Picture({ capture, style, lines = 6, size = 14 }: { capture: Capture; style?: StyleProp<ViewStyle>; lines?: number; size?: number }) {
  const P = usePalette();
  if (!written(capture) && !pictured(capture)) return <View style={[styles.words, styles.linkWords, { backgroundColor: P.accentSoft }, style]}>
    <View style={styles.linkSource}><Ionicons name={GLYPH[capture.type] as 'link'} size={12} color={P.accent} /><Text style={[styles.linkSourceText, { color: P.accent }]} numberOfLines={1}>{byline(capture)}</Text></View>
    <Text style={[styles.linkTitle, { color: P.ink, fontSize: size + 1.5, lineHeight: (size + 1.5) * 1.3 }]} numberOfLines={lines}>{headline(capture)}</Text>
  </View>;
  if (written(capture)) return <View style={[styles.words, { backgroundColor: P.note }, style]}>
    {capture.type === 'selection' ? <Text style={[styles.quote, { color: P.accent }]}>“</Text> : null}
    <Text style={[styles.wordsText, { color: P.ink, fontSize: size, lineHeight: size * 1.4 }]} numberOfLines={lines}>{capture.noteText || capture.selectionText}</Text>
  </View>;
  return <CapturePreview capture={capture} compact style={[styles.picture, style]} />;
}
/** A small round mark saying what kind of save it is (a video, a post, a link…), for over a picture. */
export function KindMark({ capture, style }: { capture: Capture; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.mark, style]}><Ionicons name={GLYPH[capture.type] as 'play'} size={11} color="#ffffff" /></View>;
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  barTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  barButtons: { position: 'absolute', right: 20, bottom: 6, flexDirection: 'row', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  headerWords: { flex: 1, gap: 2 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  sub: { fontSize: 14, lineHeight: 19 },
  buttons: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  pills: { gap: 8, paddingHorizontal: 20 },
  pill: { height: 36, paddingHorizontal: 15, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  pillText: { fontSize: 14.5, fontWeight: '600' },
  search: { marginHorizontal: 20, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 15 },
  searchText: { fontSize: 16 },
  picture: { aspectRatio: undefined, width: '100%', height: '100%' },
  words: { padding: 12, overflow: 'hidden' },
  quote: { fontSize: 30, lineHeight: 30, fontWeight: '700', marginBottom: -6 },
  wordsText: { fontWeight: '500' },
  linkWords: { gap: 8 },
  linkSource: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  linkSourceText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  linkTitle: { fontWeight: '700', letterSpacing: -0.2 },
  mark: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(10,20,30,0.55)', alignItems: 'center', justifyContent: 'center' },
});
