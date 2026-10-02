// Kept for the design log (2026-10-02/03): glass on the whole card — the picture blurred
// behind everything, colour fields under saves without one. Pritam: too many colours; the
// glass belongs only on the caption, white. The app's card is components/GalleryCard.tsx.
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { memo, useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { Capture } from '../../api/types.ts';
import { captureTitle } from '../../collection/model.ts';
import { origin } from '../../collection/origin.ts';
import { capturePreviewSource } from '../../collection/preview.ts';
import { CapturePreview, captureLabels } from '../../components/CapturePreview.tsx';
import { Shimmer, ShimmerText } from '../../components/Shimmer.tsx';
import { colors, palettes } from '../../theme.ts';
import { useThemedStyles } from '../../appearance/AppearanceProvider.tsx';
import { previewRatio, savedAge, savedVia, savedViaLabels, type SavedVia } from '../../../../../packages/shared/src/collection-presentation.ts';
import { useMaterial } from '../../components/ScenicSurface.tsx';
import { useSession } from '../../session/SessionProvider.tsx';

// A save in the Library (Pritam, 2026-10-02: "Today, concise", with glass). Today's shape —
// the caption over the bottom of the picture — said in icons instead of words: above the
// title, the platform's own mark and the source; under it, how it was saved (a phone, a
// laptop…) with when, and the folder. No tags (they stay on the save). Glass: the picture,
// blurred and tinted, fills the card behind everything, and the caption is a frosted window
// onto it — a copy of that blurred layer lined up exactly, so no live blur per card. A save
// with no picture gets a colour field instead (Pritam: make the rest colourful too) — soft
// pastel gradients from the brand's sky colours: a note butter and peach, a highlight lilac
// and ice, a voice memo mint, anything else its own steady colour — under the same glass.
// Reduce Transparency gives solid surfaces. The card it replaced: proposals/cards/BeforeCard.
const VIA: Record<SavedVia, string> = { iphone: 'phone-portrait-outline', android: 'logo-android', browser: 'laptop-outline', dashboard: 'globe-outline' };
const alpha = (hex: string, amount: number) => `${hex}${Math.round(amount * 255).toString(16).padStart(2, '0')}`;
const AURAS: Record<string, [string, string]> = {
  butter: ['#FFE6A0', '#FFC2A8'], lilac: ['#D9CCFF', '#B8D6FF'], ice: ['#C6E6FF', '#A5D8F2'],
  mint: ['#BDEFD8', '#A4E1EA'], peach: ['#FFD2C2', '#FFB8CF'], sky: ['#BFE0FF', '#D7CCFF'],
};
/** A save's colour field: by kind where it has one, otherwise picked steadily from its id. */
function auraOf(capture: Capture): [string, string] {
  if (capture.type === 'note') return AURAS.butter;
  if (capture.type === 'selection') return AURAS.lilac;
  if (capture.type === 'audio') return AURAS.mint;
  const keys = ['ice', 'mint', 'peach', 'sky', 'lilac'];
  const hash = [...capture.id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return AURAS[keys[hash % keys.length]];
}
const gradient = ([from, to]: [string, string]) => (Platform.OS === 'web' ? { backgroundImage: `linear-gradient(140deg, ${from}, ${to})` } : { experimental_backgroundImage: `linear-gradient(140deg, ${from}, ${to})`, backgroundColor: from }) as ViewStyle;
const GLYPH: Partial<Record<Capture['type'], string>> = { bookmark: 'link', audio: 'mic', document: 'document-text', file: 'document', video: 'play', image: 'image', screenshot: 'scan', tweet: 'chatbubble' };

export const GlassEverywhereCard = memo(function GlassEverywhereCard({ capture, onOpen }: { capture: Capture; onOpen: (capture: Capture) => void }) {
  const { opaque, scheme } = useMaterial();
  const styles = useThemedStyles(baseStyles);
  const palette = palettes[scheme];
  const { token, account } = useSession();
  const written = capture.type === 'note' || capture.type === 'selection';
  const excerpt = capture.noteText || capture.selectionText || capture.summary || capture.articleText;
  const title = capture.type === 'tweet' && capture.selectionText ? capture.selectionText : captureTitle(capture);
  const from = origin(capture);
  const via = savedVia(capture);
  const pending = capture.status === 'pending' || capture.status === 'processing';
  const failed = capture.status === 'failed';
  const source = useMemo(() => (written ? null : capturePreviewSource(capture, token, account?.id)), [written, capture, token, account?.id]);
  // Glass on every card: the blurred picture where there is one, its colour field where there isn't.
  const glass = !opaque;
  const aura = auraOf(capture);
  const [card, setCard] = useState({ width: 0, height: 0 });
  const [caption, setCaption] = useState({ x: 0, y: 0 });
  // The blurred picture with a wash of the surface over it; `strength` is how much wash.
  const frosted = (strength: number) => <>
    {source ? <Image source={source} blurRadius={26} resizeMode="cover" accessible={false} style={[StyleSheet.absoluteFill, styles.blurred]} /> : <View style={[StyleSheet.absoluteFill, gradient(aura)]} />}
    <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(palette.surface, strength) }]} />
  </>;
  // Everything the icons say, for screen readers.
  const said = [title, `From ${from.name}`, via ? `Saved ${savedViaLabels[via]}` : null, savedAge(capture), capture.folder ? `In ${capture.folder.name}` : null, capture.batchId ? 'Saved together' : null, pending ? 'Details are being prepared' : failed ? 'The page couldn’t be read' : null].filter(Boolean).join('. ');
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${captureLabels[capture.type]}: ${said}`} onPress={() => onOpen(capture)}
    onLayout={event => { const { width, height } = event.nativeEvent.layout; setCard(previous => previous.width === width && previous.height === height ? previous : { width, height }); }}
    style={({ pressed }) => [styles.card, { backgroundColor: opaque ? palette.surface : palette.glassCard }, written && opaque && styles.written, pressed && styles.pressed]}>
    {glass ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>{frosted(source ? (scheme === 'dark' ? 0.66 : 0.6) : (scheme === 'dark' ? 0.62 : 0.3))}</View> : null}
    {/* Being prepared, with nothing to show yet: the picture's place shimmers. */}
    {written ? null : pending && !source ? <Shimmer style={[styles.preview, { aspectRatio: 1.4 }, glass && styles.clear]} />
      : !source && glass ? <View style={[styles.preview, styles.tile]}><Ionicons name={(failed ? 'alert-circle-outline' : GLYPH[capture.type] ?? 'bookmark') as 'link'} size={34} color={scheme === 'dark' ? palette.ink : '#ffffff'} /></View>
      : <CapturePreview capture={capture} style={[styles.preview, { aspectRatio: previewRatio(capture.width, capture.height) }]} />}
    <View onLayout={event => { const { x, y } = event.nativeEvent.layout; setCaption(previous => previous.x === x && previous.y === y ? previous : { x, y }); }}
      style={[styles.copy, !written && styles.caption, written && glass && styles.panel, { backgroundColor: glass ? 'transparent' : written ? palette.note : opaque ? palette.surface : palette.glassCard }, opaque && { borderColor: palette.line }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {glass && card.width ? <View pointerEvents="none" style={{ position: 'absolute', left: -caption.x - 1, top: -caption.y - 1, width: card.width, height: card.height }}>{frosted(scheme === 'dark' ? 0.8 : 0.76)}</View> : null}
      {written ? null : <View style={styles.source}><Ionicons name={from.icon as 'logo-x'} size={13} color={from.color === 'muted' ? palette.muted : from.color ?? palette.ink} /><Text style={styles.small} numberOfLines={1}>{from.name}</Text></View>}
      <Text style={styles.title} numberOfLines={4}>{title}</Text>
      {written && excerpt && excerpt !== title ? <Text style={styles.excerpt} numberOfLines={6}>{excerpt}</Text> : null}
      <View style={styles.icons}>
        {written ? <Ionicons name={from.icon as 'create-outline'} size={13} color={palette.muted} /> : null}
        {via ? <Ionicons name={VIA[via] as 'laptop-outline'} size={13} color={palette.muted} /> : null}
        <Text style={styles.small}>{savedAge(capture)}</Text>
        {capture.folder ? <View style={styles.folder}><Ionicons name="folder-outline" size={12} color={palette.muted} /><Text style={styles.small} numberOfLines={1}>{capture.folder.name}</Text></View> : null}
        {capture.batchId ? <Ionicons name="layers-outline" size={13} color={palette.muted} /> : null}
        {failed ? <Ionicons name="alert-circle-outline" size={13} color={palette.muted} /> : null}
      </View>
      {pending ? <ShimmerText style={styles.small} color={palette.muted} highlight={palette.ink}>Preparing details</ShimmerText> : null}
    </View>
  </Pressable>;
});
const baseStyles = StyleSheet.create({
  card: { width: '100%', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.glassEdge, backgroundColor: colors.surface, overflow: 'hidden', padding: 5 },
  written: { backgroundColor: colors.note }, pressed: { opacity: .84, transform: [{ scale: .985 }] }, copy: { padding: 12, gap: 7 },
  blurred: { transform: [{ scale: 1.25 }] },
  clear: { backgroundColor: 'transparent' },
  tile: { aspectRatio: 1.4, alignItems: 'center', justifyContent: 'center' },
  panel: { borderRadius: 15, borderWidth: 1, borderColor: colors.glassEdge, overflow: 'hidden' },
  preview: { borderRadius: 15 },
  caption: { marginTop: -26, marginHorizontal: 5, marginBottom: 5, borderRadius: 13, borderWidth: 1, borderColor: colors.glassEdge, overflow: 'hidden' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  small: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  title: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -.2 },
  excerpt: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingBottom: 2 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1, maxWidth: '60%' },
});
