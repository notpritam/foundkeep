// Today's card, made concise (proposal, 2026-10-02). Pritam keeps today's
// style — the caption that overlaps the bottom of the picture — and asked for
// icons instead of words and no tags:
//   concise  like today, a small line above the title: the platform's mark and the source;
//            under the title one row of icons — how it was saved (a phone, a laptop…) with
//            when, and the folder
//   icons    the title first, then everything in one row of icons: the platform's mark,
//            how it was saved, when, and the folder
// Tags are gone from the card (they stay on the save). Being prepared, couldn't be read
// and saved together are icons too, each with words for screen readers.
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Capture } from '../../api/types.ts';
import { useThemedStyles } from '../../appearance/AppearanceProvider.tsx';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { CapturePreview, captureLabels } from '../../components/CapturePreview.tsx';
import { useMaterial } from '../../components/ScenicSurface.tsx';
import { captureTitle } from '../../collection/model.ts';
import { colors, palettes } from '../../theme.ts';
import { previewRatio, savedAge, savedVia, savedViaLabels, type SavedVia } from '../../../../../packages/shared/src/collection-presentation.ts';
import { origin } from './SaveCards.tsx';

type CardProps = { capture: Capture; onOpen: (capture: Capture) => void };
const VIA: Record<SavedVia, string> = { iphone: 'phone-portrait-outline', android: 'logo-android', browser: 'laptop-outline', dashboard: 'globe-outline' };

function TodayCard({ capture, onOpen, arrangement }: CardProps & { arrangement: 'concise' | 'icons' }) {
  const { opaque, scheme } = useMaterial();
  const styles = useThemedStyles(baseStyles);
  const palette = palettes[scheme];
  const written = capture.type === 'note' || capture.type === 'selection';
  const excerpt = capture.noteText || capture.selectionText || capture.summary || capture.articleText;
  const title = capture.type === 'tweet' && capture.selectionText ? capture.selectionText : captureTitle(capture);
  const from = origin(capture);
  const via = savedVia(capture);
  const pending = capture.status === 'pending' || capture.status === 'processing';
  const failed = capture.status === 'failed';
  const mark = <Ionicons name={from.icon as 'logo-x'} size={13} color={from.color === 'muted' ? palette.muted : from.color ?? palette.ink} />;
  // Everything the icons say, for screen readers.
  const said = [title, `From ${from.name}`, via ? `Saved ${savedViaLabels[via]}` : null, savedAge(capture), capture.folder ? `In ${capture.folder.name}` : null, capture.batchId ? 'Saved together' : null, pending ? 'Details are being prepared' : failed ? 'The page couldn’t be read' : null].filter(Boolean).join('. ');
  const icons = <View style={styles.icons}>
    {arrangement === 'icons' ? mark : null}
    {via ? <Ionicons name={VIA[via] as 'laptop-outline'} size={13} color={palette.muted} /> : null}
    <Text style={styles.small}>{savedAge(capture)}</Text>
    {capture.folder ? <View style={styles.folder}><Ionicons name="folder-outline" size={12} color={palette.muted} /><Text style={styles.small} numberOfLines={1}>{capture.folder.name}</Text></View> : null}
    {capture.batchId ? <Ionicons name="layers-outline" size={13} color={palette.muted} /> : null}
    {pending ? <Ionicons name="hourglass-outline" size={13} color={palette.pending} /> : failed ? <Ionicons name="alert-circle-outline" size={13} color={palette.muted} /> : null}
  </View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${captureLabels[capture.type]}: ${said}`} onPress={() => onOpen(capture)}
    style={({ pressed }) => [styles.card, { backgroundColor: opaque ? palette.surface : palette.glassCard }, written && styles.written, pressed && styles.pressed]}>
    {!written ? <CapturePreview capture={capture} style={[styles.preview, { aspectRatio: previewRatio(capture.width, capture.height) }]} /> : null}
    <View style={[styles.copy, !written && styles.caption, !written && { backgroundColor: opaque ? palette.surface : palette.glassCard }, opaque && { borderColor: palette.line }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {arrangement === 'concise' ? <View style={styles.source}>{mark}<Text style={styles.small} numberOfLines={1}>{from.name}</Text></View> : null}
      <Text style={styles.title} numberOfLines={4}>{title}</Text>
      {written && excerpt && excerpt !== title ? <Text style={styles.excerpt} numberOfLines={6}>{excerpt}</Text> : null}
      {icons}
    </View>
  </Pressable>;
}

export const ConciseCard = memo((props: CardProps) => <TodayCard {...props} arrangement="concise" />);
export const IconsCard = memo((props: CardProps) => <TodayCard {...props} arrangement="icons" />);

// Today's card's own look (GalleryCard), unchanged except for what it shows.
const baseStyles = StyleSheet.create({
  card: { width: '100%', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.glassEdge, backgroundColor: colors.surface, overflow: 'hidden', padding: 5 },
  written: { backgroundColor: colors.note }, pressed: { opacity: .84, transform: [{ scale: .985 }] }, copy: { padding: 12, gap: 7 },
  preview: { borderRadius: 15 },
  caption: { marginTop: -26, marginHorizontal: 5, marginBottom: 5, borderRadius: 13, borderWidth: 1, borderColor: colors.glassEdge },
  source: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  small: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  title: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -.2 },
  excerpt: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingBottom: 2 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1, maxWidth: '60%' },
});
