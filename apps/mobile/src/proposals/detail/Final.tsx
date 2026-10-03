// A save, opened — locked 2026-10-03 (Pritam: "the With Kit version is good — clean the UI, merge
// elements, a clean experience when I open the save; let's lock it"). With Kit, cleaned:
//   - where it came from and opening it are one line: the platform's mark, who, when, ↗
//     (it was a source line and a separate "Open on X" pill);
//   - the post's words lead a post (from the copy kept on the server when the save has none);
//   - the person's note sits under them as theirs, never as the title;
//   - a summary leads only when it says something new, as a quiet line (no card);
//   - tags, the date, how it was saved and the folder are one quiet block at the bottom (they
//     were tags, a facts list and a folder in the top line);
//   - Kit stays by the thumb: ready prompts and "Ask Kit about this save", answers on the page.
// Read through detail/reading (tested), shaped by an audit of real saves. The four shapes it was
// picked from: Tried/Save detail (proposals/detail/Detail.tsx).
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Capture, Preservation } from '../../api/types.ts';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { EditCaptureSheet } from '../../components/EditCaptureSheet.tsx';
import { ScrollEdge } from '../../components/ScrollEdge';
import { EDGE_FADE } from '../../components/useScrollEdges.ts';
import { origin } from '../../collection/origin.ts';
import { preservedAssetSource } from '../../collection/preview.ts';
import { readSave, type Reading } from '../../detail/reading.ts';
import { Field } from '../../kit/pieces.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { savedAge, savedTimestamp, savedVia, type SavedVia } from '../../../../../packages/shared/src/collection-presentation.ts';
import { FadeIn, FileRow, KitTurns, Loading, MoreMenu, Note, Picture, Prompts, Related, Round, State, TOP, TopBar, useActions, useKitAbout, usePalette, useSave, Viewer } from './parts.tsx';

const VIA: Record<SavedVia, [string, string]> = { iphone: ['phone-portrait-outline', 'your iPhone'], android: ['logo-android', 'your phone'], browser: ['laptop-outline', 'your browser'], dashboard: ['globe-outline', 'the web'] };

export function SaveDetailFinal({ id: start }: { id: string }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const [trail, setTrail] = useState([start]);
  useEffect(() => { setTrail([start]); }, [start]);
  const id = trail[trail.length - 1] ?? start;
  const open = (capture: Capture) => setTrail(current => (current[current.length - 1] === capture.id ? current : [...current, capture.id]));
  const back = () => (trail.length > 1 ? setTrail(current => current.slice(0, -1)) : router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/collection'));
  const save = useSave(id);
  const shown = useRef<{ capture: Capture; preservation: Preservation | null } | null>(null);
  if (save.capture) shown.current = { capture: save.capture, preservation: save.preservation };
  const capture = shown.current?.capture ?? null;
  const reading = capture ? readSave(capture, shown.current?.preservation) : null;
  const asRead = capture && reading ? readAs(capture, reading) : null;
  const actions = useActions(capture, save.setCapture);
  const kit = useKitAbout(asRead, save.related);
  const scroll = useRef<ScrollView>(null);
  const [composer, setComposer] = useState(140);
  useEffect(() => { if (kit.turns.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); }, [kit.turns.length]);
  const bar = insets.top + TOP;
  return <View style={[styles.fill, { backgroundColor: P.paper }]}>
    {capture && reading && asRead ? <ScrollView ref={scroll} key={capture.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: bar + EDGE_FADE + 4, paddingBottom: composer }}>
      <FadeIn id={capture.id}>
        <View style={styles.page}>
          {reading.post || reading.sharedAsText ? <ArchivedPicture capture={capture} preservation={shown.current?.preservation ?? null} /> : null}
          {!reading.sharedAsText ? <Picture capture={playable(asRead) ? { ...capture, type: 'video' } : capture} style={styles.picture} onView={() => actions.setViewing(true)} /> : null}
          <View style={styles.head}>
            <Source capture={asRead} link={reading.link} />
            {reading.title ? <Text selectable accessibilityRole="header" style={[styles.title, { color: P.ink }]}>{reading.title}</Text> : null}
            {reading.post ? <Paragraphs text={reading.post.text} style={styles.post} limit={4} /> : null}
            <State capture={capture} />
            {reading.missingPost ? <Quiet icon="cloud-offline-outline" words={`The post’s words weren’t kept — open it on ${origin(asRead).icon === 'logo-x' ? 'X' : 'Instagram'} to read it.`} /> : null}
          </View>
          {reading.note ? <View style={[styles.note, { backgroundColor: P.accentSoft }]}>
            <Ionicons name="create-outline" size={17} color={P.accentPressed} style={styles.noteIcon} accessibilityLabel="Your note" />
            <Text selectable style={[styles.noteText, { color: P.ink }]}>{reading.note}</Text>
          </View> : null}
          {reading.lead ? <View style={styles.lead}><Ionicons name="sparkles-outline" size={15} color={P.muted} style={styles.leadIcon} accessibilityLabel="Summary" /><Text selectable style={[styles.leadText, { color: P.muted }]}>{reading.lead}</Text></View> : null}
          <Body capture={capture} reading={reading} onFile={() => void actions.openFile()} />
          <About capture={capture} onEdit={() => actions.setEditing(true)} />
          <Related items={save.related} onOpen={open} />
          {kit.turns.length ? <View style={styles.turns}><KitTurns kit={kit} onOpen={open} /></View> : null}
        </View>
      </FadeIn>
    </ScrollView> : <View style={{ paddingTop: bar + EDGE_FADE }}><Loading /></View>}
    <ScrollEdge edge="top" height={bar + EDGE_FADE} hold={bar / (bar + EDGE_FADE)} color={P.paper} />
    <ScrollEdge edge="bottom" height={composer + 14} hold={(composer - 16) / (composer + 14)} color={P.paper} />
    <TopBar onBack={back} right={capture ? <><Round glass icon="share-outline" label="Share" onPress={actions.share} /><Round glass icon="ellipsis-horizontal" label="More" onPress={() => actions.setMenu(true)} /></> : null} />
    {capture ? <View style={styles.composer} onLayout={event => setComposer(Math.ceil(event.nativeEvent.layout.height) + 12)}>
      <Prompts kit={kit} style={styles.prompts} />
      <Field kit value={kit.draft} onChange={kit.setDraft} onSubmit={() => kit.ask(kit.draft)} placeholder="Ask Kit about this save" />
    </View> : null}
    {capture ? <>
      <MoreMenu capture={capture} actions={actions} from="top" />
      <Viewer capture={capture} open={actions.viewing} onClose={() => actions.setViewing(false)} />
      <Note words={actions.note} above={composer - insets.bottom} />
      {actions.editing ? <EditCaptureSheet capture={capture} onClose={() => actions.setEditing(false)} /> : null}
    </> : null}
  </View>;
}

/** A link to a video (YouTube, TikTok) shows its picture as a video does, with the play mark. */
const playable = (capture: Capture) => capture.type === 'video' || ['logo-youtube', 'logo-tiktok'].includes(origin(capture).icon);
/** The save as Kit and the source line should see it: a post with its words, a shared link as a link. */
function readAs(capture: Capture, reading: Reading): Capture {
  return {
    ...capture,
    type: reading.post ? 'tweet' : reading.sharedAsText ? 'bookmark' : capture.type,
    sourceUrl: reading.link,
    selectionText: reading.post?.text ?? (reading.sharedAsText ? null : capture.selectionText),
    summary: reading.lead,
    provenance: { ...(capture.provenance ?? {}), authors: reading.post?.author ? [reading.post.author] : capture.provenance?.authors ?? [] },
  };
}

/** Where it came from and opening it, as one line: the mark, who, when, and ↗ when it opens. */
function Source({ capture, link }: { capture: Capture; link: string | null }) {
  const P = usePalette();
  // A platform's mark with who posted it — the channel, the Reddit user, the post's author.
  const mark = origin(capture);
  const from = mark.icon.startsWith('logo-') && capture.provenance?.authors?.[0] ? { ...mark, name: capture.provenance.authors[0] } : mark;
  const words = <>
    <Ionicons name={from.icon as 'logo-x'} size={16} color={from.color === 'muted' ? P.muted : from.color ?? P.ink} />
    <Text style={[styles.sourceName, { color: P.ink }]} numberOfLines={1}>{from.name}</Text>
    <Text style={[styles.sourceAge, { color: P.muted }]}>{savedAge(capture)}</Text>
    {link ? <Ionicons name="open-outline" size={14} color={P.accentPressed} /> : null}
  </>;
  if (!link) return <View style={styles.source}>{words}</View>;
  return <Pressable accessibilityRole="link" accessibilityLabel={`Open the original: ${from.name}`} onPress={() => void Linking.openURL(link).catch(() => {})} hitSlop={6}
    style={({ pressed }) => [styles.source, pressed && styles.pressed]}>{words}</Pressable>;
}

/** Text in paragraphs; long text shows its first few and "Read it all". */
function Paragraphs({ text, style, limit }: { text: string; style: object; limit: number }) {
  const P = usePalette();
  const [all, setAll] = useState(false);
  const parts = text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  const shown = all ? parts : parts.slice(0, limit);
  return <View style={styles.paragraphs}>
    {shown.map((part, index) => <Text key={index} selectable style={[style, { color: P.ink }]}>{part}</Text>)}
    {parts.length > shown.length ? <Pressable accessibilityRole="button" onPress={() => setAll(true)} hitSlop={8} style={styles.more}><Text style={[styles.moreText, { color: P.accentPressed }]}>Read it all</Text></Pressable> : null}
  </View>;
}

/** The save's own words below the note: a highlight as a quote, a note's text, a page's text, a file. */
function Body({ capture, reading, onFile }: { capture: Capture; reading: Reading; onFile: () => void }) {
  const P = usePalette();
  const quote = capture.type === 'selection' && !reading.sharedAsText ? capture.selectionText?.trim() : null;
  const words = capture.type === 'note' ? capture.noteText?.trim() : !reading.post ? capture.articleText?.trim() : null;
  const file = capture.fileName && capture.type !== 'image' && capture.type !== 'screenshot';
  if (!quote && !words && !file) return null;
  return <View style={styles.body}>
    {quote ? <View style={[styles.quote, { borderLeftColor: P.accent }]}><Text selectable style={[styles.quoteText, { color: P.ink }]}>{quote}</Text></View> : null}
    {words ? <Paragraphs text={words} style={capture.type === 'note' ? styles.noteBody : styles.bodyText} limit={capture.type === 'note' ? 20 : 1} /> : null}
    {file ? <FileRow capture={capture} onOpen={onFile} /> : null}
  </View>;
}

/** Quietly at the bottom: tags, when and how it was saved, its folder. */
function About({ capture, onEdit }: { capture: Capture; onEdit: () => void }) {
  const P = usePalette();
  const via = savedVia(capture);
  const when = new Date(savedTimestamp(capture)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const tags = capture.userTags ?? [];
  return <View style={[styles.about, { borderTopColor: P.line }]}>
    <View style={styles.tags}>
      {tags.map(tag => <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Tag ${tag}: edit tags`} onPress={onEdit} style={({ pressed }) => [styles.tag, { backgroundColor: P.accentSoft }, pressed && styles.pressed]}>
        <Text style={[styles.tagText, { color: P.accentPressed }]}>#{tag}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel={tags.length ? 'Edit tags and folder' : 'Add tags or a folder'} onPress={onEdit} style={({ pressed }) => [styles.tag, styles.addTag, { borderColor: P.muted }, pressed && styles.pressed]}>
        <Ionicons name={tags.length ? 'create-outline' : 'add'} size={14} color={P.muted} />{tags.length ? null : <Text style={[styles.tagText, { color: P.muted }]}>Tag</Text>}
      </Pressable>
    </View>
    <View style={styles.saved}>
      <Ionicons name="time-outline" size={15} color={P.muted} /><Text style={[styles.savedText, { color: P.muted }]}>{when}</Text>
      {via ? <><Ionicons name={VIA[via][0] as 'laptop-outline'} size={15} color={P.muted} /><Text style={[styles.savedText, { color: P.muted }]}>{VIA[via][1]}</Text></> : null}
      {capture.folder ? <><Ionicons name="folder-outline" size={15} color={P.muted} /><Text style={[styles.savedText, { color: P.muted }]} numberOfLines={1}>{capture.folder.name}</Text></> : null}
    </View>
  </View>;
}

/** The first photo the server kept of a post, when the save has no picture of its own. */
function ArchivedPicture({ capture, preservation }: { capture: Capture; preservation: Preservation | null }) {
  const P = usePalette();
  const { token, account } = useSession();
  const photo = preservation?.assets.find(asset => asset.kind === 'image');
  if (capture.previewUrl || capture.blobUrl || !photo) return null;
  const source = preservedAssetSource(capture.id, photo.id, token, account?.id, capture.updatedAt);
  return source ? <View style={[styles.picture, styles.archived, { backgroundColor: P.note }]}><Image source={source} style={styles.archivedImage} resizeMode="cover" accessible={false} /></View> : null;
}

function Quiet({ icon, words }: { icon: string; words: string }) {
  const P = usePalette();
  return <View style={styles.quiet}><Ionicons name={icon as 'cloud-offline-outline'} size={16} color={P.muted} /><Text style={[styles.quietText, { color: P.muted }]}>{words}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.75 },
  page: { gap: 20 },
  picture: { marginHorizontal: 12 },
  archived: { borderRadius: 26, overflow: 'hidden', aspectRatio: 1.25 },
  archivedImage: { width: '100%', height: '100%' },
  head: { paddingHorizontal: 20, gap: 12 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', minHeight: 28, maxWidth: '100%' },
  sourceName: { fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
  sourceAge: { fontSize: 14 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '700', letterSpacing: -0.5 },
  post: { fontSize: 19, lineHeight: 28, letterSpacing: -0.2 },
  paragraphs: { gap: 12 },
  more: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  moreText: { fontSize: 15, fontWeight: '600' },
  note: { marginHorizontal: 16, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 10 },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1, fontSize: 16.5, lineHeight: 24 },
  lead: { paddingHorizontal: 20, flexDirection: 'row', gap: 9 },
  leadIcon: { marginTop: 4 },
  leadText: { flex: 1, fontSize: 16, lineHeight: 24 },
  body: { paddingHorizontal: 20, gap: 16 },
  quote: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 2 },
  quoteText: { fontSize: 18.5, lineHeight: 28 },
  bodyText: { fontSize: 16.5, lineHeight: 26 },
  noteBody: { fontSize: 18, lineHeight: 28 },
  about: { marginHorizontal: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, borderRadius: 15 },
  addTag: { borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 9 },
  tagText: { fontSize: 13.5, fontWeight: '600' },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  savedText: { fontSize: 13.5, marginRight: 6 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quietText: { fontSize: 14.5, flexShrink: 1 },
  turns: { gap: 18, paddingTop: 6 },
  composer: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 4, zIndex: 5 },
  prompts: { flexGrow: 0, paddingVertical: 4 },
});
