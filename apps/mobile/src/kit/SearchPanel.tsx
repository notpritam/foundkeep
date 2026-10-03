import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { Capture } from '../api/types.ts';
import { AdaptiveText as Text } from '../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../components/AdaptiveIcon.tsx';
import { JumpBackIn, type PlaceFilter } from '../components/JumpBackIn.tsx';
import type { FolderPlace, Place } from '../collection/places.ts';
import { useCollection } from '../collection/useCollection.ts';
import { Field, Head, KIT_ORB, Label, Panel, RecentRows, SaveRows, Scrolling, usePalette } from './pieces.tsx';

// Search (Pritam, 2026-10-03, locked): opened from the magnifier in the top bar. The field sits at
// the bottom, by the thumb, so it's easy to reach and type; above it, before anything's typed,
// recent searches (big rows) and Jump back in; then the saves that match, newest first, with
// "Ask Kit about …" to hand the words to Kit.
export function SearchPanel({ open, onClose, recents, onRecent, onForget, places, selected, onChoose, onAskKit, onOpen, start = '', typed }: {
  open: boolean; onClose: () => void; recents: string[]; onRecent: (query: string) => void; onForget: (query: string) => void;
  places: { folders: FolderPlace[]; tags: Place[] }; selected: PlaceFilter; onChoose: (place: PlaceFilter) => void;
  onAskKit: (question: string) => void; onOpen: (capture: Capture) => void; start?: string;
  /** typed: what's in the field, from outside (a playthrough typing it); otherwise the field's own. */
  typed?: string;
}) {
  const P = usePalette();
  const [own, setQuery] = useState(start);
  const query = typed ?? own;
  const words = query.trim();
  const found = useCollection({ q: words || undefined });
  const close = () => { onClose(); setQuery(''); };
  const remember = () => { if (words) onRecent(words); };
  return <Panel open={open}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
      <Scrolling>
      <View style={styles.body}>
        {words ? <>
          <Label>{found.loading ? 'Searching…' : `${found.total} ${found.total === 1 ? 'save' : 'saves'}`}</Label>
          {found.captures.length ? <SaveRows items={found.captures} onOpen={capture => { remember(); onOpen(capture); }} /> : found.loading ? null : <Text style={[styles.none, { color: P.muted }]}>Nothing with those words yet.</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={`Ask Kit about ${words}`} onPress={() => { remember(); onAskKit(words); setQuery(''); }} style={({ pressed }) => [styles.askKit, { backgroundColor: P.accentSoft }, pressed && styles.pressed]}>
            <Image source={KIT_ORB} style={styles.orb} accessible={false} /><Text style={[styles.askText, { color: P.ink }]} numberOfLines={1}>Ask Kit about “{words}”</Text><Ionicons name="arrow-forward" size={17} color={P.ink} />
          </Pressable>
        </> : <>
          <JumpBackIn places={places} selected={selected} onChoose={place => { onChoose(place); close(); }} />
          {recents.length ? <><Label>Recent</Label><RecentRows list={recents} onRun={setQuery} onRemove={onForget} /></> : null}
        </>}
      </View>
      </Scrolling>
      <Head title="Search" onClose={close} />
      </View>
      <Field key={open ? 'open' : 'shut'} value={query} onChange={setQuery} onSubmit={remember} placeholder="Search your saves" autoFocus={open && !start} />
    </KeyboardAvoidingView>
  </Panel>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  // Bottom-aligned, so what's nearest the field is what's nearest the thumb.
  body: { gap: 12 },
  none: { fontSize: 15, textAlign: 'center', paddingVertical: 16 },
  askKit: { marginHorizontal: 16, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  orb: { width: 26, height: 26 },
  askText: { flex: 1, fontSize: 15.5, fontWeight: '600' },
});
