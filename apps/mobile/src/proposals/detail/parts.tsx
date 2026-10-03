// What the save-detail proposals are built from (2026-10-03), in the locked language — the
// platform's own mark, short lines in icons, sentence case, the scroll edge, actions by the thumb:
// the save and what's related to it (the app's own API; the sample world in Storybook), its
// picture (a page from its top, a photo whole, tap for full size), the line that says where it
// came from, its tags, its words, its file, a few facts about it, the saves related to it as the
// Library's cards, the actions (one primary — "Open on X", "Open the PDF" — Kit, and more), and
// Kit about this one save.
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Linking, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Capture, RelatedSave } from '../../api/types.ts';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { CapturePreview } from '../../components/CapturePreview.tsx';
import { GalleryCard } from '../../components/GalleryCard.tsx';
import { GlassSurface } from '../../components/ScenicSurface.tsx';
import { Shimmer, ShimmerText } from '../../components/Shimmer.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { capturePreviewSource } from '../../collection/preview.ts';
import { origin } from '../../collection/origin.ts';
import { headline, KIT_ORB, usePalette } from '../../kit/pieces.tsx';
import { aboutSave, SAVE_PROMPTS, type SaveAnswer } from '../../kit/aboutSave.ts';
import { useSession } from '../../session/SessionProvider.tsx';
import { savedAge, savedTimestamp, savedVia, sourcePlatform, type SavedVia } from '../../../../../packages/shared/src/collection-presentation.ts';
import FoundkeepShared from '../../../modules/foundkeep-shared/src';

export { headline, usePalette };
const VIA: Record<SavedVia, string> = { iphone: 'phone-portrait-outline', android: 'logo-android', browser: 'laptop-outline', dashboard: 'globe-outline' };
const VIA_WORDS: Record<SavedVia, string> = { iphone: 'From your iPhone', android: 'From your phone', browser: 'From your browser', dashboard: 'From the web' };

// ——— The save ———

/** The save, and the saves related to it; reloads when it's changed (edited, archived). */
export function useSave(id: string) {
  const { client } = useSession();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [related, setRelated] = useState<RelatedSave[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setError('');
    const load = (reload = false) => {
      void client.getCapture(id, { reload }).then(value => { if (live) setCapture(value.capture); }).catch(value => { if (live) setError((value as Error).message); });
      void client.relatedCaptures(id, { reload }).then(value => { if (live) setRelated(value.items.filter(item => item.capture.id !== id)); }).catch(() => { if (live) setRelated([]); });
    };
    load();
    const unsubscribe = client.subscribeInvalidation(() => load(true));
    return () => { live = false; unsubscribe(); };
  }, [client, id]);
  return { capture: capture?.id === id ? capture : null, related, error, setCapture };
}
export const written = (capture: Capture) => capture.type === 'note' || capture.type === 'selection';
export const pending = (capture: Capture) => capture.status === 'pending' || capture.status === 'processing';
/** Where it can be opened: the page it came from. */
export const sourceOf = (capture: Capture) => { const raw = capture.provenance?.pageUrl || capture.sourceUrl; try { const url = new URL(raw ?? ''); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
const shortUrl = (url: string) => { const parsed = new URL(url); return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`; };

/** The one thing a save is for: open it where it came from, open its file, see it whole, or edit
 * the note. */
export type Primary = { label: string; icon: string; run: 'source' | 'file' | 'view' | 'edit'; color?: string | null };
export function primaryOf(capture: Capture): Primary | null {
  const from = origin(capture);
  // A site by its name when it's short ("Open The Margin"); a bare address is just "the page".
  if (sourceOf(capture)) return from.icon.startsWith('logo-') ? { label: `Open on ${sourcePlatform(capture)}`, icon: from.icon, color: from.color, run: 'source' }
    : { label: from.icon === 'globe-outline' && !from.name.includes('.') && from.name.length <= 14 ? `Open ${from.name}` : 'Open the page', icon: 'open-outline', run: 'source' };
  if (capture.fileName && capture.type === 'audio') return { label: 'Open the memo', icon: 'mic-outline', run: 'file' };
  if (capture.fileName && (capture.type === 'document' || capture.type === 'file')) return { label: capture.fileMime?.includes('pdf') ? 'Open the PDF' : 'Open the file', icon: 'document-text-outline', run: 'file' };
  if (capture.type === 'image' || capture.type === 'screenshot') return { label: 'See it full size', icon: 'expand-outline', run: 'view' };
  if (capture.type === 'note') return { label: 'Edit the note', icon: 'create-outline', run: 'edit' };
  return null;
}

/** What a detail screen does: open, share, edit, archive, delete, see the picture whole, Kit. */
export function useActions(capture: Capture | null, setCapture: (capture: Capture) => void) {
  const { client } = useSession();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState('');
  const say = (words: string) => { setNote(words); setTimeout(() => setNote(current => (current === words ? '' : current)), 2600); };
  const openFile = async () => {
    if (!capture?.fileName) return;
    try {
      const local = await FoundkeepShared.downloadCaptureFile(capture.id, capture.fileName);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
      await Sharing.shareAsync(local, { dialogTitle: capture.fileName, mimeType: capture.fileMime || undefined });
    } catch (value) { say((value as Error).message || 'The file couldn’t be opened.'); }
  };
  const run = (primary: Primary | null) => {
    if (!capture || !primary) return;
    if (primary.run === 'source') { const url = sourceOf(capture); if (url) void Linking.openURL(url).catch(() => say('The page couldn’t be opened.')); }
    if (primary.run === 'file') void openFile();
    if (primary.run === 'view') setViewing(true);
    if (primary.run === 'edit') setEditing(true);
  };
  const share = () => { if (!capture) return; const url = sourceOf(capture); void Share.share(url ? { url, message: url } : { message: headline(capture) }).catch(() => {}); };
  const archive = async () => {
    if (!capture) return;
    setMenu(false);
    try { const result = await client.archiveCapture(capture.id, { archived: !capture.archivedAt, expectedUpdatedAt: capture.updatedAt }); setCapture(result.capture); say(result.capture.archivedAt ? 'Archived. It’s kept, out of the Library.' : 'Back in the Library.'); }
    catch (value) { say((value as Error).message); }
  };
  const remove = async () => {
    if (!capture) return;
    try { await client.deleteCapture(capture.id); router.replace('/(app)/(tabs)/collection'); } catch (value) { say((value as Error).message); }
  };
  return { editing, setEditing, viewing, setViewing, asking, setAsking, menu, setMenu, note, run, share, archive, remove, openFile };
}
export type Actions = ReturnType<typeof useActions>;

// ——— Pieces of the page ———

/** The picture, full width: a page shown from its top (never cropped at the sides), a photo whole,
 * a reel or a short tall — up to `most` of the width tall. Tap to see it full size. */
export function Picture({ capture, most = 1.25, rounded = 26, onView, style }: { capture: Capture; most?: number; rounded?: number; onView?: () => void; style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  const { token, account } = useSession();
  if (written(capture) || !capturePreviewSource(capture, token, account?.id)) return null;
  const page = capture.type === 'bookmark' || capture.type === 'document' || capture.type === 'file' || capture.provenance?.captureMethod === 'extension-full-page';
  const natural = capture.width && capture.height ? capture.width / capture.height : 1.5;
  const shown = Math.max(1 / (page ? Math.min(most, 1) : most), Math.min(2, natural));
  const whole = !page && natural < shown;
  return <Pressable accessibilityRole="button" accessibilityLabel="See the picture full size" onPress={onView} disabled={!onView}
    style={({ pressed }) => [{ borderRadius: rounded, overflow: 'hidden', backgroundColor: P.note, aspectRatio: shown }, page && { borderWidth: StyleSheet.hairlineWidth, borderColor: P.line }, pressed && styles.pressed, style]}>
    <CapturePreview capture={capture} contain={whole} style={page ? { width: '100%', aspectRatio: natural } : { width: '100%', height: '100%' }} />
    {capture.type === 'video' ? <View style={styles.play}><Ionicons name="play" size={22} color="#ffffff" /></View> : null}
  </Pressable>;
}

/** The picture full size, on black; tap anywhere to close. */
export function Viewer({ capture, open, onClose }: { capture: Capture; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const t = useFade(open);
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityViewIsModal={open} style={[StyleSheet.absoluteFill, styles.viewer, { opacity: t }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close the picture" onPress={onClose} style={StyleSheet.absoluteFill}>
      <CapturePreview capture={capture} contain style={[StyleSheet.absoluteFill, styles.viewerPicture]} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[styles.round, styles.viewerClose, { top: insets.top + 6 }]}><Ionicons name="close" size={24} color="#ffffff" /></Pressable>
  </Animated.View>;
}

/** Where it came from, how and when it was saved, and its folder — in icons. */
export function SourceLine({ capture, size = 13.5 }: { capture: Capture; size?: number }) {
  const P = usePalette();
  const from = origin(capture), via = savedVia(capture);
  return <View style={styles.source}>
    <Ionicons name={from.icon as 'logo-x'} size={size + 2} color={from.color === 'muted' ? P.muted : from.color ?? P.ink} />
    <Text style={[styles.sourceName, { color: P.ink, fontSize: size }]} numberOfLines={1}>{from.name}</Text>
    {via && VIA[via] !== from.icon ? <Ionicons name={VIA[via] as 'laptop-outline'} size={size} color={P.muted} /> : null}
    <Text style={[styles.sourceText, { color: P.muted, fontSize: size }]}>{savedAge(capture)}</Text>
    {capture.folder ? <View style={styles.folder}><Ionicons name="folder-outline" size={size} color={P.muted} /><Text style={[styles.sourceText, { color: P.muted, fontSize: size }]} numberOfLines={1}>{capture.folder.name}</Text></View> : null}
  </View>;
}

/** The title — a post's own words, a page's title — large. */
export function Title({ capture, size = 25 }: { capture: Capture; size?: number }) {
  const P = usePalette();
  return <Text selectable accessibilityRole="header" style={[styles.title, { color: P.ink, fontSize: size, lineHeight: Math.round(size * 1.22) }]}>{headline(capture)}</Text>;
}

/** Its tags, as small pills (tap to edit); a dashed "Tag" when it has none. */
export function Tags({ capture, onEdit }: { capture: Capture; onEdit: () => void }) {
  const P = usePalette();
  const tags = capture.userTags ?? [];
  if (!tags.length) return <Pressable accessibilityRole="button" accessibilityLabel="Add tags" onPress={onEdit} style={({ pressed }) => [styles.tag, styles.addTag, { borderColor: P.muted }, pressed && styles.pressed]}><Ionicons name="add" size={15} color={P.muted} /><Text style={[styles.tagText, { color: P.muted }]}>Tag</Text></Pressable>;
  return <View style={styles.tags}>{tags.map(tag => <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Tag ${tag}: edit tags`} onPress={onEdit} style={({ pressed }) => [styles.tag, { backgroundColor: P.accentSoft }, pressed && styles.pressed]}>
    <Text style={[styles.tagText, { color: P.accentPressed }]}>#{tag}</Text>
  </Pressable>)}</View>;
}

/** Still being read, couldn't be read, or archived: one quiet line. */
export function State({ capture }: { capture: Capture }) {
  const P = usePalette();
  const line = (icon: string, words: string, color = P.muted) => <View style={styles.state}><Ionicons name={icon as 'hourglass-outline'} size={16} color={color} /><Text style={[styles.stateText, { color: P.muted }]}>{words}</Text></View>;
  if (pending(capture)) return <View style={styles.state}><Ionicons name="hourglass-outline" size={16} color={P.pending} /><ShimmerText style={styles.stateText} color={P.muted} highlight={P.ink}>Saved. Getting the details…</ShimmerText></View>;
  if (capture.status === 'failed') return line('alert-circle-outline', 'Saved — the page couldn’t be read. The link still works.');
  if (capture.archivedAt) return line('archive-outline', 'Archived — kept, out of the Library.');
  return null;
}

/** The save's words: a summary set apart, a highlight as a quote, a note as itself, the saved
 * text (the first lines, the rest on request), and your own note on it. */
export function Words({ capture, reader = false }: { capture: Capture; reader?: boolean }) {
  const P = usePalette();
  const [all, setAll] = useState(false);
  const body = reader ? styles.readerText : styles.bodyText;
  const paragraphs = capture.articleText?.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean) ?? [];
  const opening = paragraphs.slice(0, reader ? 3 : 1);
  const rest = paragraphs.length > opening.length;
  const parts = [
    capture.type === 'note' && capture.noteText ? <Text key="note" selectable style={[body, { color: P.ink }]}>{capture.noteText}</Text> : null,
    capture.selectionText && capture.type === 'selection' ? <View key="quote" style={[styles.quote, { borderLeftColor: P.accent }]}><Text selectable style={[styles.quoteText, { color: P.ink }]}>{capture.selectionText}</Text></View> : null,
    capture.summary ? <View key="summary" style={[styles.summary, { backgroundColor: P.accentSoft }]}><Ionicons name="sparkles-outline" size={16} color={P.accentPressed} style={styles.summaryIcon} /><Text selectable style={[styles.summaryText, { color: P.ink }]}>{capture.summary}</Text></View> : null,
    paragraphs.length ? <View key="text" style={styles.text}>
      {(all ? paragraphs : opening).map((paragraph, index) => <Text key={index} selectable numberOfLines={all ? undefined : reader ? 12 : 6} style={[body, { color: P.ink }]}>{paragraph}</Text>)}
      {rest && !all ? <Pressable accessibilityRole="button" onPress={() => setAll(true)} hitSlop={8} style={styles.more}><Text style={[styles.moreText, { color: P.accentPressed }]}>Read it all</Text></Pressable> : null}
    </View> : null,
    capture.type !== 'note' && capture.noteText ? <View key="mine" style={[styles.mine, { borderColor: P.line }]}><Ionicons name="create-outline" size={16} color={P.muted} style={styles.summaryIcon} /><Text selectable style={[styles.summaryText, { color: P.ink }]}>{capture.noteText}</Text></View> : null,
  ].filter(Boolean);
  return parts.length ? <View style={styles.words}>{parts}</View> : null;
}

/** Whether a save has words or a file to show below its title. */
export const hasBody = (capture: Capture) => Boolean((capture.type === 'note' && capture.noteText) || (capture.type === 'selection' && capture.selectionText) || capture.summary || capture.articleText?.trim() || (capture.type !== 'note' && capture.noteText) || (capture.fileName && capture.type !== 'image' && capture.type !== 'screenshot'));

/** A file: its kind, name and size; tap to open or share it. */
export function FileRow({ capture, onOpen }: { capture: Capture; onOpen: () => void }) {
  const P = usePalette();
  if (!capture.fileName || capture.type === 'image' || capture.type === 'screenshot') return null;
  const size = capture.fileBytes >= 1048576 ? `${(capture.fileBytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(capture.fileBytes / 1024))} KB`;
  const kind = capture.type === 'audio' ? 'Voice memo' : capture.fileMime?.includes('pdf') ? 'PDF' : 'File';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${capture.fileName}`} onPress={onOpen} style={({ pressed }) => [styles.file, { backgroundColor: P.surface, borderColor: P.line }, pressed && styles.pressed]}>
    <View style={[styles.fileIcon, { backgroundColor: P.accentSoft }]}><Ionicons name={capture.type === 'audio' ? 'mic' : 'document-text'} size={20} color={P.accentPressed} /></View>
    <View style={styles.fileWords}><Text style={[styles.fileName, { color: P.ink }]} numberOfLines={1}>{capture.fileName}</Text><Text style={[styles.sourceText, { color: P.muted }]}>{kind} · {size}</Text></View>
    <Ionicons name="share-outline" size={20} color={P.accent} />
  </Pressable>;
}

/** A few facts — the page, who wrote it, when and how it was saved — instead of today's
 * "Original source" panel. */
export function Facts({ capture }: { capture: Capture }) {
  const P = usePalette();
  const url = sourceOf(capture), via = savedVia(capture);
  const when = new Date(savedTimestamp(capture)).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const rows = [
    url ? ['link-outline', shortUrl(url)] : null,
    capture.provenance?.authors?.length && capture.type !== 'tweet' ? ['person-outline', capture.provenance.authors.join(', ')] : null,
    ['time-outline', `Saved ${when}`],
    via ? [VIA[via], VIA_WORDS[via]] : null,
  ].filter(Boolean) as [string, string][];
  return <View style={styles.facts}>{rows.map(([icon, words]) => <View key={icon} style={styles.fact}>
    <Ionicons name={icon as 'link-outline'} size={16} color={P.muted} /><Text selectable numberOfLines={1} style={[styles.factText, { color: P.muted }]}>{words}</Text>
  </View>)}</View>;
}

/** Related saves as the Library's cards, in a row, taking the width as Ask Kit's do. */
export function Related({ items, onOpen, title = 'Related' }: { items: RelatedSave[]; onOpen: (capture: Capture) => void; title?: string }) {
  const P = usePalette();
  const { width } = useWindowDimensions();
  if (!items.length) return null;
  const room = width - 40, w = items.length === 1 ? room : items.length === 2 ? (room - 10) / 2 : ((room - 10) / 2) * 0.9;
  return <View style={styles.related}>
    {title ? <Text accessibilityRole="header" style={[styles.label, { color: P.ink }]}>{title}</Text> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
      {items.slice(0, 6).map(item => <View key={item.capture.id} style={{ width: w, gap: 6 }}>
        <GalleryCard capture={item.capture} onOpen={onOpen} />
        {item.reasons[0] ? <Text style={[styles.reason, { color: P.muted }]} numberOfLines={1}>{item.reasons[0].kind === 'batch' ? 'Saved together' : item.reasons[0].label}</Text> : null}
      </View>)}
    </ScrollView>
  </View>;
}

/** While the first save loads: the shape of the page, shimmering. */
export function Loading() {
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading the save" style={styles.loading}>
    <Shimmer style={{ aspectRatio: 1.4, borderRadius: 26 }} /><Shimmer style={{ height: 16, width: '45%', borderRadius: 5 }} />
    <Shimmer style={{ height: 28, width: '88%', borderRadius: 7 }} /><Shimmer style={{ height: 28, width: '62%', borderRadius: 7 }} />
  </View>;
}

// ——— Chrome ———

/** Round buttons: plain, or on glass (over a picture). */
export function Round({ icon, label, onPress, glass = false, orb = false }: { icon?: string; label: string; onPress: () => void; glass?: boolean; orb?: boolean }) {
  const P = usePalette();
  const inner = <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.round, pressed && { backgroundColor: P.accentSoft }]}>
    {orb ? <Image source={KIT_ORB} style={styles.orb} accessible={false} /> : <Ionicons name={icon as 'chevron-back'} size={22} color={P.ink} />}
  </Pressable>;
  return glass ? <GlassSurface interactive style={styles.roundGlass}>{inner}</GlassSurface> : inner;
}
/** The top bar: back on the left, a few round buttons on the right, on glass over the page. */
export function TopBar({ right, onBack, icon = 'chevron-back' }: { right?: ReactNode; onBack?: () => void; icon?: string }) {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="box-none" style={[styles.topBar, { top: insets.top + 4 }]}>
    <Round glass icon={icon} label={icon === 'chevron-down' ? 'Close' : 'Back'} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/collection')))} />
    <View pointerEvents="box-none" style={styles.topRight}>{right}</View>
  </View>;
}
export const TOP = 56;

/** By the thumb: the save's one primary action as a pill, Kit's orb, and more. */
export function ActionBar({ capture, actions }: { capture: Capture; actions: Actions }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const primary = primaryOf(capture);
  return <View pointerEvents="box-none" style={[styles.bar, { bottom: Math.max(insets.bottom, 12) }]}>
    {primary ? <GlassSurface interactive style={styles.pill}>
      <Pressable accessibilityRole="button" accessibilityLabel={primary.label} onPress={() => actions.run(primary)} style={({ pressed }) => [styles.pillInner, pressed && { backgroundColor: P.accentSoft }]}>
        <Ionicons name={primary.icon as 'open-outline'} size={19} color={primary.icon.startsWith('logo-') ? primary.color ?? P.ink : P.accent} />
        <Text style={[styles.pillText, { color: P.ink }]} numberOfLines={1}>{primary.label}</Text>
      </Pressable>
    </GlassSurface> : <View style={styles.flex} />}
    <GlassSurface interactive style={styles.barButton}><Pressable accessibilityRole="button" accessibilityLabel="Ask Kit about this save" onPress={() => actions.setAsking(true)} style={({ pressed }) => [styles.barInner, pressed && { backgroundColor: P.accentSoft }]}><Image source={KIT_ORB} style={styles.barOrb} accessible={false} /></Pressable></GlassSurface>
    <GlassSurface interactive style={styles.barButton}><Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => actions.setMenu(true)} style={({ pressed }) => [styles.barInner, pressed && { backgroundColor: P.accentSoft }]}><Ionicons name="ellipsis-horizontal" size={24} color={P.ink} /></Pressable></GlassSurface>
  </View>;
}
export const BAR = 60;

/** More: edit, share, saved together, archive, delete (a second tap to be sure) — on glass. */
export function MoreMenu({ capture, actions, from = 'bottom' }: { capture: Capture; actions: Actions; from?: 'bottom' | 'top' }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const [sure, setSure] = useState(false);
  const t = useFade(actions.menu);
  useEffect(() => { if (!actions.menu) setSure(false); }, [actions.menu]);
  const close = () => actions.setMenu(false);
  const item = (icon: string, label: string, onPress: () => void, danger = false) => <Pressable key={label} accessibilityRole="menuitem" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: P.accentSoft }]}>
    <Ionicons name={icon as 'create-outline'} size={20} color={danger ? P.error : P.ink} /><Text style={[styles.menuText, { color: danger ? P.error : P.ink }]}>{label}</Text>
  </Pressable>;
  const place = from === 'bottom' ? { bottom: Math.max(insets.bottom, 12) + BAR + 10 } : { top: insets.top + 4 + TOP };
  return <Animated.View pointerEvents={actions.menu ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.menuLayer, { opacity: t }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close the menu" onPress={close} style={StyleSheet.absoluteFill} />
    <GlassSurface accessibilityRole="menu" style={[styles.menu, place]}>
      {item('create-outline', 'Edit details', () => { close(); actions.setEditing(true); })}
      {item('share-outline', 'Share', () => { close(); actions.share(); })}
      {capture.batchId ? item('albums-outline', 'Saved with it', () => { close(); router.push({ pathname: '/(app)/batch/[id]', params: { id: capture.batchId! } }); }) : null}
      {item(capture.archivedAt ? 'arrow-undo-outline' : 'archive-outline', capture.archivedAt ? 'Back to the Library' : 'Archive', () => void actions.archive())}
      {item('trash-outline', sure ? 'Tap again to delete' : 'Delete', () => (sure ? void actions.remove() : setSure(true)), true)}
    </GlassSurface>
  </Animated.View>;
}

/** A short line that comes and goes (archived, couldn't open…). */
export function Note({ words, above = 0 }: { words: string; above?: number }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const t = useFade(Boolean(words));
  const [shown, setShown] = useState(words);
  useEffect(() => { if (words) setShown(words); }, [words]);
  return <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.note, { bottom: Math.max(insets.bottom, 12) + above + 12, opacity: t, backgroundColor: P.ink }]}>
    <Text style={[styles.noteText, { color: P.paper }]}>{shown}</Text>
  </Animated.View>;
}

// ——— Kit, about this save ———

type Turn = { question: string } & SaveAnswer;
/** Kit's turns about one save: ask with a ready prompt or your own words. */
export function useKitAbout(capture: Capture | null, related: RelatedSave[]) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const id = capture?.id;
  useEffect(() => { setTurns([]); setDraft(''); }, [id]);
  const ask = (question: string) => { if (!capture || !question.trim()) return; setTurns(current => [...current, { question: question.trim(), ...aboutSave(question, capture, related) }]); setDraft(''); };
  return { turns, draft, setDraft, ask };
}
export type KitAbout = ReturnType<typeof useKitAbout>;

/** Kit's answers: your question, small and right; Kit's one line, a touch larger; the saves it
 * means, in a row of cards. */
export function KitTurns({ kit, onOpen }: { kit: KitAbout; onOpen: (capture: Capture) => void }) {
  const P = usePalette();
  return <>{kit.turns.map((turn, index) => <View key={index} style={styles.turn}>
    <View style={[styles.asked, { backgroundColor: P.accentSoft }]}><Text style={[styles.askedText, { color: P.ink }]}>{turn.question}</Text></View>
    <View style={styles.reply}><Image source={KIT_ORB} style={styles.replyOrb} accessible={false} /><Text selectable style={[styles.replyText, { color: P.ink }]}>{turn.reply}</Text></View>
    {turn.items.length ? <Related items={turn.items.map(capture => ({ capture, reasons: [] }))} onOpen={onOpen} title="" /> : null}
  </View>)}</>;
}
/** The ready prompts, as chips. */
export function Prompts({ kit, style }: { kit: KitAbout; style?: StyleProp<ViewStyle> }) {
  const P = usePalette();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={style} contentContainerStyle={styles.prompts}>
    {SAVE_PROMPTS.map(prompt => <Pressable key={prompt} accessibilityRole="button" onPress={() => kit.ask(prompt)} style={({ pressed }) => [styles.prompt, { backgroundColor: P.surface, borderColor: P.line }, pressed && { backgroundColor: P.accentSoft }]}>
      <Text style={[styles.promptText, { color: P.ink }]}>{prompt}</Text>
    </Pressable>)}
  </ScrollView>;
}

/** A soft fade in and out (0 → 1 as `on`). */
export function useFade(on: boolean, duration = 220) {
  const motion = useMotionAllowed();
  const t = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.timing(t, { toValue: on ? 1 : 0, duration: motion ? duration : 0, useNativeDriver: false }).start(); }, [on, motion, t, duration]);
  return t;
}
/** Fades its children in when `id` changes — a new save arriving, without a jump. */
export function FadeIn({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const motion = useMotionAllowed();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => { t.setValue(motion ? 0 : 1); Animated.timing(t, { toValue: 1, duration: motion ? 260 : 0, useNativeDriver: false }).start(); }, [id, motion, t]);
  return <Animated.View style={[style, { opacity: t }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  play: { position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -27, width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(10,20,30,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  viewer: { backgroundColor: '#000000', zIndex: 20 },
  viewerPicture: { backgroundColor: 'transparent', aspectRatio: undefined },
  viewerClose: { position: 'absolute', right: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sourceName: { fontWeight: '600', flexShrink: 1 },
  sourceText: { fontSize: 13 },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  title: { fontWeight: '700', letterSpacing: -0.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 16 },
  addTag: { borderWidth: 1, borderStyle: 'dashed', alignSelf: 'flex-start', paddingLeft: 9 },
  tagText: { fontSize: 14, fontWeight: '600' },
  state: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateText: { fontSize: 14.5, flexShrink: 1 },
  words: { gap: 16 },
  bodyText: { fontSize: 16, lineHeight: 25 },
  readerText: { fontSize: 18, lineHeight: 29 },
  quote: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 2 },
  quoteText: { fontSize: 18, lineHeight: 28 },
  summary: { flexDirection: 'row', gap: 10, borderRadius: 18, padding: 14 },
  summaryIcon: { marginTop: 3 },
  summaryText: { flex: 1, fontSize: 15.5, lineHeight: 23 },
  text: { gap: 14 },
  more: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  moreText: { fontSize: 15, fontWeight: '600' },
  mine: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 18, padding: 14 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  fileIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fileWords: { flex: 1, gap: 3 },
  fileName: { fontSize: 15.5, fontWeight: '600' },
  facts: { gap: 10 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factText: { fontSize: 14, flexShrink: 1 },
  related: { gap: 10 },
  label: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, paddingHorizontal: 20 },
  relatedRow: { gap: 10, paddingHorizontal: 20 },
  reason: { fontSize: 13, paddingHorizontal: 4 },
  loading: { padding: 16, gap: 16 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  roundGlass: { borderRadius: 22 },
  orb: { width: 28, height: 28 },
  topBar: { position: 'absolute', left: 12, right: 12, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 4 },
  topRight: { flexDirection: 'row', gap: 8 },
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 5 },
  pill: { flex: 1, height: BAR, borderRadius: 30 },
  pillInner: { flex: 1, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  pillText: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  barButton: { width: BAR, height: BAR, borderRadius: 30 },
  barInner: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  barOrb: { width: 34, height: 34 },
  menuLayer: { zIndex: 8 },
  menu: { position: 'absolute', right: 16, minWidth: 220, borderRadius: 22, paddingVertical: 6 },
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 14, marginHorizontal: 4 },
  menuText: { fontSize: 16 },
  note: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, maxWidth: '86%', zIndex: 9 },
  noteText: { fontSize: 14.5, fontWeight: '500', textAlign: 'center' },
  turn: { gap: 10 },
  asked: { alignSelf: 'flex-end', marginHorizontal: 20, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '80%' },
  askedText: { fontSize: 15.5 },
  reply: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, alignItems: 'flex-start' },
  replyOrb: { width: 26, height: 26, marginTop: 1 },
  replyText: { flex: 1, fontSize: 17.5, lineHeight: 25 },
  prompts: { gap: 8, paddingHorizontal: 16 },
  prompt: { height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, justifyContent: 'center' },
  promptText: { fontSize: 14.5, fontWeight: '600' },
});
