// The pieces the search and agent proposals are built from (2026-10-03): today's Library
// (its locked card, its scroll edge) with room for a different header; a dock like the app's
// that can take more buttons; recent folders and tags, as chips or as "jump back in" cards,
// that filter the Library when tapped; recent searches, as rows or chips; a search field that
// turns into asking Kit; Kit's reply, with the saves it found; and a plain list of results.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Capture } from '../../api/types.ts';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { CapturePreview } from '../../components/CapturePreview.tsx';
import { useDock } from '../../components/FloatingDock.tsx';
import { createDockMotion, dockSpring } from '../../components/dockMotion.ts';
import { useDockOnScroll } from '../../components/useDockOnScroll.ts';
import { useScreenReader } from '../../components/useScreenReader.ts';
import { GalleryList } from '../../components/GalleryList.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { GlassSurface } from '../../components/ScenicSurface.tsx';
import { ScrollEdge } from '../../components/ScrollEdge';
import { Brand } from '../../components/ui.tsx';
import { useScrollEdges } from '../../components/useScrollEdges.ts';
import { captureTitle } from '../../collection/model.ts';
import { origin } from '../../collection/origin.ts';
import { useCollection } from '../../collection/useCollection.ts';
import { savedAge } from '../../../../../packages/shared/src/collection-presentation.ts';
import { usePalette } from '../library/parts.tsx';
import { recentPlaces } from './data.ts';
import { JumpBackIn as JumpBack, type PlaceFilter } from '../../components/JumpBackIn.tsx';

export const KIT_ORB = require('../../../assets/images/elements/agent-orb.webp');
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const native = Platform.OS !== 'web';
export type Filter = PlaceFilter;

// ——— The Library, and where it's been kept ———

/** All the library (for recent folders and tags) and what's shown (filtered by a folder or tag). */
export function useLibrary() {
  const [filter, setFilter] = useState<Filter>(null);
  const all = useCollection({});
  const shown = useCollection({ folderId: filter?.kind === 'folder' ? filter.id : undefined, tag: filter?.kind === 'tag' ? filter.name : undefined });
  const places = useMemo(() => recentPlaces(all.captures), [all.captures]);
  const toggle = (next: Filter) => setFilter(current => (current && next && current.kind === next.kind && current.id === next.id ? null : next));
  return { filter, toggle, all, shown, places };
}
/** Searches made here, newest first (kept on the device in the app). */
export function useRecentSearches(seed = ['ramen', 'kyoto', 'spaced repetition', 'a chair that lasts']) {
  const [list, setList] = useState(seed);
  return { list, add: (query: string) => setList(current => [query, ...current.filter(item => item !== query)].slice(0, 8)), remove: (query: string) => setList(current => current.filter(item => item !== query)) };
}

const TOP_BAR = 64;
/** Today's Library — its card, its scroll edge — with `header` above the saves, scrolling with them. */
export function LibraryShell({ library, header, actions, bottomExtra = 0, children }: { library: ReturnType<typeof useLibrary>; header: ReactNode; actions?: ReactNode; bottomExtra?: number; children?: ReactNode }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const edges = useScrollEdges(TOP_BAR);
  const { bottomSpace } = useDock();
  const [headerHeight, setHeaderHeight] = useState(180);
  const dock = useDockOnScroll(headerHeight);
  return <View style={[styles.fill, { backgroundColor: P.paper }]}>
    <GalleryList collection={library.shown} filtered={Boolean(library.filter)} headerSpace={insets.top + TOP_BAR + headerHeight} bottomSpace={bottomSpace + bottomExtra} onScroll={dock}
      header={<View style={{ paddingTop: insets.top + TOP_BAR }}><View style={styles.header} onLayout={event => setHeaderHeight(Math.ceil(event.nativeEvent.layout.height))}>{header}</View></View>} />
    <ScrollEdge edge="bottom" height={edges.bottom.height + bottomExtra} hold={edges.bottom.hold} color={P.paper} />
    <ScrollEdge edge="top" height={edges.top.height} hold={edges.top.hold} color={P.paper} />
    <View style={[styles.topBar, { top: insets.top }]}><Brand compact /><View style={styles.actions}>{actions}</View></View>
    {children}
  </View>;
}
export function Title({ title = 'The collection.', line = 'Recently saved · newest first' }: { title?: string; line?: string }) {
  const P = usePalette();
  return <View style={styles.title}><Text style={[styles.titleText, { color: P.ink }]}>{title}</Text><Text style={[styles.titleLine, { color: P.muted }]}>{line}</Text></View>;
}
export function IconAction({ icon, label, onPress = () => {} }: { icon: string; label: string; onPress?: () => void }) {
  const P = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><Ionicons name={icon as 'archive-outline'} size={22} color={P.ink} /></Pressable>;
}

/** Recent folders, then recent tags, as chips; tapping one shows only its saves (again: everything). */
export function PlaceChips({ library, label }: { library: ReturnType<typeof useLibrary>; label?: string }) {
  const P = usePalette();
  const { folders, tags } = library.places;
  const chip = (key: string, on: boolean, onPress: () => void, children: ReactNode, a11y: string) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: on }} onPress={onPress}
    style={({ pressed }): StyleProp<ViewStyle> => [styles.chip, { backgroundColor: on ? P.ink : P.surface, borderColor: on ? P.ink : P.line }, pressed && styles.pressed]}>{children}</Pressable>;
  const ink = (on: boolean) => (on ? P.paper : P.ink);
  return <View style={styles.block}>
    {label ? <Text style={[styles.label, { color: P.muted }]}>{label}</Text> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {folders.map(folder => { const on = library.filter?.kind === 'folder' && library.filter.id === folder.id; return chip(`f-${folder.id}`, on, () => library.toggle({ kind: 'folder', id: folder.id, name: folder.name }),
        <><Ionicons name={on ? 'folder' : 'folder-outline'} size={14} color={ink(on)} /><Text style={[styles.chipText, { color: ink(on) }]}>{folder.name}</Text><Text style={[styles.chipCount, { color: on ? P.paper : P.muted }]}>{folder.count}</Text></>, `${folder.name}, ${folder.count} saves`); })}
      {tags.map(tag => { const on = library.filter?.kind === 'tag' && library.filter.name === tag.name; return chip(`t-${tag.name}`, on, () => library.toggle({ kind: 'tag', id: tag.name, name: tag.name }),
        <><Text style={[styles.hash, { color: on ? P.paper : P.accent }]}>#</Text><Text style={[styles.chipText, { color: ink(on) }]}>{tag.name}</Text></>, `Tag ${tag.name}, ${tag.count} saves`); })}
    </ScrollView>
  </View>;
}
/** Jump back in — the app's now (components/JumpBackIn), locked 2026-10-03. */
export function JumpBackIn({ library }: { library: ReturnType<typeof useLibrary> }) {
  return <JumpBack places={library.places} selected={library.filter} onChoose={library.toggle} />;
}

// ——— Searching, and asking Kit ———

/** Recent searches: big rows, easy to hit (rows), or one line of chips (chips). Tapping runs it again. */
export function RecentSearches({ recents, onRun, look = 'rows' }: { recents: ReturnType<typeof useRecentSearches>; onRun: (query: string) => void; look?: 'rows' | 'chips' }) {
  const P = usePalette();
  if (!recents.list.length) return null;
  if (look === 'chips') return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
    {recents.list.map(query => <Pressable key={query} accessibilityRole="button" accessibilityLabel={`Search again for ${query}`} onPress={() => onRun(query)} style={({ pressed }): StyleProp<ViewStyle> => [styles.chip, { backgroundColor: P.surface, borderColor: P.line }, pressed && styles.pressed]}>
      <Ionicons name="time-outline" size={14} color={P.muted} /><Text style={[styles.chipText, { color: P.ink }]}>{query}</Text>
    </Pressable>)}
  </ScrollView>;
  return <View style={[styles.rows, { backgroundColor: P.surface, borderColor: P.line }]}>
    {recents.list.slice(0, 5).map((query, i) => <View key={query} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Search again for ${query}`} onPress={() => onRun(query)} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
        <Ionicons name="time-outline" size={19} color={P.muted} /><Text style={[styles.rowText, { color: P.ink }]} numberOfLines={1}>{query}</Text><Ionicons name="arrow-forward" size={17} color={P.muted} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${query} from recent searches`} hitSlop={8} onPress={() => recents.remove(query)} style={styles.rowRemove}><Ionicons name="close" size={16} color={P.muted} /></Pressable>
    </View>)}
  </View>;
}
/** The one field for searching and asking Kit: Kit's orb, “Search or ask Kit”. The backend decides
 * whether it's a word to look for or a question for Kit. */
export function SearchField({ value, onChange, onSubmit, onFocus, autoFocus = false, big = false }: { value: string; onChange: (text: string) => void; onSubmit?: () => void; onFocus?: () => void; autoFocus?: boolean; big?: boolean }) {
  const P = usePalette();
  return <View style={[styles.field, big && styles.fieldBig, { backgroundColor: P.surface, borderColor: P.line }]}>
    <Image source={KIT_ORB} style={big ? styles.orbSmall : styles.orbFieldSmall} accessible={false} />
    <TextInput value={value} onChangeText={onChange} autoFocus={autoFocus} onSubmitEditing={onSubmit} onFocus={onFocus} returnKeyType="search" placeholder="Search or ask Kit" placeholderTextColor={P.muted}
      style={[styles.input, big && styles.inputBig, { color: P.ink }]} accessibilityLabel="Search or ask Kit" autoCorrect={false} />
    {value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={() => onChange('')} hitSlop={8} style={styles.clear}><Ionicons name="close-circle" size={19} color={P.muted} /></Pressable> : null}
  </View>;
}
/** The field as a button (it opens searching): looks the same, so it reads as one thing. */
export function SearchButton({ onPress, big = false, style }: { onPress: () => void; big?: boolean; style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  return <Pressable accessibilityRole="search" accessibilityLabel="Search or ask Kit" onPress={onPress} style={({ pressed }) => [styles.field, big && styles.fieldBig, { backgroundColor: P.surface, borderColor: P.line }, style, pressed && styles.pressed]}>
    <Image source={KIT_ORB} style={big ? styles.orbSmall : styles.orbFieldSmall} accessible={false} /><Text style={[styles.buttonText, big && styles.inputBig, { color: P.muted }]}>Search or ask Kit</Text>
  </Pressable>;
}
/** What was found: a line from Kit when it has something to say, then the saves. */
export function Findings({ note, items, loading = false }: { note: string | null; items: Capture[]; loading?: boolean }) {
  const P = usePalette();
  return <View style={styles.kit}>
    {note ? <View style={[styles.note, { backgroundColor: P.accentSoft }]}><Image source={KIT_ORB} style={styles.orbNote} accessible={false} /><Text style={[styles.noteText, { color: P.ink }]}>{note}</Text></View> : null}
    <Text style={[styles.label, { color: P.muted }]}>{loading ? 'Searching…' : `${items.length} ${items.length === 1 ? 'save' : 'saves'}`}</Text>
    <Results items={items} />
  </View>;
}
/** What a search finds, as a plain list: picture, title, where it came from and when. */
export function Results({ items, limit = 8 }: { items: Capture[]; limit?: number }) {
  const P = usePalette();
  if (!items.length) return <Text style={[styles.empty, { color: P.muted }]}>Nothing yet. Try other words, or ask it as a question.</Text>;
  return <View style={[styles.rows, { backgroundColor: P.surface, borderColor: P.line }]}>
    {items.slice(0, limit).map((capture, i) => <View key={capture.id} style={[styles.result, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.line }]}>
      <View style={[styles.resultThumb, { backgroundColor: P.note }]}><Thumb capture={capture} /></View>
      <View style={styles.resultWords}><Text style={[styles.resultTitle, { color: P.ink }]} numberOfLines={2}>{headline(capture)}</Text><Origin capture={capture} /></View>
    </View>)}
  </View>;
}
// ——— The dock ———

export type DockTab = { key: string; label: string; icon: string; selectedIcon: string; orb?: boolean; onPress?: () => void };
export type DockButton = { key: string; label: string; icon?: string; orb?: boolean; onPress?: () => void };
const TABS: DockTab[] = [{ key: 'collection', label: 'Gallery', icon: 'grid-outline', selectedIcon: 'grid' }, { key: 'settings', label: 'You', icon: 'person-circle-outline', selectedIcon: 'person-circle' }];
/** A dock like the app's — Gallery and You on glass, round buttons beside — that can take more,
 * and tucks into its icons as the Library scrolls down, as the app's does (useDockOnScroll). */
export function ProposalDock({ tabs = TABS, buttons, selected = 'collection' }: { tabs?: DockTab[]; buttons: DockButton[]; selected?: string }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { collapsed } = useDock();
  const motion = useMotionAllowed();
  const screenReader = useScreenReader();
  const room = width - 32 - buttons.length * 70;
  const tab = Math.min(118, (room - 12) / tabs.length);
  // Labels when they fit whole (two tabs); three tabs show their icons, named for screen readers.
  const labels = tab >= 104;
  const progress = useRef(new Animated.Value(0)).current;
  const { tabWidth, labelWidth, labelOpacity } = useMemo(() => createDockMotion(progress, tab), [progress, tab]);
  const compact = collapsed && !screenReader;
  useEffect(() => {
    if (!motion) { progress.setValue(compact ? 1 : 0); return; }
    const spring = Animated.spring(progress, { ...dockSpring, toValue: compact ? 1 : 0 });
    spring.start(); return () => spring.stop();
  }, [compact, motion, progress]);
  return <View pointerEvents="box-none" style={[styles.dock, { bottom: Math.max(insets.bottom, 12) }]}>
    <GlassSurface style={[styles.dockSurface, styles.dockTabs]}>
      {tabs.map(item => { const on = item.key === selected; return <Animated.View key={item.key} style={{ width: tabWidth, height: 48 }}>
        <Pressable accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: on }} onPress={item.onPress}
          style={({ pressed }) => [styles.dockTab, (on || pressed) && { backgroundColor: P.accentSoft }]}>
          {item.orb ? <Image source={KIT_ORB} style={styles.orbDock} accessible={false} /> : <Ionicons name={(on ? item.selectedIcon : item.icon) as 'grid'} size={24} color={on ? P.accent : P.muted} />}
          {labels ? <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: labelWidth, opacity: labelOpacity, overflow: 'hidden' }}>
            <Text style={[styles.dockLabel, { width: tab - 44, paddingLeft: 8, color: on ? P.accent : P.muted }]} numberOfLines={1}>{item.label}</Text>
          </Animated.View> : null}
        </Pressable>
      </Animated.View>; })}
    </GlassSurface>
    {buttons.map(button => <GlassSurface key={button.key} interactive style={[styles.dockSurface, styles.dockButton]}>
      <Pressable accessibilityRole="button" accessibilityLabel={button.label} onPress={button.onPress} style={({ pressed }) => [styles.dockButtonInner, pressed && { backgroundColor: P.accentSoft }]}>
        {button.orb ? <Image source={KIT_ORB} style={styles.orbButton} accessible={false} /> : <Ionicons name={button.icon as 'add'} size={button.icon === 'add' ? 28 : 24} color={P.accent} />}
      </Pressable>
    </GlassSurface>)}
  </View>;
}

/** A panel sliding up over the Library (`open`), on the page's colour. */
export function Sheet({ open, children, top = 0 }: { open: boolean; children: ReactNode; top?: number }) {
  const P = usePalette();
  const motion = useMotionAllowed();
  const { height } = useWindowDimensions();
  const t = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => { Animated.timing(t, { toValue: open ? 1 : 0, duration: motion ? 420 : 0, easing: SETTLE, useNativeDriver: native }).start(); }, [open, motion, t]);
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.sheet, { top, backgroundColor: P.paper, opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height * 0.3, 0] }) }] }]}>{children}</Animated.View>;
}

// ——— Small things ———

function headline(capture: Capture) { return capture.type === 'tweet' && capture.selectionText ? capture.selectionText : captureTitle(capture); }
function Thumb({ capture }: { capture: Capture }) {
  const P = usePalette();
  if (capture.type === 'note' || capture.type === 'selection') return <View style={styles.thumbWords}><Ionicons name={capture.type === 'note' ? 'create-outline' : 'chatbox-ellipses-outline'} size={18} color={P.accent} /></View>;
  return <CapturePreview capture={capture} compact style={styles.thumbFill} />;
}
function Origin({ capture }: { capture: Capture }) {
  const P = usePalette();
  const from = origin(capture);
  return <View style={styles.origin}><Ionicons name={from.icon as 'logo-x'} size={12} color={from.color === 'muted' ? P.muted : from.color ?? P.ink} /><Text style={[styles.originText, { color: P.muted }]} numberOfLines={1}>{from.name} · {savedAge(capture)}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  pressed: { opacity: 0.75 },
  header: { marginHorizontal: -18, marginTop: -16, gap: 14, paddingBottom: 6 },
  topBar: { position: 'absolute', left: 20, right: 20, height: TOP_BAR - 8, marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 },
  actions: { flexDirection: 'row', gap: 4 },
  iconAction: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { paddingHorizontal: 20, gap: 5 },
  titleText: { fontSize: 32, lineHeight: 37, fontWeight: '600', letterSpacing: -1.1 },
  titleLine: { fontSize: 14, lineHeight: 20 },
  block: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20 },
  chips: { gap: 8, paddingHorizontal: 20 },
  chip: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 14.5, fontWeight: '600' },
  chipCount: { fontSize: 12.5, fontWeight: '600' },
  hash: { fontSize: 15, fontWeight: '700' },
  cards: { gap: 10, paddingHorizontal: 20 },
  folderCard: { width: 140, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 3 },
  thumbs: { height: 46, marginBottom: 8 },
  thumb: { position: 'absolute', width: 46, height: 46, borderRadius: 12, overflow: 'hidden', borderWidth: 2 },
  folderName: { fontSize: 15, fontWeight: '700' },
  folderCount: { fontSize: 12.5 },
  rows: { marginHorizontal: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16 },
  rowText: { flex: 1, fontSize: 16.5, fontWeight: '500' },
  rowRemove: { width: 46, height: 54, alignItems: 'center', justifyContent: 'center' },
  field: { marginHorizontal: 16, minHeight: 50, borderRadius: 25, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6 },
  fieldBig: { minHeight: 56, borderRadius: 28 },
  // minWidth 0: a text field has a width of its own on the web and would push past the buttons beside it.
  input: { flex: 1, minWidth: 0, fontSize: 16, minHeight: 44 },
  inputBig: { fontSize: 17 },
  clear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  buttonText: { flex: 1, fontSize: 16 },
  note: { marginHorizontal: 16, borderRadius: 18, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 15, lineHeight: 21 },
  orbNote: { width: 26, height: 26 },
  orbFieldSmall: { width: 22, height: 22 },  orbTiny: { width: 20, height: 20 },
  orbSmall: { width: 24, height: 24 },
  orb: { width: 34, height: 34 },
  orbDock: { width: 30, height: 30 },
  orbButton: { width: 36, height: 36 },
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: 24 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  resultThumb: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden' },
  resultWords: { flex: 1, gap: 4 },
  resultTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '600' },
  kit: { gap: 12 },
  asked: { alignSelf: 'flex-end', marginRight: 16, maxWidth: '80%', borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  askedText: { fontSize: 15.5, lineHeight: 21 },
  kitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16 },
  kitBubble: { flex: 1, borderRadius: 20, borderTopLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  kitName: { fontSize: 12.5, fontWeight: '700' },
  kitText: { fontSize: 15.5, lineHeight: 22 },
  kitSaves: { gap: 10, paddingLeft: 60, paddingRight: 16 },
  mini: { width: 150, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 6, gap: 6, paddingBottom: 10 },
  miniThumb: { height: 96, borderRadius: 11, overflow: 'hidden' },
  miniTitle: { fontSize: 14, lineHeight: 18, fontWeight: '600', paddingHorizontal: 4 },
  origin: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  originText: { fontSize: 12.5, flexShrink: 1 },
  thumbFill: { width: '100%', height: '100%', aspectRatio: undefined },
  thumbWords: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, zIndex: 5 },
  dockSurface: { borderRadius: 42, borderCurve: 'continuous', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.13, shadowRadius: 16, elevation: 6 },
  dockTabs: { flexDirection: 'row', alignItems: 'center', padding: 6, height: 60 },
  dockTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 36 },
  dockLabel: { fontSize: 13, fontWeight: '600' },
  dockButton: { width: 60, height: 60 },
  dockButtonInner: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6 },
});
