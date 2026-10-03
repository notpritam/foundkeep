// Search and Ask Kit as locked (Pritam, 2026-10-03): today's Library with Jump back in; the
// magnifier in the top bar opens Search (its field at the bottom); Kit's orb — the logo only —
// beside + in the dock opens Ask Kit, a conversation. Composed on the proposals' Library shell
// and dock until the app's own Library takes them.
//
// Closed 2026-10-03 (Pritam: "you got both right — the final version, and some variations"). The
// final is the default; the variations, kept as options: `home` — greeting (the final: "Good morning,
// Lena" and your counts), collection ("The collection.", the first final), compact (no big title: Jump back in right
// under the top bar), nudge (a small card inviting a question to Kit); and Ask Kit's own
// (`answers`, `thinking`: see kit/AskKit).
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { DockProvider } from '../../components/FloatingDock.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { AskKit, type KitAnswers } from '../../kit/AskKit.tsx';
import { KIT_ORB, usePalette } from '../../kit/pieces.tsx';
import { greeting } from '../../home/greeting.ts';
import { SearchPanel } from '../../kit/SearchPanel.tsx';
import { openSave } from '../library/parts.tsx';
import { IconAction, JumpBackIn, LibraryShell, ProposalDock, Title, useLibrary, useRecentSearches } from '../search/parts.tsx';

export type LockedState = 'library' | 'search' | 'word' | 'kit' | 'question' | 'followup';
const SEED: Partial<Record<LockedState, string[]>> = { question: ['recent post I saved from twitter'], followup: ['recent post I saved from twitter', 'about cats'] };

/** greeting is the final (Pritam, 2026-10-03: "clean, we'll use that"); collection was the first final. */
export type HomeLook = 'greeting' | 'collection' | 'compact' | 'nudge';
type Options = { home?: HomeLook; answers?: KitAnswers; thinking?: boolean };
export function SearchAndKit({ state = 'library', ...options }: { state?: LockedState } & Options) {
  return <DockProvider><Screen state={state} {...options} /></DockProvider>;
}
function Screen({ state, home = 'greeting', answers, thinking }: { state: LockedState } & Options) {
  const library = useLibrary();
  const recents = useRecentSearches();
  const [searching, setSearching] = useState(state === 'search' || state === 'word');
  const [asking, setAsking] = useState(state === 'kit' || state === 'question' || state === 'followup');
  const [questions, setQuestions] = useState<string[]>(SEED[state] ?? []);
  const askKit = (question: string) => { setQuestions([question]); setAsking(true); };
  const header = home === 'compact' ? <View style={styles.compact}><JumpBackIn library={library} /></View>
    : <>{home === 'collection' ? <Title /> : <Greeting saves={library.all.total} folders={library.places.folders.length} />}<JumpBackIn library={library} />{home === 'nudge' ? <KitNudge onAsk={askKit} tag={library.places.tags[0]?.name} /> : null}</>;
  return <LibraryShell library={library} header={header}
    actions={<><IconAction icon="search" label="Search your saves" onPress={() => setSearching(true)} /><IconAction icon="archive-outline" label="Open archive" /></>}>
    <ProposalDock buttons={[{ key: 'kit', label: 'Ask Kit', orb: true, onPress: () => setAsking(true) }, { key: 'add', label: 'Create a note', icon: 'add' }]} />
    <SearchPanel open={searching} onClose={() => setSearching(false)} start={state === 'word' ? 'ramen' : ''} recents={recents.list} onRecent={recents.add} onForget={recents.remove}
      places={library.places} selected={library.filter} onChoose={library.toggle} onOpen={openSave}
      onAskKit={question => { setSearching(false); setQuestions([question]); setAsking(true); }} />
    <AskKit open={asking} onClose={() => { setAsking(false); setQuestions([]); }} questions={questions} onQuestions={setQuestions}
      captures={library.all.captures} tags={library.places.tags.map(tag => tag.name)} onOpen={openSave} answers={answers} thinking={thinking} />
  </LibraryShell>;
}

/** Greeting: hello by name — the time of day, "Hey Lena", "Welcome back, Lena" (home/greeting:
 * steady for each part of the day, never past one line) — then how much you've kept. */
function Greeting({ saves, folders }: { saves: number; folders: number }) {
  const P = usePalette();
  const { account } = useSession();
  return <View style={styles.greeting}>
    <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.greetingText, { color: P.ink }]}>{greeting(account?.name)}</Text>
    <Text style={[styles.greetingLine, { color: P.muted }]}>{saves} saves · {folders} folders</Text>
  </View>;
}
/** Kit nudge: a small card under Jump back in; tapping it asks Kit the example. */
function KitNudge({ onAsk, tag }: { onAsk: (question: string) => void; tag?: string }) {
  const P = usePalette();
  const example = tag ? `videos about ${tag.toLowerCase()}` : 'recent post I saved from twitter';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ask Kit: ${example}`} onPress={() => onAsk(example)} style={({ pressed }) => [styles.nudge, { backgroundColor: P.accentSoft }, pressed && styles.pressed]}>
    <Image source={KIT_ORB} style={styles.nudgeOrb} accessible={false} />
    <View style={styles.nudgeWords}>
      <Text style={[styles.nudgeTitle, { color: P.ink }]}>Ask Kit about anything you saved</Text>
      <Text style={[styles.nudgeLine, { color: P.muted }]} numberOfLines={1}>Try “{example}”</Text>
    </View>
    <Ionicons name="arrow-forward" size={18} color={P.ink} />
  </Pressable>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  compact: { paddingTop: 4 },
  greeting: { paddingHorizontal: 20, gap: 5 },
  greetingText: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.9 },
  greetingLine: { fontSize: 14.5, lineHeight: 20 },
  nudge: { marginHorizontal: 16, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nudgeOrb: { width: 38, height: 38 },
  nudgeWords: { flex: 1, gap: 2 },
  nudgeTitle: { fontSize: 15.5, fontWeight: '700' },
  nudgeLine: { fontSize: 13.5 },
});
