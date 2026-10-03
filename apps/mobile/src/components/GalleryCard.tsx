import { AdaptiveText as Text } from './AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from './AdaptiveIcon.tsx';
import { memo, useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { Capture } from '../api/types.ts';
import { captureTitle } from '../collection/model.ts';
import { origin } from '../collection/origin.ts';
import { capturePreviewSource, previewAspect } from '../collection/preview.ts';
import { CapturePreview, captureLabels } from './CapturePreview.tsx';
import { Shimmer, ShimmerText } from './Shimmer.tsx';
import { colors, palettes } from '../theme.ts';
import { useThemedStyles } from '../appearance/AppearanceProvider.tsx';
import { savedAge, savedVia, savedViaLabels, type SavedVia } from '../../../../packages/shared/src/collection-presentation.ts';
import { useMaterial } from './ScenicSurface.tsx';
import { useSession } from '../session/SessionProvider.tsx';

// A save in the Library (Pritam, 2026-10-02/03: "Today, concise", with a little glass).
// Today's shape — the caption over the bottom of the picture — said in icons instead of
// words: above the title, the platform's own mark and the source; under it, how it was
// saved (a phone, a laptop…) with when, and the folder. No tags (they stay on the save).
// The card is clean and white; only the caption is glass: frosted white, with the picture
// softly blurred through it where it overlaps — a blurred copy of the picture lined up
// exactly behind the frost, so no live blur per card. Reduce Transparency gives a solid
// caption. The picture: a fixed height for a page, a PDF or a full page; a photo or a video
// taller when it's tall, up to a most (collection/preview previewAspect). The cards before:
// proposals/cards/BeforeCard and GlassEverywhereCard.
const VIA: Record<SavedVia, string> = { iphone: 'phone-portrait-outline', android: 'logo-android', browser: 'laptop-outline', dashboard: 'globe-outline' };
const alpha = (hex: string, amount: number) => `${hex}${Math.round(amount * 255).toString(16).padStart(2, '0')}`;
/** From clear to `color`, top to bottom — where the blurred picture melts into the caption. */
const fade = (color: string) => (Platform.OS === 'web' ? { backgroundImage: `linear-gradient(to bottom, ${alpha(color, 0)}, ${color})` } : { experimental_backgroundImage: `linear-gradient(to bottom, ${alpha(color, 0)}, ${color})` }) as ViewStyle;
export const GalleryCard = memo(function GalleryCard({ capture, onOpen }: { capture: Capture; onOpen: (capture: Capture) => void }) {
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
  // Glass only on the caption, and only over a picture.
  const glass = Boolean(source) && !opaque && !written;
  // A post with only words (no photo, nothing being fetched): its words are the card, no empty picture.
  const wordsOnly = !written && !source && capture.type === 'tweet' && !pending;
  const [picture, setPicture] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [caption, setCaption] = useState({ x: 0, y: 0 });
  // Everything the icons say, for screen readers.
  const said = [title, `From ${from.name}`, via ? `Saved ${savedViaLabels[via]}` : null, savedAge(capture), capture.folder ? `In ${capture.folder.name}` : null, capture.batchId ? 'Saved together' : null, pending ? 'Details are being prepared' : failed ? 'The page couldn’t be read' : null].filter(Boolean).join('. ');
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${captureLabels[capture.type]}: ${said}`} onPress={() => onOpen(capture)}
    style={({ pressed }) => [styles.card, { backgroundColor: opaque ? palette.surface : palette.glassCard }, written && styles.written, pressed && styles.pressed]}>
    {/* Being prepared, with nothing to show yet: the picture's place shimmers. */}
    {written || wordsOnly ? null : pending && !source ? <Shimmer style={[styles.preview, { aspectRatio: 1.4 }]} />
      : <View onLayout={event => { const { x, y, width, height } = event.nativeEvent.layout; setPicture(previous => previous.x === x && previous.y === y && previous.width === width && previous.height === height ? previous : { x, y, width, height }); }}>
        <CapturePreview capture={capture} style={[styles.preview, { aspectRatio: previewAspect(capture) }]} />
      </View>}
    <View onLayout={event => { const { x, y } = event.nativeEvent.layout; setCaption(previous => previous.x === x && previous.y === y ? previous : { x, y }); }}
      style={[styles.copy, !written && !wordsOnly && styles.caption, !written && { backgroundColor: glass ? 'transparent' : opaque ? palette.surface : palette.glassCard }, opaque && { borderColor: palette.line }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {glass && picture.width ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={source!} blurRadius={18} resizeMode="cover" accessible={false} style={[styles.blurred, { left: picture.x - caption.x - 1, top: picture.y - caption.y - 1, width: picture.width, height: picture.height }]} />
        <View style={[styles.melt, { top: picture.y + picture.height - caption.y - 1 - 20 }, fade(scheme === 'dark' ? palette.surface : '#ffffff')]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: scheme === 'dark' ? alpha(palette.surface, 0.78) : alpha('#ffffff', 0.72) }]} />
      </View> : null}
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
  blurred: { position: 'absolute', borderRadius: 15 },
  melt: { position: 'absolute', left: 0, right: 0, height: 22 },
  preview: { borderRadius: 15 },
  caption: { marginTop: -26, marginHorizontal: 5, marginBottom: 5, borderRadius: 13, borderWidth: 1, borderColor: colors.glassEdge, overflow: 'hidden' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  small: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  title: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -.2 },
  excerpt: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingBottom: 2 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1, maxWidth: '60%' },
});
