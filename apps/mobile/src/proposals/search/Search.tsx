// Search and Kit (proposal, 2026-10-03). Pritam: replace the kind tabs with the folders and tags
// saves went into, kept live; make recent searches easy to reach; give search a place like the +;
// and — "make the search and Ask Kit the same" — one field, "Search or ask Kit", with no switch:
// searching *is* asking Kit. The backend decides whether it's a word to look for or a question
// (here findSaves stands in), and the screen stays a plain search: Kit's line on top when it has
// something to say, then the saves. Four places for it, each in three states — the Library, a
// word, a question — on today's Library and its locked card:
//   dock     a round search button beside + in the dock
//   bar      "Search or ask Kit", always above the dock, within the thumb's reach
//   tab      Search as a tab in the dock, between Gallery and You
//   top      the field heading the Library, recent searches right under it
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { useCollection } from '../../collection/useCollection.ts';
import { usePalette } from '../library/parts.tsx';
import { findSaves, isQuestion } from './data.ts';
import { Findings, IconAction, JumpBackIn, KIT_ORB, LibraryShell, PlaceChips, ProposalDock, RecentSearches, SearchButton, SearchField, Sheet, Title, useLibrary, useRecentSearches } from './parts.tsx';

export type SearchLook = 'dock' | 'bar' | 'tab' | 'top';
export type SearchState = 'library' | 'word' | 'question';
const START: Record<SearchState, string> = { library: '', word: 'ramen', question: 'that ramen video I saved' };

export function SearchProposal({ look, state = 'library' }: { look: SearchLook; state?: SearchState }) {
  const s = useSearching(state);
  if (look === 'bar') return <AskBar s={s} />;
  if (look === 'tab') return <SearchTab s={s} />;
  if (look === 'top') return <SearchFirst s={s} />;
  return <DockSearch s={s} />;
}

/** One field: what's typed, and what it finds — matches for a word, Kit's answer for a question. */
function useSearching(state: SearchState) {
  const library = useLibrary();
  const recents = useRecentSearches();
  const [open, setOpen] = useState(state !== 'library');
  const [query, setQuery] = useState(START[state]);
  const words = query.trim();
  const matches = useCollection({ q: words && !isQuestion(words) ? words : undefined });
  const found = useMemo(() => findSaves(words, library.all.captures, matches.captures), [words, library.all.captures, matches.captures]);
  const run = (text: string) => { const next = text.trim(); if (!next) return; setQuery(next); recents.add(next); setOpen(true); };
  const close = () => { setOpen(false); setQuery(''); };
  return { library, recents, open, setOpen, query, setQuery, words, found, loading: Boolean(words && !isQuestion(words) && matches.loading), run, close };
}
type Searching = ReturnType<typeof useSearching>;

/** Under the field: what was found; before anything's typed, recent searches, questions to try, and folders and tags. */
function SearchBody({ s }: { s: Searching }) {
  const P = usePalette();
  if (s.words) return <Findings note={s.found.note} items={s.found.items} loading={s.loading} />;
  const folder = s.library.places.folders[0], tag = s.library.places.tags[0];
  const tries = [START.question, folder && `What’s in ${folder.name}?`, tag && `Videos about ${tag.name.toLowerCase()}`].filter(Boolean) as string[];
  return <>
    {s.recents.list.length ? <><Text style={[styles.label, { color: P.muted }]}>Recent</Text><RecentSearches recents={s.recents} onRun={s.run} /></> : null}
    <Text style={[styles.label, { color: P.muted }]}>Try asking</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tries}>
      {tries.map(text => <Pressable key={text} accessibilityRole="button" accessibilityLabel={`Search: ${text}`} onPress={() => s.run(text)} style={({ pressed }) => [styles.try, { backgroundColor: P.accentSoft }, pressed && styles.pressed]}>
        <Image source={KIT_ORB} style={styles.tryOrb} accessible={false} /><Text style={[styles.tryText, { color: P.ink }]}>{text}</Text>
      </Pressable>)}
    </ScrollView>
    <PlaceChips library={s.library} label="Folders and tags" />
  </>;
}
/** Searching, over the Library: the field at the top (`at="top"`) or at the bottom, by the thumb. */
function SearchPanel({ s, at, top = 0 }: { s: Searching; at: 'top' | 'bottom'; top?: number }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const field = <SearchField key={s.open ? 'open' : 'shut'} value={s.query} onChange={s.setQuery} onSubmit={() => s.run(s.query)} autoFocus={s.open && !s.words} big={at === 'bottom'} />;
  if (at === 'top') return <Sheet open={s.open} top={top}>
    <View style={[styles.sheetTop, { paddingTop: top ? 0 : insets.top + 10 }]}>
      <View style={styles.flex}>{field}</View>
      <Pressable accessibilityRole="button" onPress={s.close} hitSlop={8}><Text style={[styles.cancel, { color: P.accent }]}>Cancel</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled"><SearchBody s={s} /></ScrollView>
  </Sheet>;
  return <Sheet open={s.open}>
    <View style={[styles.sheetHead, { paddingTop: insets.top + 6 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={s.close} hitSlop={8} style={styles.round}><Ionicons name="chevron-down" size={22} color={P.ink} /></Pressable>
      <Text style={[styles.sheetTitle, { color: P.ink }]}>Search</Text><View style={styles.round} />
    </View>
    <ScrollView style={styles.flex} contentContainerStyle={styles.bodyBottom} keyboardShouldPersistTaps="handled"><SearchBody s={s} /></ScrollView>
    <View style={{ paddingBottom: insets.bottom + 12, paddingTop: 8 }}>{field}</View>
  </Sheet>;
}

// ——— One: a search button beside + ———

function DockSearch({ s }: { s: Searching }) {
  return <LibraryShell library={s.library} header={<><Title /><PlaceChips library={s.library} /></>} actions={<IconAction icon="archive-outline" label="Open archive" />}>
    <ProposalDock buttons={[{ key: 'search', label: 'Search or ask Kit', icon: 'search', onPress: () => s.setOpen(true) }, { key: 'add', label: 'Create a note', icon: 'add' }]} />
    <SearchPanel s={s} at="top" />
  </LibraryShell>;
}

// ——— Two: an ask bar above the dock ———

function AskBar({ s }: { s: Searching }) {
  const insets = useSafeAreaInsets();
  return <LibraryShell library={s.library} bottomExtra={62} header={<><Title /><PlaceChips library={s.library} /></>} actions={<IconAction icon="archive-outline" label="Open archive" />}>
    <ProposalDock buttons={[{ key: 'add', label: 'Create a note', icon: 'add' }]} />
    <View style={[styles.barWrap, { bottom: Math.max(insets.bottom, 12) + 70 }]}>
      <SearchButton onPress={() => s.setOpen(true)} big style={styles.bar} />
    </View>
    <SearchPanel s={s} at="bottom" />
  </LibraryShell>;
}

// ——— Three: Search as a tab ———

function SearchTab({ s }: { s: Searching }) {
  return <LibraryShell library={s.library} header={<><Title /><JumpBackIn library={s.library} /></>} actions={<IconAction icon="archive-outline" label="Open archive" />}>
    <ProposalDock tabs={[{ key: 'collection', label: 'Gallery', icon: 'grid-outline', selectedIcon: 'grid' }, { key: 'search', label: 'Search', icon: 'search', selectedIcon: 'search', orb: true, onPress: () => s.setOpen(true) }, { key: 'settings', label: 'You', icon: 'person-circle-outline', selectedIcon: 'person-circle' }]}
      selected={s.open ? 'search' : 'collection'} buttons={[{ key: 'add', label: 'Create a note', icon: 'add' }]} />
    <SearchPanel s={s} at="bottom" />
  </LibraryShell>;
}

// ——— Four: the field heading the Library ———

function SearchFirst({ s }: { s: Searching }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  return <LibraryShell library={s.library} header={<>
    <Title />
    <SearchButton onPress={() => s.setOpen(true)} big />
    <View style={styles.block}><Text style={[styles.label, { color: P.muted }]}>Recent</Text><RecentSearches recents={s.recents} onRun={s.run} look="chips" /></View>
    <PlaceChips library={s.library} />
  </>} actions={<IconAction icon="archive-outline" label="Open archive" />}>
    <ProposalDock buttons={[{ key: 'add', label: 'Create a note', icon: 'add' }]} />
    <SearchPanel s={s} at="top" top={insets.top + 64} />
  </LibraryShell>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  block: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20, marginTop: 6 },
  tries: { gap: 8, paddingHorizontal: 16 },
  try: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 20 },
  tryOrb: { width: 24, height: 24 },
  tryText: { fontSize: 14.5, fontWeight: '600' },
  sheetTop: { flexDirection: 'row', alignItems: 'center', paddingRight: 16, paddingBottom: 10 },
  cancel: { fontSize: 16, fontWeight: '600' },
  body: { gap: 12, paddingTop: 6 },
  bodyBottom: { gap: 12, paddingTop: 6, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  barWrap: { position: 'absolute', left: 0, right: 0, zIndex: 4 },
  bar: { shadowColor: '#06203a', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
});
