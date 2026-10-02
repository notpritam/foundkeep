// The Library (proposal, 2026-10-02): where first run hands you, and where
// you come back to find what you kept. Four ways to lay it out — each a real
// screen on the app's own data (the sample world in Storybook), opening a save
// when it's tapped, in light and dark:
//   cards    the sign-in screen's cards: each save a white card with its picture
//            and title, nothing above the title, in two columns
//   grid     like Photos: three across, edge to edge, grouped by day; what kind
//            of save it is in a small mark on the picture
//   shelves  a row for each kind — just saved, videos, to read, posts, photos,
//            notes — each scrolling sideways
//   list     dense and quiet: a picture, the title, where it came from; by day
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Capture } from '../../api/types.ts';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { useDock } from '../../components/FloatingDock.tsx';
import { useCollection } from '../../collection/useCollection.ts';
import { previewRatio } from '../../../../../packages/shared/src/collection-presentation.ts';
import { age, byDay, byline, GLYPH, Header, headline, IconButton, KindMark, KINDS, openSave, Picture, pictured, Pills, SearchField, usePalette, written, type Kind } from './parts.tsx';

export type LibraryLook = 'cards' | 'grid' | 'shelves' | 'list';
export function LibraryProposal({ look }: { look: LibraryLook }) {
  if (look === 'grid') return <Grid />;
  if (look === 'shelves') return <Shelves />;
  if (look === 'list') return <List />;
  return <Cards />;
}

/** The library for a kind of save, and the space the screen leaves for the dock. */
function useLibrary(kind: Kind = KINDS[0]) {
  const collection = useCollection({ type: kind.type });
  const insets = useSafeAreaInsets();
  const { bottomSpace } = useDock();
  return { ...collection, top: insets.top + 10, bottom: Math.max(bottomSpace, insets.bottom + 100) + 12 };
}
function Empty({ loading, error }: { loading: boolean; error: string }) {
  const P = usePalette();
  return <View style={styles.empty}><Text style={[styles.emptyText, { color: P.muted }]}>{loading ? 'Loading your library…' : error || 'Nothing here yet.'}</Text></View>;
}

// ——— Cards ———

function Cards() {
  const P = usePalette();
  const { width: W } = useWindowDimensions();
  const [kind, setKind] = useState(KINDS[0]);
  const library = useLibrary(kind);
  const pad = 16, gap = 12, column = (W - pad * 2 - gap) / 2;
  // Two columns, each save going to the shorter one, so they stay in order across the page.
  const columns = useMemo(() => {
    const cols: Capture[][] = [[], []], heights = [0, 0];
    for (const capture of library.captures) {
      const i = heights[0] <= heights[1] ? 0 : 1;
      cols[i].push(capture);
      heights[i] += (pictured(capture) ? column / previewRatio(capture.width, capture.height) : 170) + 72 + gap;
    }
    return cols;
  }, [library.captures, column]);
  return <ScrollView style={{ backgroundColor: P.paper }} contentContainerStyle={{ paddingTop: library.top, paddingBottom: library.bottom }}>
    <Header title="Library"><IconButton icon="search" label="Search" /><IconButton icon="archive-outline" label="Archive" /></Header>
    <Pills value={kind} onChange={setKind} />
    {library.captures.length ? <View style={[styles.columns, { paddingHorizontal: pad, gap }]}>
      {columns.map((col, i) => <View key={i} style={[styles.column, { gap }]}>{col.map(capture => <SaveCard key={capture.id} capture={capture} />)}</View>)}
    </View> : <Empty loading={library.loading} error={library.error} />}
  </ScrollView>;
}
function SaveCard({ capture }: { capture: Capture }) {
  const P = usePalette();
  const words = !pictured(capture);
  return <Pressable accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={() => openSave(capture)}
    style={({ pressed }): StyleProp<ViewStyle> => [styles.card, { backgroundColor: P.surface, shadowColor: P.shadow }, P.dark && { borderColor: P.line, borderWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}>
    {words ? <Picture capture={capture} style={styles.cardWords} lines={7} size={14.5} />
      : <View style={[styles.cardPicture, { aspectRatio: previewRatio(capture.width, capture.height) }]}><Picture capture={capture} />{capture.type === 'video' ? <KindMark capture={capture} style={styles.markCorner} /> : null}</View>}
    <View style={styles.cardText}>
      {words ? null : <Text style={[styles.cardTitle, { color: P.ink }]} numberOfLines={3}>{headline(capture)}</Text>}
      <View style={styles.meta}><Ionicons name={GLYPH[capture.type] as 'link'} size={12} color={P.muted} /><Text style={[styles.metaText, { color: P.muted }]} numberOfLines={1}>{words && !written(capture) ? age(capture) : `${byline(capture)} · ${age(capture)}`}</Text></View>
    </View>
  </Pressable>;
}

// ——— Grid ———

function Grid() {
  const P = usePalette();
  const { width: W } = useWindowDimensions();
  const [kind, setKind] = useState(KINDS[0]);
  const library = useLibrary(kind);
  const gap = 2, tile = (W - gap * 2) / 3;
  const groups = useMemo(() => byDay(library.captures), [library.captures]);
  return <ScrollView style={{ backgroundColor: P.paper }} contentContainerStyle={{ paddingTop: library.top, paddingBottom: library.bottom }}>
    <Header title="Library" sub={library.total ? `${library.total} saves` : undefined}><IconButton icon="search" label="Search" /><IconButton icon="archive-outline" label="Archive" /></Header>
    <Pills value={kind} onChange={setKind} />
    {groups.length ? groups.map(group => <View key={group.label}>
      <Text style={[styles.day, { color: P.ink }]}>{group.label}</Text>
      <View style={[styles.grid, { gap }]}>
        {group.items.map(capture => <Pressable key={capture.id} accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={() => openSave(capture)} style={({ pressed }) => [{ width: tile, height: tile }, pressed && styles.dim]}>
          <Picture capture={capture} style={styles.fill} lines={5} size={12.5} />
          {['video', 'tweet', 'bookmark'].includes(capture.type) ? <KindMark capture={capture} style={styles.markLow} /> : null}
        </Pressable>)}
      </View>
    </View>) : <Empty loading={library.loading} error={library.error} />}
  </ScrollView>;
}

// ——— Shelves ———

type Shelf = { title: string; items: Capture[]; shape: 'hero' | 'tall' | 'wide' | 'post' | 'square' | 'words' };
function Shelves() {
  const P = usePalette();
  const library = useLibrary();
  const all = library.captures;
  const shelves: Shelf[] = [
    { title: 'Just saved', items: all.filter(pictured).slice(0, 5), shape: 'hero' },
    { title: 'Videos', items: all.filter(c => c.type === 'video'), shape: 'tall' },
    { title: 'To read', items: all.filter(c => c.type === 'bookmark' || c.type === 'document'), shape: 'wide' },
    { title: 'Posts', items: all.filter(c => c.type === 'tweet'), shape: 'post' },
    { title: 'Photos', items: all.filter(c => c.type === 'image' || c.type === 'screenshot'), shape: 'square' },
    { title: 'Notes and highlights', items: all.filter(written), shape: 'words' },
  ].filter(shelf => shelf.items.length) as Shelf[];
  return <ScrollView style={{ backgroundColor: P.paper }} contentContainerStyle={{ paddingTop: library.top, paddingBottom: library.bottom }}>
    <Header title="Library"><IconButton icon="archive-outline" label="Archive" /></Header>
    <SearchField />
    {shelves.length ? shelves.map(shelf => <View key={shelf.title} style={styles.shelf}>
      <Pressable accessibilityRole="button" accessibilityLabel={`See all ${shelf.title.toLowerCase()}`} style={styles.shelfHead}>
        <Text style={[styles.shelfTitle, { color: P.ink }]}>{shelf.title}</Text><Ionicons name="chevron-forward" size={18} color={P.muted} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
        {shelf.items.map(capture => <ShelfItem key={capture.id} capture={capture} shape={shelf.shape} />)}
      </ScrollView>
    </View>) : <Empty loading={library.loading} error={library.error} />}
  </ScrollView>;
}
function ShelfItem({ capture, shape }: { capture: Capture; shape: Shelf['shape'] }) {
  const P = usePalette();
  const { width: W } = useWindowDimensions();
  const open = () => openSave(capture);
  const pressed = ({ pressed: on }: { pressed: boolean }) => (on ? styles.pressed : null);
  if (shape === 'tall') return <Pressable accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={open} style={pressed}>
    <View style={styles.tall}><Picture capture={capture} /><View style={styles.tallShade} /><KindMark capture={capture} style={styles.markTop} /><Text style={styles.tallTitle} numberOfLines={3}>{headline(capture)}</Text></View>
  </Pressable>;
  if (shape === 'square') return <Pressable accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={open} style={pressed}><View style={styles.square}><Picture capture={capture} /></View></Pressable>;
  if (shape === 'words') return <Pressable accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={open} style={pressed}><Picture capture={capture} style={styles.wordsTile} lines={5} size={14} /></Pressable>;
  if (shape === 'post') return <Pressable accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={open} style={pressed}>
    <View style={[styles.post, { backgroundColor: P.surface, borderColor: P.line }]}>
      <View style={styles.postWho}><View style={[styles.postAvatar, { backgroundColor: P.accentSoft }]}><Text style={[styles.postInitial, { color: P.accent }]}>{byline(capture).slice(0, 1)}</Text></View><Text style={[styles.postName, { color: P.ink }]} numberOfLines={1}>{byline(capture)}</Text></View>
      <Text style={[styles.postText, { color: P.ink }]} numberOfLines={3}>{headline(capture)}</Text>
      {capture.blobUrl || capture.previewUrl ? <View style={styles.postPicture}><Picture capture={capture} /></View> : null}
    </View>
  </Pressable>;
  const width = shape === 'hero' ? W * 0.74 : 210;
  return <Pressable accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={open} style={pressed}>
    <View style={{ width }}>
      <View style={[styles.wide, { height: shape === 'hero' ? width * 0.72 : 140 }]}><Picture capture={capture} style={styles.fill} lines={5} /></View>
      <Text style={[shape === 'hero' ? styles.heroTitle : styles.wideTitle, { color: P.ink }]} numberOfLines={2}>{headline(capture)}</Text>
      <Text style={[styles.metaText, { color: P.muted }]} numberOfLines={1}>{byline(capture)} · {age(capture)}</Text>
    </View>
  </Pressable>;
}

// ——— List ———

function List() {
  const P = usePalette();
  const [kind, setKind] = useState(KINDS[0]);
  const library = useLibrary(kind);
  const groups = useMemo(() => byDay(library.captures), [library.captures]);
  return <ScrollView style={{ backgroundColor: P.paper }} contentContainerStyle={{ paddingTop: library.top, paddingBottom: library.bottom }}>
    <Header title="Library"><IconButton icon="archive-outline" label="Archive" /></Header>
    <SearchField />
    <View style={styles.listPills}><Pills value={kind} onChange={setKind} /></View>
    {groups.length ? groups.map(group => <View key={group.label} style={styles.listGroup}>
      <Text style={[styles.listDay, { color: P.muted }]}>{group.label}</Text>
      <View style={[styles.listCard, { backgroundColor: P.surface, borderColor: P.line }]}>
        {group.items.map((capture, i) => <Pressable key={capture.id} accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={() => openSave(capture)}
          style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.line }, pressed && { backgroundColor: P.paper }]}>
          <View style={[styles.rowPicture, { backgroundColor: P.note }]}>{!pictured(capture) ? <Ionicons name={GLYPH[capture.type] as 'create'} size={20} color={P.accent} /> : <Picture capture={capture} />}</View>
          <View style={styles.rowWords}>
            <Text style={[styles.rowTitle, { color: P.ink }]} numberOfLines={2}>{headline(capture)}</Text>
            <Text style={[styles.metaText, { color: P.muted }]} numberOfLines={1}>{[byline(capture), capture.folder?.name].filter(Boolean).join(' · ')}</Text>
          </View>
          <Ionicons name={GLYPH[capture.type] as 'link'} size={15} color={P.muted} />
        </Pressable>)}
      </View>
    </View>) : <Empty loading={library.loading} error={library.error} />}
  </ScrollView>;
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  dim: { opacity: 0.8 },
  empty: { paddingVertical: 80, alignItems: 'center' },
  emptyText: { fontSize: 15 },
  columns: { flexDirection: 'row', marginTop: 16, alignItems: 'flex-start' },
  column: { flex: 1 },
  card: { borderRadius: 22, padding: 6, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  cardPicture: { borderRadius: 17, overflow: 'hidden' },
  cardWords: { borderRadius: 17, minHeight: 120 },
  cardText: { paddingHorizontal: 8, paddingTop: 9, paddingBottom: 6, gap: 6 },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  markCorner: { position: 'absolute', top: 8, right: 8 },
  day: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10, letterSpacing: -0.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  markLow: { position: 'absolute', left: 6, bottom: 6 },
  shelf: { marginTop: 22 },
  shelfHead: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 20, marginBottom: 10 },
  shelfTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  shelfRow: { gap: 12, paddingHorizontal: 20 },
  tall: { width: 132, height: 210, borderRadius: 16, overflow: 'hidden' },
  tallShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, backgroundColor: 'rgba(0,0,0,0.35)' },
  tallTitle: { position: 'absolute', left: 10, right: 10, bottom: 10, fontSize: 13, lineHeight: 17, fontWeight: '700', color: '#ffffff' },
  markTop: { position: 'absolute', top: 8, right: 8 },
  square: { width: 120, height: 120, borderRadius: 14, overflow: 'hidden' },
  wordsTile: { width: 210, height: 140, borderRadius: 16 },
  post: { width: 260, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  postWho: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  postInitial: { fontSize: 12, fontWeight: '700' },
  postName: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  postText: { fontSize: 15, lineHeight: 20 },
  postPicture: { height: 120, borderRadius: 12, overflow: 'hidden' },
  wide: { borderRadius: 18, overflow: 'hidden', marginBottom: 8 },
  heroTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 3 },
  wideTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', marginBottom: 3 },
  listPills: { marginTop: 12 },
  listGroup: { paddingHorizontal: 16, marginTop: 20 },
  listDay: { fontSize: 14, fontWeight: '600', paddingHorizontal: 6, marginBottom: 8 },
  listCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  rowPicture: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowWords: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '600' },
});
