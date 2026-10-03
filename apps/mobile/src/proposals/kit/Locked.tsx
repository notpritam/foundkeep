// Search and Ask Kit as locked (Pritam, 2026-10-03): today's Library with Jump back in; the
// magnifier in the top bar opens Search (its field at the bottom); Kit's orb — the logo only —
// beside + in the dock opens Ask Kit, a conversation. Composed on the proposals' Library shell
// and dock until the app's own Library takes them.
import { useState } from 'react';
import { DockProvider } from '../../components/FloatingDock.tsx';
import { AskKit } from '../../kit/AskKit.tsx';
import { SearchPanel } from '../../kit/SearchPanel.tsx';
import { openSave } from '../library/parts.tsx';
import { IconAction, JumpBackIn, LibraryShell, ProposalDock, Title, useLibrary, useRecentSearches } from '../search/parts.tsx';

export type LockedState = 'library' | 'search' | 'word' | 'kit' | 'question' | 'followup';
const SEED: Partial<Record<LockedState, string[]>> = { question: ['recent post I saved from twitter'], followup: ['recent post I saved from twitter', 'about cats'] };

export function SearchAndKit({ state = 'library' }: { state?: LockedState }) {
  return <DockProvider><Screen state={state} /></DockProvider>;
}
function Screen({ state }: { state: LockedState }) {
  const library = useLibrary();
  const recents = useRecentSearches();
  const [searching, setSearching] = useState(state === 'search' || state === 'word');
  const [asking, setAsking] = useState(state === 'kit' || state === 'question' || state === 'followup');
  const [questions, setQuestions] = useState<string[]>(SEED[state] ?? []);
  return <LibraryShell library={library} header={<><Title /><JumpBackIn library={library} /></>}
    actions={<><IconAction icon="search" label="Search your saves" onPress={() => setSearching(true)} /><IconAction icon="archive-outline" label="Open archive" /></>}>
    <ProposalDock buttons={[{ key: 'kit', label: 'Ask Kit', orb: true, onPress: () => setAsking(true) }, { key: 'add', label: 'Create a note', icon: 'add' }]} />
    <SearchPanel open={searching} onClose={() => setSearching(false)} start={state === 'word' ? 'ramen' : ''} recents={recents.list} onRecent={recents.add} onForget={recents.remove}
      places={library.places} selected={library.filter} onChoose={library.toggle} onOpen={openSave}
      onAskKit={question => { setSearching(false); setQuestions([question]); setAsking(true); }} />
    <AskKit open={asking} onClose={() => { setAsking(false); setQuestions([]); }} questions={questions} onQuestions={setQuestions}
      captures={library.all.captures} tags={library.places.tags.map(tag => tag.name)} onOpen={openSave} />
  </LibraryShell>;
}
