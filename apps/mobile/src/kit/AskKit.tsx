import { useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Capture } from '../api/types.ts';
import { AdaptiveText as Text } from '../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../components/AdaptiveIcon.tsx';
import { GalleryCard } from '../components/GalleryCard.tsx';
import { converse, followUps } from './conversation.ts';
import { Field, Head, KIT_ORB, Panel, usePalette } from './pieces.tsx';

// Ask Kit (Pritam, 2026-10-03, locked): opened from Kit's orb beside + in the dock. A conversation
// — your questions and Kit's answers, each answer one short line (a touch larger) and the saves it
// found in a row of the Library's own cards. A follow-up ("about cats") narrows what was asked
// (kit/conversation). Under the thread, what to ask next; the field at the bottom, by the thumb.
// Kit here reads the library on the phone; the real one answers on the backend.
export function AskKit({ open, onClose, questions, onQuestions, captures, tags, onOpen, draft }: {
  open: boolean; onClose: () => void; questions: string[]; onQuestions: (questions: string[]) => void;
  captures: Capture[]; tags: string[]; onOpen: (capture: Capture) => void;
  /** draft: what's in the field, from outside (a playthrough typing it). */
  draft?: string;
}) {
  const P = usePalette();
  const [own, setText] = useState('');
  const text = draft ?? own;
  const turns = useMemo(() => converse(questions, captures), [questions, captures]);
  const next = followUps(turns[turns.length - 1]?.context ?? null, tags);
  const ask = (question: string) => { const words = question.trim(); if (words) onQuestions([...questions, words]); setText(''); };
  const thread = useRef<ScrollView>(null);
  return <Panel open={open}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Head title="Ask Kit" orb onClose={() => { onClose(); setText(''); }} action={turns.length ? <Pressable accessibilityRole="button" accessibilityLabel="Start over" onPress={() => onQuestions([])} hitSlop={8}><Ionicons name="create-outline" size={20} color={P.ink} /></Pressable> : null} />
      <ScrollView ref={thread} style={styles.flex} contentContainerStyle={styles.thread} onContentSizeChange={() => thread.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">
        {turns.length ? turns.map((turn, i) => <View key={i} style={styles.turn}>
          <View style={[styles.you, { backgroundColor: P.ink }]}><Text style={[styles.youText, { color: P.paper }]}>{turn.question}</Text></View>
          <View style={styles.kit} accessibilityLiveRegion={i === turns.length - 1 ? 'polite' : 'none'}>
            <Image source={KIT_ORB} style={styles.kitOrb} accessible={false} />
            <Text style={[styles.kitText, { color: P.ink }]}>{turn.reply}</Text>
          </View>
          {turn.items.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {turn.items.slice(0, 8).map(capture => <View key={capture.id} style={styles.card}><GalleryCard capture={capture} onOpen={onOpen} /></View>)}
          </ScrollView> : null}
        </View>) : <View style={styles.hello}>
          <Image source={KIT_ORB} style={styles.helloOrb} accessible={false} />
          <Text style={[styles.helloTitle, { color: P.ink }]}>What are you looking for?</Text>
          <Text style={[styles.helloLine, { color: P.muted }]}>Ask in your own words, then keep going.</Text>
        </View>}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nextRow} contentContainerStyle={styles.next} keyboardShouldPersistTaps="handled">
        {next.map(question => <Pressable key={question} accessibilityRole="button" accessibilityLabel={`Ask Kit: ${question}`} onPress={() => ask(question)} style={({ pressed }) => [styles.chip, { backgroundColor: P.surface, borderColor: P.line }, pressed && styles.pressed]}>
          <Text style={[styles.chipText, { color: P.ink }]}>{question}</Text>
        </Pressable>)}
      </ScrollView>
      <Field kit value={text} onChange={setText} onSubmit={() => ask(text)} placeholder={turns.length ? 'Ask a follow-up' : 'Ask Kit'} />
    </KeyboardAvoidingView>
  </Panel>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  thread: { flexGrow: 1, justifyContent: 'flex-end', gap: 20, paddingTop: 8, paddingBottom: 10 },
  turn: { gap: 10 },
  you: { alignSelf: 'flex-end', marginRight: 16, marginLeft: 60, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  youText: { fontSize: 16, lineHeight: 22 },
  kit: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  kitOrb: { width: 28, height: 28 },
  // Kit's line: short, and a touch larger than the rest (Pritam).
  kitText: { flex: 1, fontSize: 17.5, lineHeight: 24, fontWeight: '500', letterSpacing: -0.2 },
  cards: { gap: 10, paddingLeft: 54, paddingRight: 16 },
  card: { width: 158 },
  hello: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingBottom: 8 },
  helloOrb: { width: 64, height: 64, marginBottom: 4 },
  helloTitle: { fontSize: 21, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  helloLine: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  nextRow: { flexGrow: 0 },
  next: { gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
});
