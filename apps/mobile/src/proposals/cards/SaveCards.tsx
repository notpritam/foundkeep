// The Library's cards, one for each kind of save (proposal, 2026-10-02):
// Pritam asked to clear everything out and make them clean — how a link, a
// post, a reel, a photo, a screenshot, a highlight, a note, a PDF and a voice
// memo look, with where they came from, their tags and their folder. Three
// ways, sharing one order — the picture first, then the title with nothing
// above it, then one line:
//   quiet    the line says where it came from (the platform's mark and name) and when;
//            tags and folder stay on the save itself
//   pills    the same, with the folder and the first tags as small pills under the title
//   marked   the platform's mark sits on the picture's corner, like an app icon; the line
//            under the title is only when, and the folder
// What kind of save it is shows in the picture itself: a play mark on a
// video (tall for a reel or a short), a page for a PDF, a quote for a
// highlight, a tint for a note, a sound wave for a voice memo, a stack for
// things saved together; a save still being read shimmers; one that couldn't
// be read says so, quietly.
import { memo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Capture } from '../../api/types.ts';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { CapturePreview } from '../../components/CapturePreview.tsx';
import { Shimmer } from '../../components/Shimmer.tsx';
import { captureTitle } from '../../collection/model.ts';
import { previewRatio, savedAge } from '../../../../../packages/shared/src/collection-presentation.ts';
import { usePalette, type Palette } from '../library/parts.tsx';
import { origin } from '../../collection/origin.ts';

export type CardStyle = 'quiet' | 'pills' | 'marked';
type CardProps = { capture: Capture; onOpen: (capture: Capture) => void };

// ——— Where a save came from ———

/** Where a save came from — now the app's own (collection/origin.ts), shared with the Library's card. */
export { origin };

function Mark({ capture, P, size = 14 }: { capture: Capture; P: Palette; size?: number }) {
  const from = origin(capture);
  return <Ionicons name={from.icon as 'logo-x'} size={size} color={from.color === 'muted' ? P.muted : from.color ?? P.ink} />;
}

// ——— What kind of save it is ———

const vertical = (capture: Capture) => capture.type === 'video' && /\/reel\/|\/shorts\/|tiktok\.com/.test(capture.sourceUrl || '');
const written = (capture: Capture) => capture.type === 'note' || capture.type === 'selection';
const pending = (capture: Capture) => capture.status === 'pending' || capture.status === 'processing';
const pictured = (capture: Capture) => !written(capture) && Boolean(capture.previewUrl || capture.blobUrl || (capture.fileUrl && capture.fileMime?.startsWith('image/')));
/** A post is called by what it says; anything else by its title. */
const headline = (capture: Capture) => (capture.type === 'tweet' && capture.selectionText ? capture.selectionText : captureTitle(capture));

function Picture({ capture, P, badge }: { capture: Capture; P: Palette; badge: boolean }) {
  // A reel or a short is tall; a PDF a page; a full-page screenshot shows its top.
  const ratio = vertical(capture) ? 0.8 : capture.type === 'document' ? 0.78 : capture.provenance?.captureMethod === 'extension-full-page' ? 0.8 : previewRatio(capture.width, capture.height);
  return <View>
    {capture.batchId ? <View style={[styles.stackBehind, { backgroundColor: P.line }]} /> : null}
    <View style={[styles.picture, { backgroundColor: P.accentSoft }]}>
      <CapturePreview capture={capture} compact style={{ width: '100%', aspectRatio: ratio }} />
      {capture.type === 'video' ? <View style={styles.play}><Ionicons name="play" size={13} color="#ffffff" /></View> : null}
      {capture.type === 'document' ? <View style={styles.chip}><Text style={styles.chipText}>PDF</Text></View> : null}
      {capture.batchId ? <View style={styles.chip}><Ionicons name="layers" size={11} color="#ffffff" /><Text style={styles.chipText}>Saved together</Text></View> : null}
      {badge ? <View style={[styles.badge, { backgroundColor: P.surface }]}><Mark capture={capture} P={P} size={13} /></View> : null}
    </View>
  </View>;
}

// ——— The card ———

function line(capture: Capture, style: CardStyle) {
  if (pending(capture)) return 'Getting the details…';
  if (capture.status === 'failed') return 'Couldn’t read this page';
  if (style === 'marked') return [savedAge(capture), capture.folder?.name].filter(Boolean).join(' · ');
  return `${origin(capture).name} · ${savedAge(capture)}`;
}
function SaveCard({ capture, onOpen, style }: CardProps & { style: CardStyle }) {
  const P = usePalette();
  const words = written(capture), picture = pictured(capture), marked = style === 'marked';
  const tint = capture.type === 'note' ? P.note : P.surface;
  const tags = capture.userTags ?? [];
  return <Pressable accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={() => onOpen(capture)}
    style={({ pressed }): StyleProp<ViewStyle> => [styles.card, { backgroundColor: tint, shadowColor: P.shadow }, P.dark && { borderWidth: StyleSheet.hairlineWidth, borderColor: P.line }, pressed && styles.pressed]}>
    {picture ? <Picture capture={capture} P={P} badge={marked} /> : pending(capture) ? <View style={[styles.picture, { aspectRatio: 1.4 }]}><Shimmer style={StyleSheet.absoluteFill} /></View>
      : capture.type === 'audio' ? <View style={[styles.picture, styles.audio, { backgroundColor: P.accentSoft }]}>
        {[10, 18, 26, 14, 30, 20, 12, 24, 16, 8, 22, 12].map((h, i) => <View key={i} style={[styles.wave, { height: h, backgroundColor: P.accent }]} />)}
      </View> : null}
    <View style={[styles.words, !picture && styles.wordsOnly]}>
      {marked && !picture ? <View style={styles.markCorner}><Mark capture={capture} P={P} size={13} /></View> : null}
      {capture.type === 'selection' ? <View style={[styles.quote, { borderLeftColor: P.accent }]}><Text style={[styles.quoteText, { color: P.ink }]} numberOfLines={7}>{capture.selectionText}</Text></View>
        : capture.type === 'note' ? <Text style={[styles.noteText, { color: P.ink }]} numberOfLines={8}>{capture.noteText}</Text>
        : <Text style={[styles.title, { color: P.ink }, marked && !picture && styles.titleBeside]} numberOfLines={picture ? 3 : 5}>{headline(capture)}</Text>}
      {style === 'pills' && (capture.folder || tags.length) ? <View style={styles.pills}>
        {capture.folder ? <View style={[styles.pill, { borderColor: P.line }]}><Ionicons name="folder-outline" size={11} color={P.muted} /><Text style={[styles.pillText, { color: P.ink }]} numberOfLines={1}>{capture.folder.name}</Text></View> : null}
        {tags.slice(0, capture.folder ? 1 : 2).map(tag => <View key={tag} style={[styles.pill, { backgroundColor: P.accentSoft, borderColor: P.accentSoft }]}><Text style={[styles.pillText, { color: P.dark ? P.accent : P.accentPressed }]}>{tag}</Text></View>)}
        {tags.length > (capture.folder ? 1 : 2) ? <Text style={[styles.more, { color: P.muted }]}>+{tags.length - (capture.folder ? 1 : 2)}</Text> : null}
      </View> : null}
      <View style={styles.meta}>
        {marked || pending(capture) ? null : capture.status === 'failed' ? <Ionicons name="alert-circle-outline" size={13} color={P.muted} /> : <Mark capture={capture} P={P} />}
        <Text style={[styles.metaText, { color: P.muted }]} numberOfLines={1}>{line(capture, style)}</Text>
      </View>
    </View>
  </Pressable>;
}

export const QuietCard = memo((props: CardProps) => <SaveCard {...props} style="quiet" />);
export const PillsCard = memo((props: CardProps) => <SaveCard {...props} style="pills" />);
export const MarkedCard = memo((props: CardProps) => <SaveCard {...props} style="marked" />);
export const CARDS = { quiet: QuietCard, pills: PillsCard, marked: MarkedCard };

const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: 20, borderCurve: 'continuous', padding: 5, overflow: 'hidden', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  picture: { width: '100%', borderRadius: 15, borderCurve: 'continuous', overflow: 'hidden' },
  stackBehind: { position: 'absolute', left: 8, right: 8, top: -5, height: 20, borderRadius: 12 },
  play: { position: 'absolute', left: 8, bottom: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(10,20,30,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  chip: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: 'rgba(10,20,30,0.55)' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  badge: { position: 'absolute', left: 8, top: 8, width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  audio: { height: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  wave: { width: 3, borderRadius: 2, opacity: 0.8 },
  words: { paddingHorizontal: 8, paddingTop: 9, paddingBottom: 7, gap: 7 },
  wordsOnly: { paddingTop: 10 },
  markCorner: { position: 'absolute', right: 8, top: 10 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  titleBeside: { paddingRight: 22 },
  quote: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 2 },
  quoteText: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  noteText: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%' },
  pillText: { fontSize: 11.5, fontWeight: '600' },
  more: { fontSize: 11.5, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
});
