// A save, opened (proposals, 2026-10-03). Pritam: "we are ready to move to our detailed open view
// of our saves so we can clean and close that as well". Today's screen (In the app today/Save
// detail) crops a page's picture at the sides, puts every part in its own frosted panel under
// uppercase labels (SUMMARY, SAVED TEXT), hides where it came from in a collapsed "Original source"
// panel, and has four small icons in the header and no Kit. These keep the locked language — the
// platform's mark and short lines in icons, the scroll edge, actions by the thumb, Kit's orb — and
// try four shapes:
//   picture — the picture first, then the words; one action bar by the thumb: the save's primary
//             action ("Open on X", "Open the PDF"), Kit, and more.
//   reader  — the words first, set for reading; a smaller picture; the actions on top.
//   sheet   — rises over the Library from the card you tapped; the Library stays behind.
//   kit     — Kit always there: ready prompts and "Ask Kit about this save" by the thumb, the
//             answers on the page.
// Related saves open in place, with back returning through them.
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Capture, RelatedSave } from '../../api/types.ts';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { EditCaptureSheet } from '../../components/EditCaptureSheet.tsx';
import { ScrollEdge } from '../../components/ScrollEdge';
import { EDGE_FADE } from '../../components/useScrollEdges.ts';
import { useMotionAllowed } from '../../components/motion.tsx';
import { Field, KIT_ORB } from '../../kit/pieces.tsx';
import { SearchAndKit } from '../kit/Locked.tsx';
import {
  ActionBar, BAR, FadeIn, Facts, FileRow, hasBody, headline, KitTurns, Loading, MoreMenu, Note, Picture, primaryOf, Prompts, Related, Round, SourceLine, State, Tags, Title, TOP, TopBar,
  useActions, useKitAbout, usePalette, useSave, Viewer, Words, type Actions,
} from './parts.tsx';

export type DetailLook = 'picture' | 'reader' | 'sheet' | 'kit';
export function SaveDetail({ id, look = 'picture' }: { id: string; look?: DetailLook }) {
  return look === 'sheet' ? <OverTheLibrary id={id} /> : <Page id={id} look={look} />;
}

/** Saves opened from this one (related, Kit's answers), so back returns through them. */
function useTrail(start: string, leave: () => void) {
  const [trail, setTrail] = useState([start]);
  useEffect(() => { setTrail([start]); }, [start]);
  return {
    id: trail[trail.length - 1] ?? start,
    open: (capture: Capture) => setTrail(current => (current[current.length - 1] === capture.id ? current : [...current, capture.id])),
    back: () => (trail.length > 1 ? setTrail(current => current.slice(0, -1)) : leave()),
  };
}
const leaveToLibrary = () => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/collection'));
/** The last save loaded stays on screen while the next one loads, so nothing blinks. */
function useShown(capture: Capture | null) {
  const last = useRef<Capture | null>(null);
  if (capture) last.current = capture;
  return capture ?? last.current;
}

// ——— Picture first, Reader, With Kit: a screen of its own ———

function Page({ id: start, look }: { id: string; look: Exclude<DetailLook, 'sheet'> }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const trail = useTrail(start, leaveToLibrary);
  const save = useSave(trail.id);
  const capture = useShown(save.capture);
  const actions = useActions(capture, save.setCapture);
  const kit = useKitAbout(capture, save.related);
  const scroll = useRef<ScrollView>(null);
  const [composer, setComposer] = useState(140);
  useEffect(() => { if (kit.turns.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); }, [kit.turns.length]);
  const bar = insets.top + TOP;
  const bottom = look === 'kit' ? composer : look === 'picture' ? Math.max(insets.bottom, 12) + BAR + 24 : insets.bottom + 32;
  // Picture first keeps its actions by the thumb (share on top); the others keep them on top.
  const top = <>
    {look === 'reader' ? <Round glass orb label="Ask Kit about this save" onPress={() => actions.setAsking(true)} /> : null}
    <Round glass icon="share-outline" label="Share" onPress={actions.share} />
    {look !== 'picture' ? <Round glass icon="ellipsis-horizontal" label="More" onPress={() => actions.setMenu(true)} /> : null}
  </>;
  return <View style={[styles.fill, { backgroundColor: P.paper }]}>
    {capture ? <ScrollView ref={scroll} key={capture.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: bar + EDGE_FADE + 4, paddingBottom: bottom }}>
      <FadeIn id={capture.id}>
        {look === 'reader' ? <ReaderBody capture={capture} related={save.related} actions={actions} onOpen={trail.open} />
          : <Body capture={capture} related={save.related} actions={actions} onOpen={trail.open} inlinePrimary={look === 'kit'} />}
        {look === 'kit' ? <View style={styles.turns}><KitTurns kit={kit} onOpen={trail.open} /></View> : null}
      </FadeIn>
    </ScrollView> : <View style={{ paddingTop: bar + EDGE_FADE }}><Loading /></View>}
    <ScrollEdge edge="top" height={bar + EDGE_FADE} hold={bar / (bar + EDGE_FADE)} color={P.paper} />
    <ScrollEdge edge="bottom" height={look === 'reader' ? 34 : look === 'kit' ? composer + 14 : bottom - 4} hold={look === 'reader' ? 0.15 : look === 'kit' ? (composer - 16) / (composer + 14) : 0.55} color={P.paper} />
    <TopBar onBack={trail.back} right={top} />
    {capture && look === 'picture' ? <ActionBar capture={capture} actions={actions} /> : null}
    {capture && look === 'kit' ? <View style={styles.composer} onLayout={event => setComposer(Math.ceil(event.nativeEvent.layout.height) + 12)}>
      <Prompts kit={kit} style={styles.prompts} />
      <Field kit value={kit.draft} onChange={kit.setDraft} onSubmit={() => kit.ask(kit.draft)} placeholder="Ask Kit about this save" />
    </View> : null}
    {capture ? <Overlays capture={capture} related={save.related} actions={actions} onOpen={trail.open} menuFrom={look === 'picture' ? 'bottom' : 'top'} noteAbove={look === 'picture' ? BAR + 6 : look === 'kit' ? composer - insets.bottom : 0} /> : null}
  </View>;
}

/** Picture first: the picture, where it came from, the title, tags; the words; the file; a few
 * facts; related saves. */
function Body({ capture, related, actions, onOpen, inlinePrimary = false }: { capture: Capture; related: RelatedSave[]; actions: Actions; onOpen: (capture: Capture) => void; inlinePrimary?: boolean }) {
  return <View style={styles.body}>
    <Picture capture={capture} style={styles.picture} onView={() => actions.setViewing(true)} />
    <View style={styles.head}>
      <SourceLine capture={capture} />
      <Title capture={capture} size={capture.type === 'tweet' ? 22 : 25} />
      <State capture={capture} />
      <Tags capture={capture} onEdit={() => actions.setEditing(true)} />
      {inlinePrimary ? <InlinePrimary capture={capture} actions={actions} /> : null}
    </View>
    {hasBody(capture) ? <Section><Words capture={capture} /><FileRow capture={capture} onOpen={() => void actions.openFile()} /></Section> : null}
    <Section><Facts capture={capture} /></Section>
    <Related items={related} onOpen={onOpen} />
  </View>;
}

/** Reader: where it came from, a large title and who wrote it; a smaller picture; the words set
 * for reading; then tags, a link to the page, a few facts, related saves. */
function ReaderBody({ capture, related, actions, onOpen }: { capture: Capture; related: RelatedSave[]; actions: Actions; onOpen: (capture: Capture) => void }) {
  const P = usePalette();
  const minutes = capture.articleText ? Math.max(1, Math.round(capture.articleText.split(/\s+/).length / 220)) : 0;
  const by = [capture.type !== 'tweet' ? capture.provenance?.authors?.[0] : null, minutes ? `${minutes} min read` : null].filter(Boolean).join(' · ');
  return <View style={styles.body}>
    <View style={styles.head}>
      <SourceLine capture={capture} />
      <Title capture={capture} size={capture.type === 'tweet' ? 24 : 31} />
      {by ? <Text style={[styles.by, { color: P.muted }]}>{by}</Text> : null}
      <State capture={capture} />
    </View>
    <Picture capture={capture} most={0.9} rounded={20} style={styles.readerPicture} onView={() => actions.setViewing(true)} />
    {hasBody(capture) ? <Section><Words capture={capture} reader /><FileRow capture={capture} onOpen={() => void actions.openFile()} /></Section> : null}
    <Section>
      <Tags capture={capture} onEdit={() => actions.setEditing(true)} />
      <InlinePrimary capture={capture} actions={actions} quiet />
      <Facts capture={capture} />
    </Section>
    <Related items={related} onOpen={onOpen} />
  </View>;
}

/** The primary action on the page: a pill (With Kit) or a quiet link (Reader). */
function InlinePrimary({ capture, actions, quiet = false }: { capture: Capture; actions: Actions; quiet?: boolean }) {
  const P = usePalette();
  const primary = primaryOf(capture);
  if (!primary) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={primary.label} onPress={() => actions.run(primary)} style={({ pressed }) => [quiet ? styles.link : [styles.inline, { borderColor: P.line, backgroundColor: P.surface }], pressed && styles.pressed]}>
    <Ionicons name={primary.icon as 'open-outline'} size={17} color={primary.icon.startsWith('logo-') ? P.ink : P.accent} />
    <Text style={[styles.inlineText, { color: quiet ? P.accentPressed : P.ink }]}>{primary.label}</Text>
    {quiet ? <Ionicons name="arrow-forward" size={15} color={P.accentPressed} /> : null}
  </Pressable>;
}
function Section({ children }: { children: ReactNode }) { return <View style={styles.section}>{children}</View>; }

/** What opens over a save: More, Kit about it, the picture full size, a passing line, edit. */
function Overlays({ capture, related, actions, onOpen, menuFrom, noteAbove }: { capture: Capture; related: RelatedSave[]; actions: Actions; onOpen: (capture: Capture) => void; menuFrom: 'top' | 'bottom'; noteAbove: number }) {
  // Kit's sheet is made the first time it's asked for, then kept so it can close softly.
  const asked = useRef(false);
  if (actions.asking) asked.current = true;
  return <>
    <MoreMenu capture={capture} actions={actions} from={menuFrom} />
    {asked.current ? <KitSheet capture={capture} related={related} open={actions.asking} onClose={() => actions.setAsking(false)} onOpen={save => { actions.setAsking(false); onOpen(save); }} /> : null}
    <Viewer capture={capture} open={actions.viewing} onClose={() => actions.setViewing(false)} />
    <Note words={actions.note} above={noteAbove} />
    {actions.editing ? <EditCaptureSheet capture={capture} onClose={() => actions.setEditing(false)} /> : null}
  </>;
}

/** Kit about this save, from the orb: a sheet over the lower half — the save's title, the
 * ready prompts, the answers, and the field. */
function KitSheet({ capture, related, open, onClose, onOpen }: { capture: Capture; related: RelatedSave[]; open: boolean; onClose: () => void; onOpen: (capture: Capture) => void }) {
  const P = usePalette();
  const { height } = useWindowDimensions();
  const kit = useKitAbout(capture, related);
  const scroll = useRef<ScrollView>(null);
  const t = useRise(open);
  useEffect(() => { if (kit.turns.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); }, [kit.turns.length]);
  return <View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.layer]}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,14,20,0.32)', opacity: t }]}><Pressable accessibilityRole="button" accessibilityLabel="Close Kit" onPress={onClose} style={StyleSheet.absoluteFill} /></Animated.View>
    <Animated.View accessibilityViewIsModal={open} style={[styles.kitSheet, { height: Math.min(height * 0.62, 560), backgroundColor: P.paper, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height * 0.7, 0] }) }] }]}>
      <View style={[styles.grabber, { backgroundColor: P.line }]} />
      <View style={styles.kitHead}>
        <Image source={KIT_ORB} style={styles.kitOrb} accessible={false} />
        <View style={styles.kitWords}><Text accessibilityRole="header" style={[styles.kitTitle, { color: P.ink }]}>Ask Kit</Text><Text style={[styles.kitAbout, { color: P.muted }]} numberOfLines={1}>About “{headline(capture)}”</Text></View>
        <Round icon="close" label="Close" onPress={onClose} />
      </View>
      <ScrollView ref={scroll} style={styles.fill} contentContainerStyle={styles.kitThread} keyboardShouldPersistTaps="handled">
        {kit.turns.length ? <KitTurns kit={kit} onOpen={onOpen} /> : <Text style={[styles.kitHint, { color: P.muted }]}>Ask anything about this save — or start with one of these.</Text>}
      </ScrollView>
      <Prompts kit={kit} style={styles.prompts} />
      <Field kit value={kit.draft} onChange={kit.setDraft} onSubmit={() => kit.ask(kit.draft)} placeholder="Ask Kit about this save" />
    </Animated.View>
  </View>;
}

// ——— Sheet: over the Library ———

/** The Library (as locked) with the save rising over it in a sheet; tap any card behind to open
 * that one. */
function OverTheLibrary({ id }: { id: string }) {
  const [state, setState] = useState({ id, open: true });
  useEffect(() => { setState({ id, open: true }); }, [id]);
  return <SearchAndKit onOpen={capture => setState({ id: capture.id, open: true })}
    overlay={<SaveSheet id={state.id} open={state.open} onClose={() => setState(current => ({ ...current, open: false }))} />} />;
}
function SaveSheet({ id: start, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const trail = useTrail(start, onClose);
  const save = useSave(trail.id);
  const capture = useShown(save.capture);
  const actions = useActions(capture, save.setCapture);
  const t = useRise(open);
  const head = 60;
  const bottom = Math.max(insets.bottom, 12) + BAR + 24;
  return <View pointerEvents={open ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, styles.layer]}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,14,20,0.36)', opacity: t }]}><Pressable accessibilityRole="button" accessibilityLabel="Close the save" onPress={onClose} style={StyleSheet.absoluteFill} /></Animated.View>
    <Animated.View accessibilityViewIsModal={open} style={[styles.sheet, { top: insets.top + 10, backgroundColor: P.paper, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}>
      {capture ? <ScrollView key={capture.id} contentContainerStyle={{ paddingTop: head + 4, paddingBottom: bottom }}>
        <FadeIn id={capture.id}><Body capture={capture} related={save.related} actions={actions} onOpen={trail.open} /></FadeIn>
      </ScrollView> : <View style={{ paddingTop: head }}><Loading /></View>}
      <ScrollEdge edge="top" height={head + EDGE_FADE} hold={head / (head + EDGE_FADE)} color={P.paper} />
      <ScrollEdge edge="bottom" height={bottom - 4} hold={0.55} color={P.paper} />
      <View style={[styles.grabber, styles.grabberOver, { backgroundColor: P.line }]} />
      <View pointerEvents="box-none" style={styles.sheetHead}>
        <Round glass icon={trail.id === start ? 'chevron-down' : 'chevron-back'} label={trail.id === start ? 'Close' : 'Back'} onPress={trail.back} />
        {capture ? <Round glass icon="share-outline" label="Share" onPress={actions.share} /> : null}
      </View>
      {capture ? <ActionBar capture={capture} actions={actions} /> : null}
      {capture ? <Overlays capture={capture} related={save.related} actions={actions} onOpen={trail.open} menuFrom="bottom" noteAbove={BAR + 6} /> : null}
    </Animated.View>
  </View>;
}

/** Rises (0 → 1, from the first moment it's shown) with the settle the app's sheets use; at once
 * when motion is off. */
function useRise(open: boolean) {
  const motion = useMotionAllowed();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { t.setValue(open ? 1 : 0); return; }
    const spring = Animated.spring(t, { toValue: open ? 1 : 0, useNativeDriver: false, damping: 28, stiffness: 260, mass: 1, overshootClamping: true });
    spring.start(); return () => spring.stop();
  }, [open, motion, t]);
  return t;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.8 },
  body: { gap: 22 },
  picture: { marginHorizontal: 12 },
  readerPicture: { marginHorizontal: 20 },
  head: { paddingHorizontal: 20, gap: 12 },
  by: { fontSize: 15 },
  section: { paddingHorizontal: 20, gap: 16 },
  inline: { alignSelf: 'flex-start', height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 2 },
  link: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7 },
  inlineText: { fontSize: 15.5, fontWeight: '600' },
  turns: { gap: 18, paddingTop: 26 },
  composer: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 4, zIndex: 5 },
  prompts: { flexGrow: 0, paddingVertical: 4 },
  layer: { zIndex: 7 },
  kitSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } },
  grabber: { width: 38, height: 5, borderRadius: 3, alignSelf: 'center' },
  grabberOver: { position: 'absolute', top: 8, zIndex: 4 },
  kitHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 8, paddingTop: 6 },
  kitOrb: { width: 34, height: 34 },
  kitWords: { flex: 1, gap: 1 },
  kitTitle: { fontSize: 18, fontWeight: '700' },
  kitAbout: { fontSize: 13.5 },
  kitThread: { paddingVertical: 14, gap: 18, flexGrow: 1, justifyContent: 'flex-end' },
  kitHint: { fontSize: 15.5, paddingHorizontal: 20 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: -6 } },
  sheetHead: { position: 'absolute', top: 14, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', zIndex: 4 },
});
