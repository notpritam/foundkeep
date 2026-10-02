// Search, recent folders and tags, and Kit (proposal, 2026-10-03). Pritam: replace the kind
// tabs (links, images, notes, documents) with the folders and tags your saves went into,
// kept live; make recent searches easy to reach; give search a place like the +; and a
// proper way to ask the agent, Kit, alongside plain search. Four ways, each shown in three
// states — the Library, searching, Kit answering — on today's Library and its locked card:
//   dock     a round search button in the dock beside +, opening search over the Library
//   bar      "Search or ask Kit", always there above the dock, within the thumb's reach
//   kit      Kit in the dock itself, between Gallery and You; asking is a conversation
//   top      a big search field heading the Library, recent searches right under it
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { GlassSurface } from '../../components/ScenicSurface.tsx';
import { useCollection } from '../../collection/useCollection.ts';
import { usePalette } from '../library/parts.tsx';
import { askKit } from './data.ts';
import { IconAction, JumpBackIn, KIT_ORB, KitReply, LibraryShell, PlaceChips, ProposalDock, RecentSearches, Results, SearchField, Sheet, Title, useLibrary, useRecentSearches, type Mode } from './parts.tsx';

export type SearchLook = 'dock' | 'bar' | 'kit' | 'top';
export type SearchState = 'library' | 'search' | 'kit';
const QUESTION = 'that ramen video I saved';

export function SearchProposal({ look, state = 'library' }: { look: SearchLook; state?: SearchState }) {
  if (look === 'bar') return <AskBar state={state} />;
  if (look === 'kit') return <KitInDock state={state} />;
  if (look === 'top') return <SearchFirst state={state} />;
  return <DockSearch state={state} />;
}

/** What searching knows: the words typed, plain search or Kit, what Kit was asked, and the answers. */
function useSearching(state: SearchState, typed = '') {
  const library = useLibrary();
  const recents = useRecentSearches();
  const [open, setOpen] = useState(state !== 'library');
  const [mode, setMode] = useState<Mode>(state === 'kit' ? 'kit' : 'search');
  const [query, setQuery] = useState(state === 'kit' ? QUESTION : typed);
  const [asked, setAsked] = useState(state === 'kit' ? QUESTION : '');
  const words = query.trim();
  const found = useCollection({ q: mode === 'search' && words ? words : undefined });
  const answer = useMemo(() => (asked ? askKit(asked, library.all.captures) : null), [asked, library.all.captures]);
  const run = (text: string) => { const words = text.trim(); if (!words) return; setQuery(words); recents.add(words); if (mode === 'kit') setAsked(words); };
  const changeMode = (next: Mode) => { setMode(next); if (next === 'kit' && words) { setAsked(words); recents.add(words); } };
  const close = () => { setOpen(false); setQuery(''); setAsked(''); setMode('search'); };
  return { library, recents, open, setOpen, mode, setMode: changeMode, query, setQuery: (text: string) => { setQuery(text); if (!text) setAsked(''); }, asked, found, answer, run, close, typed: words };
}
type Searching = ReturnType<typeof useSearching>;

/** What the search panel shows: Kit's answer, what the words find, or — before any — recent searches, ideas for Kit, folders and tags. */
function SearchBody({ s, onPlace }: { s: Searching; onPlace: () => void }) {
  const P = usePalette();
  if (s.mode === 'kit' && s.answer) return <KitReply question={s.asked} reply={s.answer.reply} items={s.answer.items} />;
  if (s.mode === 'search' && s.typed) return <><Text style={[styles.label, { color: P.muted }]}>{s.found.loading ? 'Searching…' : `${s.found.total} found`}</Text><Results items={s.found.captures} /></>;
  const ideas = [s.library.places.folders[0] && `What’s in ${s.library.places.folders[0].name}?`, s.library.places.tags[0] && `Videos about ${s.library.places.tags[0].name.toLowerCase()}`, QUESTION].filter(Boolean) as string[];
  return <>
    {s.recents.list.length ? <><Text style={[styles.label, { color: P.muted }]}>Recent searches</Text><RecentSearches recents={s.recents} onRun={s.run} /></> : null}
    <Text style={[styles.label, { color: P.muted }]}>Ask Kit</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ideas}>
      {ideas.map(idea => <Pressable key={idea} accessibilityRole="button" accessibilityLabel={`Ask Kit: ${idea}`} onPress={() => { s.setMode('kit'); s.setQuery(idea); s.run(idea); }} style={({ pressed }) => [styles.idea, { backgroundColor: P.accentSoft }, pressed && styles.pressed]}>
        <Image source={KIT_ORB} style={styles.ideaOrb} accessible={false} /><Text style={[styles.ideaText, { color: P.ink }]}>{idea}</Text>
      </Pressable>)}
    </ScrollView>
    <View onTouchEnd={onPlace}><PlaceChips library={s.library} label="Folders and tags" /></View>
  </>;
}

// ——— One: search beside + in the dock ———

function DockSearch({ state }: { state: SearchState }) {
  const s = useSearching(state);
  const P = usePalette();
  const insets = useSafeAreaInsets();
  return <LibraryShell library={s.library} header={<><Title /><PlaceChips library={s.library} /></>} actions={<IconAction icon="archive-outline" label="Open archive" />}>
    <ProposalDock buttons={[{ key: 'search', label: 'Search or ask Kit', icon: 'search', onPress: () => s.setOpen(true) }, { key: 'add', label: 'Create a note', icon: 'add' }]} />
    <Sheet open={s.open}>
      <View style={[styles.sheetTop, { paddingTop: insets.top + 10 }]}>
        <View style={styles.flex}><SearchField key={s.open ? 'open' : 'shut'} value={s.query} onChange={s.setQuery} mode={s.mode} onMode={s.setMode} onSubmit={() => s.run(s.query)} autoFocus={s.open && state === 'library'} /></View>
        <Pressable accessibilityRole="button" onPress={s.close} hitSlop={8} style={styles.cancel}><Text style={[styles.cancelText, { color: P.accent }]}>Cancel</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled"><SearchBody s={s} onPlace={s.close} /></ScrollView>
    </Sheet>
  </LibraryShell>;
}

// ——— Two: an ask bar above the dock ———

function AskBar({ state }: { state: SearchState }) {
  const s = useSearching(state);
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const barBottom = Math.max(insets.bottom, 12) + 60 + 10;
  return <LibraryShell library={s.library} bottomExtra={62} header={<><Title /><PlaceChips library={s.library} /></>} actions={<IconAction icon="archive-outline" label="Open archive" />}>
    <ProposalDock buttons={[{ key: 'add', label: 'Create a note', icon: 'add' }]} />
    <View style={[styles.barWrap, { bottom: barBottom }]}>
      <GlassSurface interactive style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Search your collection" onPress={() => s.setOpen(true)} style={styles.barMain}>
          <Ionicons name="search" size={19} color={P.muted} /><Text style={[styles.barText, { color: P.muted }]}>Search or ask Kit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Ask Kit" onPress={() => { s.setMode('kit'); s.setOpen(true); }} style={({ pressed }) => [styles.barKit, pressed && styles.pressed]}><Image source={KIT_ORB} style={styles.barOrb} accessible={false} /></Pressable>
      </GlassSurface>
    </View>
    <Sheet open={s.open}>
      <View style={[styles.sheetHead, { paddingTop: insets.top + 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={s.close} hitSlop={8} style={styles.round}><Ionicons name="chevron-down" size={22} color={P.ink} /></Pressable>
        <Text style={[styles.sheetTitle, { color: P.ink }]}>{s.mode === 'kit' ? 'Ask Kit' : 'Search'}</Text><View style={styles.round} />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.bodyBottom} keyboardShouldPersistTaps="handled"><SearchBody s={s} onPlace={s.close} /></ScrollView>
      <View style={{ paddingBottom: insets.bottom + 12, paddingTop: 8 }}><SearchField key={s.open ? 'open' : 'shut'} value={s.query} onChange={s.setQuery} mode={s.mode} onMode={s.setMode} onSubmit={() => s.run(s.query)} autoFocus={s.open && state === 'library'} big /></View>
    </Sheet>
  </LibraryShell>;
}

// ——— Three: Kit in the dock ———

function KitInDock({ state }: { state: SearchState }) {
  const s = useSearching(state);
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const [typing, setTyping] = useState(state === 'search' ? 'ramen' : '');
  const matches = useCollection({ q: typing.trim() || undefined });
  const send = () => { const words = typing.trim(); if (!words) return; s.setMode('kit'); s.setQuery(words); s.run(words); setTyping(''); };
  const suggestions = [...s.recents.list.slice(0, 2), ...s.library.places.folders.slice(0, 1).map(f => `What’s in ${f.name}?`), ...s.library.places.tags.slice(0, 1).map(t => `#${t.name}`)];
  return <LibraryShell library={s.library} header={<><Title /><JumpBackIn library={s.library} /></>} actions={<><IconAction icon="search" label="Search" onPress={() => s.setOpen(true)} /><IconAction icon="archive-outline" label="Open archive" /></>}>
    <ProposalDock tabs={[{ key: 'collection', label: 'Gallery', icon: 'grid-outline', selectedIcon: 'grid' }, { key: 'kit', label: 'Kit', icon: 'sparkles-outline', selectedIcon: 'sparkles', orb: true, onPress: () => s.setOpen(true) }, { key: 'settings', label: 'You', icon: 'person-circle-outline', selectedIcon: 'person-circle' }]}
      selected={s.open ? 'kit' : 'collection'} buttons={[{ key: 'add', label: 'Create a note', icon: 'add' }]} />
    <Sheet open={s.open}>
      <View style={[styles.sheetHead, { paddingTop: insets.top + 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={s.close} hitSlop={8} style={styles.round}><Ionicons name="chevron-down" size={22} color={P.ink} /></Pressable>
        <View style={styles.kitTitle}><Image source={KIT_ORB} style={styles.kitTitleOrb} accessible={false} /><Text style={[styles.sheetTitle, { color: P.ink }]}>Kit</Text></View><View style={styles.round} />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.bodyBottom} keyboardShouldPersistTaps="handled">
        {s.answer ? <KitReply question={s.asked} reply={s.answer.reply} items={s.answer.items} /> : <View style={styles.greeting}>
          <Image source={KIT_ORB} style={styles.greetOrb} accessible={false} />
          <Text style={[styles.greetText, { color: P.ink }]}>What are you looking for?</Text>
          <Text style={[styles.greetLine, { color: P.muted }]}>Ask in your own words, or type a word to search.</Text>
          <View style={styles.suggestions}>{suggestions.map(text => <Pressable key={text} accessibilityRole="button" onPress={() => { setTyping(''); s.setMode('kit'); s.setQuery(text); s.run(text); }} style={({ pressed }) => [styles.suggestion, { backgroundColor: P.surface, borderColor: P.line }, pressed && styles.pressed]}><Text style={[styles.suggestionText, { color: P.ink }]}>{text}</Text></Pressable>)}</View>
        </View>}
        {typing.trim() ? <><Text style={[styles.label, { color: P.muted }]}>Matches for “{typing.trim()}”</Text><Results items={matches.captures} limit={4} /></> : null}
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: insets.bottom + 10, borderTopColor: P.line }]}>
        <TextInput value={typing} onChangeText={setTyping} onSubmitEditing={send} placeholder="Ask Kit, or search" placeholderTextColor={P.muted} style={[styles.composerInput, { backgroundColor: P.surface, borderColor: P.line, color: P.ink }]} accessibilityLabel="Ask Kit, or search" />
        <Pressable accessibilityRole="button" accessibilityLabel="Send to Kit" onPress={send} style={({ pressed }) => [styles.send, { backgroundColor: P.ink }, pressed && styles.pressed]}><Ionicons name="arrow-up" size={20} color={P.paper} /></Pressable>
      </View>
    </Sheet>
  </LibraryShell>;
}

// ——— Four: search first ———

function SearchFirst({ state }: { state: SearchState }) {
  const s = useSearching(state, state === 'search' ? 'ramen' : '');
  const P = usePalette();
  const insets = useSafeAreaInsets();
  return <LibraryShell library={s.library} header={<>
    <Title />
    <SearchField value="" onChange={text => { s.setOpen(true); s.setQuery(text); }} mode={s.mode} onMode={next => { s.setMode(next); s.setOpen(true); }} onFocus={() => s.setOpen(true)} big />
    <View style={styles.block}><Text style={[styles.label, { color: P.muted }]}>Recent</Text><RecentSearches recents={s.recents} onRun={text => { s.setOpen(true); s.run(text); }} look="chips" /></View>
    <PlaceChips library={s.library} />
  </>} actions={<IconAction icon="archive-outline" label="Open archive" />}>
    <ProposalDock buttons={[{ key: 'add', label: 'Create a note', icon: 'add' }]} />
    <Sheet open={s.open} top={insets.top + 64}>
      <View style={styles.sheetTop}>
        <View style={styles.flex}><SearchField key={s.open ? 'open' : 'shut'} value={s.query} onChange={s.setQuery} mode={s.mode} onMode={s.setMode} onSubmit={() => s.run(s.query)} autoFocus={s.open && state === 'library'} big /></View>
        <Pressable accessibilityRole="button" onPress={s.close} hitSlop={8} style={styles.cancel}><Text style={[styles.cancelText, { color: P.accent }]}>Cancel</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled"><SearchBody s={s} onPlace={s.close} /></ScrollView>
    </Sheet>
  </LibraryShell>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  block: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20, marginTop: 6 },
  ideas: { gap: 8, paddingHorizontal: 16 },
  idea: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 20 },
  ideaOrb: { width: 24, height: 24 },
  ideaText: { fontSize: 14.5, fontWeight: '600' },
  sheetTop: { flexDirection: 'row', alignItems: 'center', paddingRight: 16, paddingBottom: 10 },
  cancel: { paddingLeft: 2 },
  cancelText: { fontSize: 16, fontWeight: '600' },
  body: { gap: 12, paddingTop: 6 },
  bodyBottom: { gap: 12, paddingTop: 6, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  barWrap: { position: 'absolute', left: 16, right: 16, zIndex: 4 },
  bar: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 6 },
  barMain: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  barText: { fontSize: 16 },
  barKit: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  barOrb: { width: 34, height: 34 },
  kitTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kitTitleOrb: { width: 26, height: 26 },
  greeting: { alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingBottom: 12 },
  greetOrb: { width: 72, height: 72, marginBottom: 6 },
  greetText: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  greetLine: { fontSize: 15, textAlign: 'center' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  suggestion: { paddingHorizontal: 14, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  suggestionText: { fontSize: 14.5, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  composerInput: { flex: 1, minHeight: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
