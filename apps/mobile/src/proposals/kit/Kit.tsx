// Ask Kit (proposal, 2026-10-03). Pritam picked the field above the dock — "Ask Kit", no
// "Search" — opening at the bottom, by the thumb; and asked for a conversation: "recent post I
// saved from Twitter", then "about cats", and Kit keeps up. Four ways to hold that conversation,
// each opened from the same bar, each in three states — just opened, one question, a follow-up:
//   chat     a conversation: your questions and Kit's answers, the saves it found in a row of cards
//   grid     each answer lays the saves out as the Library does; earlier turns fold to one line
//   half     a half sheet: the Library above becomes Kit's answer, the conversation stays below
//   trail    no bubbles: what Kit understood as chips you can take away, and the saves as a list
// Under every one: what to ask next, as chips, and the field. Kit is a stand-in (conversation.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Capture } from '../../api/types.ts';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { GalleryCard } from '../../components/GalleryCard.tsx';
import type { useCollection } from '../../collection/useCollection.ts';
import { openSave, usePalette } from '../library/parts.tsx';
import { IconAction, JumpBackIn, KIT_ORB, LibraryShell, ProposalDock, Results, SearchButton, Sheet, Title, useLibrary } from '../search/parts.tsx';
import { converse, describe, followUps, savesFor, type Ask, type Turn } from './conversation.ts';

export type KitLook = 'chat' | 'grid' | 'half' | 'trail';
export type KitState = 'open' | 'first' | 'followup';
const SEED: Record<KitState, string[]> = { open: [], first: ['recent post I saved from twitter'], followup: ['recent post I saved from twitter', 'about cats'] };

export function KitProposal({ look, state = 'open' }: { look: KitLook; state?: KitState }) {
  const k = useKit(state);
  const insets = useSafeAreaInsets();
  const half = look === 'half' && k.open && k.turns.length > 0;
  return <LibraryShell library={k.library} collection={half ? k.answerCollection : undefined} bottomExtra={62}
    header={half ? <View style={{ height: 52 }} /> : <><Title /><JumpBackIn library={k.library} /></>} actions={<IconAction icon="archive-outline" label="Open archive" />}>
    <ProposalDock buttons={[{ key: 'add', label: 'Create a note', icon: 'add' }]} />
    {/* The bar: "Ask Kit", always above the dock. */}
    <View style={[styles.barWrap, { bottom: Math.max(insets.bottom, 12) + 70 }]}><SearchButton onPress={() => k.setOpen(true)} big label="Ask Kit" style={styles.bar} /></View>
    {look === 'chat' ? <Chat k={k} /> : look === 'grid' ? <GridAnswers k={k} /> : look === 'half' ? <HalfSheet k={k} /> : <Trail k={k} />}
  </LibraryShell>;
}

/** The conversation: the questions so far, Kit's turns, asking, starting over. */
function useKit(state: KitState) {
  const library = useLibrary();
  // Every state opens on the panel — it's what's being designed; closing shows the Library and its bar.
  const [open, setOpen] = useState(true);
  const [questions, setQuestions] = useState<string[]>(SEED[state]);
  const turns = useMemo(() => converse(questions, library.all.captures), [questions, library.all.captures]);
  const last: Turn | undefined = turns[turns.length - 1];
  const ask = (text: string) => { const words = text.trim(); if (words) setQuestions(list => [...list, words]); };
  const restart = () => setQuestions([]);
  const close = () => { setOpen(false); setQuestions([]); };
  const suggestions = followUps(last?.context ?? null, library.places.tags.map(tag => tag.name));
  const answerCollection = collectionOf(last?.items ?? []);
  return { library, open, setOpen, questions, turns, last, ask, restart, close, suggestions, answerCollection };
}
type Kit = ReturnType<typeof useKit>;

/** A list of saves shaped like the Library's data, so the gallery can show Kit's answer. */
function collectionOf(items: Capture[]): ReturnType<typeof useCollection> {
  return { captures: items, loading: false, refreshing: false, loadingMore: false, total: items.length, error: '', refresh: async () => {}, loadMore: async () => {} };
}

// ——— What every panel shares ———

/** The panel, from the bottom: a header, what's been said, what to ask next, the field. */
function Panel({ k, title = 'Kit', children, height }: { k: Kit; title?: string; children: React.ReactNode; height?: number }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const body = <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.head, { paddingTop: height ? 8 : insets.top + 6 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={k.close} hitSlop={8} style={styles.round}><Ionicons name="chevron-down" size={22} color={P.ink} /></Pressable>
      <View style={styles.headTitle}><Image source={KIT_ORB} style={styles.headOrb} accessible={false} /><Text style={[styles.title, { color: P.ink }]}>{title}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Start over" onPress={k.restart} hitSlop={8} style={[styles.round, !k.turns.length && styles.hidden]} disabled={!k.turns.length}><Ionicons name="create-outline" size={20} color={P.ink} /></Pressable>
    </View>
    {children}
    <Next k={k} />
    <Composer k={k} />
  </KeyboardAvoidingView>;
  if (height) return k.open ? <View style={[styles.half, { height, backgroundColor: P.paper, shadowColor: P.shadow }]}>{body}</View> : null;
  return <Sheet open={k.open}>{body}</Sheet>;
}
/** What to ask next, as chips: a tap asks it. */
function Next({ k }: { k: Kit }) {
  const P = usePalette();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nextRow} contentContainerStyle={styles.next} keyboardShouldPersistTaps="handled">
    {k.suggestions.map(text => <Pressable key={text} accessibilityRole="button" accessibilityLabel={`Ask Kit: ${text}`} onPress={() => k.ask(text)} style={({ pressed }) => [styles.chip, { backgroundColor: P.surface, borderColor: P.line }, pressed && styles.pressed]}>
      <Text style={[styles.chipText, { color: P.ink }]}>{text}</Text>
    </Pressable>)}
  </ScrollView>;
}
/** The field: "Ask Kit", and send. */
function Composer({ k }: { k: Kit }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const send = () => { k.ask(text); setText(''); };
  return <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
    <View style={[styles.field, { backgroundColor: P.surface, borderColor: P.line }]}>
      <Image source={KIT_ORB} style={styles.fieldOrb} accessible={false} />
      <TextInput value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send" placeholder={k.turns.length ? 'Ask a follow-up' : 'Ask Kit'} placeholderTextColor={P.muted} style={[styles.input, { color: P.ink }]} accessibilityLabel="Ask Kit" />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!text.trim()} onPress={send} style={({ pressed }) => [styles.send, { backgroundColor: text.trim() ? P.ink : P.line }, pressed && styles.pressed]}><Ionicons name="arrow-up" size={19} color={P.paper} /></Pressable>
    </View>
  </View>;
}
/** Before anything's asked: what Kit can do, briefly. */
function Hello() {
  const P = usePalette();
  return <View style={styles.hello}>
    <Image source={KIT_ORB} style={styles.helloOrb} accessible={false} />
    <Text style={[styles.helloTitle, { color: P.ink }]}>What are you looking for?</Text>
    <Text style={[styles.helloLine, { color: P.muted }]}>Ask in your own words — then keep going: “about cats”, “from Instagram”.</Text>
  </View>;
}
function You({ text }: { text: string }) {
  const P = usePalette();
  return <View style={[styles.you, { backgroundColor: P.ink }]}><Text style={[styles.youText, { color: P.paper }]}>{text}</Text></View>;
}
function KitSays({ text, compact = false }: { text: string; compact?: boolean }) {
  const P = usePalette();
  return <View style={styles.kitRow}>
    <Image source={KIT_ORB} style={compact ? styles.kitOrbSmall : styles.kitOrb} accessible={false} />
    <Text style={[compact ? styles.kitTextSmall : styles.kitText, { color: compact ? P.muted : P.ink }]}>{text}</Text>
  </View>;
}
/** The thread scrolls to the newest turn as it grows. */
function Thread({ children }: { children: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);
  return <ScrollView ref={ref} style={styles.flex} contentContainerStyle={styles.thread} onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}

// ——— One: a conversation ———

function Chat({ k }: { k: Kit }) {
  return <Panel k={k}>
    <Thread>
      {k.turns.length ? k.turns.map((turn, i) => <View key={i} style={styles.turn}>
        <You text={turn.question} />
        <KitSays text={turn.reply} />
        {turn.items.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {turn.items.slice(0, 8).map(capture => <View key={capture.id} style={styles.stripCard}><GalleryCard capture={capture} onOpen={openSave} /></View>)}
        </ScrollView> : null}
      </View>) : <Hello />}
    </Thread>
  </Panel>;
}

// ——— Two: answers laid out like the Library ———

function GridAnswers({ k }: { k: Kit }) {
  const P = usePalette();
  const { width } = useWindowDimensions();
  const column = (width - 16 * 2 - 10) / 2;
  return <Panel k={k}>
    <Thread>
      {k.turns.length ? k.turns.map((turn, i) => {
        const latest = i === k.turns.length - 1;
        if (!latest) return <View key={i} style={[styles.folded, { borderColor: P.line }]}>
          <Text style={[styles.foldedQuestion, { color: P.ink }]} numberOfLines={1}>{turn.question}</Text>
          <Text style={[styles.foldedCount, { color: P.muted }]}>{turn.items.length} {turn.items.length === 1 ? 'save' : 'saves'}</Text>
        </View>;
        const columns: Capture[][] = [[], []];
        turn.items.slice(0, 10).forEach((capture, j) => columns[j % 2].push(capture));
        return <View key={i} style={styles.turn}>
          <You text={turn.question} />
          <KitSays text={turn.reply} />
          <View style={styles.grid}>{columns.map((col, c) => <View key={c} style={{ width: column, gap: 10 }}>{col.map(capture => <GalleryCard key={capture.id} capture={capture} onOpen={openSave} />)}</View>)}</View>
        </View>;
      }) : <Hello />}
    </Thread>
  </Panel>;
}

// ——— Three: a half sheet; the Library above is the answer ———

function HalfSheet({ k }: { k: Kit }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const answered = k.turns.length > 0;
  return <>
    {answered && k.open ? <View style={[styles.contextPill, { top: insets.top + 64, backgroundColor: P.ink }]}>
      <Image source={KIT_ORB} style={styles.pillOrb} accessible={false} />
      <Text style={[styles.pillText, { color: P.paper }]} numberOfLines={1}>{describe(k.last!.context)} · {k.last!.items.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to the whole Library" onPress={k.close} hitSlop={8}><Ionicons name="close" size={17} color={P.paper} /></Pressable>
    </View> : null}
    <Panel k={k} height={answered ? Math.round(height * 0.44) : Math.round(height * 0.5)}>
      <Thread>
        {answered ? k.turns.slice(-2).map((turn, i) => <View key={i} style={styles.turnTight}><You text={turn.question} /><KitSays text={turn.reply} /></View>) : <Hello />}
      </Thread>
    </Panel>
  </>;
}

// ——— Four: what Kit understood, as chips ———

type Part = 'kinds' | 'platforms' | 'topic' | 'recent';
function Trail({ k }: { k: Kit }) {
  const P = usePalette();
  const [dropped, setDropped] = useState<Part[]>([]);
  useEffect(() => { setDropped([]); }, [k.turns.length]);
  const last = k.last;
  const context: Ask | null = last ? { kinds: dropped.includes('kinds') ? [] : last.context.kinds, platforms: dropped.includes('platforms') ? [] : last.context.platforms, topic: dropped.includes('topic') ? [] : last.context.topic, recent: !dropped.includes('recent') && last.context.recent } : null;
  const items = context ? (dropped.length ? savesFor(context, k.library.all.captures) : last!.items) : [];
  const parts: [Part, string][] = context ? ([
    context.kinds.length ? ['kinds', describe({ kinds: context.kinds, platforms: [] })] : null,
    context.platforms.length ? ['platforms', `from ${context.platforms.join(' or ')}`] : null,
    context.topic.length ? ['topic', `about ${context.topic.join(' ')}`] : null,
    context.recent ? ['recent', 'newest first'] : null,
  ].filter(Boolean) as [Part, string][]) : [];
  return <Panel k={k} title="Ask Kit">
    <Thread>
      {last && context ? <View style={styles.turn}>
        <Text style={[styles.trail, { color: P.muted }]} numberOfLines={2}>{k.questions.join('  ›  ')}</Text>
        <View style={styles.parts}>{parts.map(([part, label]) => <Pressable key={part} accessibilityRole="button" accessibilityLabel={`Take away: ${label}`} onPress={() => setDropped(list => [...list, part])}
          style={({ pressed }): StyleProp<ViewStyle> => [styles.part, { backgroundColor: P.accentSoft }, pressed && styles.pressed]}>
          <Text style={[styles.partText, { color: P.ink }]}>{label}</Text><Ionicons name="close" size={14} color={P.muted} />
        </Pressable>)}</View>
        <KitSays text={dropped.length ? `${items.length} ${describe(context)}.` : last.reply} compact />
        <Results items={items} />
      </View> : <Hello />}
    </Thread>
  </Panel>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  hidden: { opacity: 0 },
  barWrap: { position: 'absolute', left: 0, right: 0, zIndex: 4 },
  bar: { shadowColor: '#06203a', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 6 },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headOrb: { width: 24, height: 24 },
  title: { fontSize: 17, fontWeight: '700' },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  thread: { flexGrow: 1, justifyContent: 'flex-end', gap: 18, paddingTop: 8, paddingBottom: 10 },
  turn: { gap: 10 },
  turnTight: { gap: 8 },
  you: { alignSelf: 'flex-end', marginRight: 16, marginLeft: 60, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  youText: { fontSize: 15.5, lineHeight: 21 },
  kitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingRight: 28 },
  kitOrb: { width: 28, height: 28, marginTop: 1 },
  kitOrbSmall: { width: 20, height: 20 },
  kitText: { flex: 1, fontSize: 15.5, lineHeight: 22 },
  kitTextSmall: { flex: 1, fontSize: 14, lineHeight: 20 },
  strip: { gap: 10, paddingLeft: 54, paddingRight: 16 },
  stripCard: { width: 158 },
  grid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  folded: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth },
  foldedQuestion: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  foldedCount: { fontSize: 13 },
  half: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  contextPill: { position: 'absolute', left: 16, right: 16, zIndex: 5, height: 42, borderRadius: 21, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 14 },
  pillOrb: { width: 26, height: 26 },
  pillText: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  trail: { fontSize: 13.5, paddingHorizontal: 20 },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  part: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 17 },
  partText: { fontSize: 14, fontWeight: '600' },
  hello: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingBottom: 8 },
  helloOrb: { width: 64, height: 64, marginBottom: 4 },
  helloTitle: { fontSize: 21, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  helloLine: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  nextRow: { flexGrow: 0 },
  next: { gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  composer: { paddingHorizontal: 12, paddingTop: 6 },
  field: { minHeight: 52, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6 },
  fieldOrb: { width: 24, height: 24 },
  input: { flex: 1, minWidth: 0, fontSize: 16, minHeight: 44 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
