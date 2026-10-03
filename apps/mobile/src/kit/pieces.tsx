// What the search panel and Ask Kit share (locked 2026-10-03): Kit's orb, a panel that rises from
// the bottom, the field (always at the bottom, by the thumb), saves as a list, recent searches.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Capture } from '../api/types.ts';
import { useAppearance } from '../appearance/AppearanceProvider.tsx';
import { AdaptiveText as Text } from '../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../components/AdaptiveIcon.tsx';
import { CapturePreview } from '../components/CapturePreview.tsx';
import { useMotionAllowed } from '../components/motion.tsx';
import { ScrollEdge } from '../components/ScrollEdge';
import { captureTitle } from '../collection/model.ts';
import { origin } from '../collection/origin.ts';
import { palettes } from '../theme.ts';
import { savedAge } from '../../../../packages/shared/src/collection-presentation.ts';

export const KIT_ORB = require('../../assets/images/elements/agent-orb.webp');
export function usePalette() { return palettes[useAppearance().scheme]; }
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const native = Platform.OS !== 'web';
// The browser's own focus box would sit inside the rounded field; the caret shows focus there.
const web = (Platform.OS === 'web' ? { outlineStyle: 'none' } : null) as object | null;

/** A panel over the screen, rising from the bottom as it opens. */
export function Panel({ open, children }: { open: boolean; children: ReactNode }) {
  const P = usePalette();
  const motion = useMotionAllowed();
  const { height } = useWindowDimensions();
  const t = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => { Animated.timing(t, { toValue: open ? 1 : 0, duration: motion ? 420 : 0, easing: SETTLE, useNativeDriver: native }).start(); }, [open, motion, t]);
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityViewIsModal={open} style={[StyleSheet.absoluteFill, styles.panel, { backgroundColor: P.paper, opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height * 0.3, 0] }) }] }]}>{children}</Animated.View>;
}
/** The panel's head: close, its name (with Kit's orb), and one action on the right — see-through, over
 * the scrolling middle's blur. */
export function Head({ title, orb = false, onClose, action }: { title: string; orb?: boolean; onClose: () => void; action?: ReactNode }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  return <View style={[styles.head, { paddingTop: insets.top + 6, height: insets.top + HEAD }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={styles.round}><Ionicons name="chevron-down" size={22} color={P.ink} /></Pressable>
    <View style={styles.headTitle}>{orb ? <Image source={KIT_ORB} style={styles.headOrb} accessible={false} /> : null}<Text accessibilityRole="header" style={[styles.title, { color: P.ink }]}>{title}</Text></View>
    <View style={styles.round}>{action}</View>
  </View>;
}
/** The field, at the bottom: a search icon or Kit's orb, the words, clear, and send for Kit. */
export function Field({ value, onChange, onSubmit, placeholder, kit = false, autoFocus = false }: { value: string; onChange: (text: string) => void; onSubmit: () => void; placeholder: string; kit?: boolean; autoFocus?: boolean }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  return <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
    <View style={[styles.field, { backgroundColor: P.surface, borderColor: P.line }]}>
      {kit ? <Image source={KIT_ORB} style={styles.fieldOrb} accessible={false} /> : <Ionicons name="search" size={19} color={P.muted} />}
      <TextInput value={value} onChangeText={onChange} onSubmitEditing={onSubmit} autoFocus={autoFocus} returnKeyType={kit ? 'send' : 'search'} placeholder={placeholder} placeholderTextColor={P.muted}
        style={[styles.input, web, { color: P.ink }]} accessibilityLabel={placeholder} autoCorrect={false} />
      {value && !kit ? <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={() => onChange('')} hitSlop={8} style={styles.clear}><Ionicons name="close-circle" size={19} color={P.muted} /></Pressable> : null}
      {kit ? <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!value.trim()} onPress={onSubmit} style={({ pressed }) => [styles.send, { backgroundColor: value.trim() ? P.ink : P.line }, pressed && styles.pressed]}><Ionicons name="arrow-up" size={19} color={P.paper} /></Pressable> : null}
    </View>
  </View>;
}
/** The panel's scrolling middle (2026-10-03): it runs under the see-through head, blurring as it
 * passes (as the Library's scroll edge does), and blurs again as it reaches what's below it. */
export const HEAD = 52;
export function Scrolling({ children, scrollRef, bottomAligned = true }: { children: ReactNode; scrollRef?: React.Ref<ScrollView>; bottomAligned?: boolean }) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const head = insets.top + HEAD;
  return <View style={styles.middle}>
    <ScrollView ref={scrollRef} style={StyleSheet.absoluteFill} contentContainerStyle={[styles.scroll, bottomAligned && styles.bottomAligned, { paddingTop: head + 8 }]}
      onContentSizeChange={() => { if (bottomAligned && scrollRef && 'current' in scrollRef) scrollRef.current?.scrollToEnd({ animated: false }); }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    <ScrollEdge edge="top" height={head + 18} hold={(head - 6) / (head + 18)} color={P.paper} />
    <ScrollEdge edge="bottom" height={34} hold={0.15} color={P.paper} />
  </View>;
}

/** Saves as a list: picture, title, where it came from and when. */
export function SaveRows({ items, onOpen, limit = 12 }: { items: Capture[]; onOpen: (capture: Capture) => void; limit?: number }) {
  const P = usePalette();
  return <View style={[styles.rows, { backgroundColor: P.surface, borderColor: P.line }]}>
    {items.slice(0, limit).map((capture, i) => { const from = origin(capture); return <Pressable key={capture.id} accessibilityRole="button" accessibilityLabel={headline(capture)} onPress={() => onOpen(capture)} style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.line }, pressed && { backgroundColor: P.paper }]}>
      <View style={[styles.thumb, { backgroundColor: P.note }]}>{capture.type === 'note' || capture.type === 'selection' ? <Ionicons name={capture.type === 'note' ? 'create-outline' : 'chatbox-ellipses-outline'} size={18} color={P.accent} /> : <CapturePreview capture={capture} compact style={styles.fill} />}</View>
      <View style={styles.rowWords}>
        <Text style={[styles.rowTitle, { color: P.ink }]} numberOfLines={2}>{headline(capture)}</Text>
        <View style={styles.origin}><Ionicons name={from.icon as 'logo-x'} size={12} color={from.color === 'muted' ? P.muted : from.color ?? P.ink} /><Text style={[styles.originText, { color: P.muted }]} numberOfLines={1}>{from.name} · {savedAge(capture)}</Text></View>
      </View>
    </Pressable>; })}
  </View>;
}
/** Recent searches as big rows: tap anywhere to search again, × to forget it. */
export function RecentRows({ list, onRun, onRemove }: { list: string[]; onRun: (query: string) => void; onRemove: (query: string) => void }) {
  const P = usePalette();
  return <View style={[styles.rows, { backgroundColor: P.surface, borderColor: P.line }]}>
    {list.slice(0, 5).map((query, i) => <View key={query} style={[styles.recent, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Search again for ${query}`} onPress={() => onRun(query)} style={({ pressed }) => [styles.recentMain, pressed && styles.pressed]}>
        <Ionicons name="time-outline" size={19} color={P.muted} /><Text style={[styles.recentText, { color: P.ink }]} numberOfLines={1}>{query}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${query} from recent searches`} hitSlop={8} onPress={() => onRemove(query)} style={styles.recentRemove}><Ionicons name="close" size={16} color={P.muted} /></Pressable>
    </View>)}
  </View>;
}
export function Label({ children }: { children: string }) {
  const P = usePalette();
  return <Text style={[styles.label, { color: P.muted }]}>{children}</Text>;
}
export const headline = (capture: Capture) => (capture.type === 'tweet' && capture.selectionText ? capture.selectionText : captureTitle(capture));

const styles = StyleSheet.create({
  panel: { zIndex: 6 },
  pressed: { opacity: 0.75 },
  head: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 6 },
  middle: { flex: 1, overflow: 'hidden' },
  scroll: { flexGrow: 1, paddingBottom: 14 },
  bottomAligned: { justifyContent: 'flex-end' },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headOrb: { width: 26, height: 26 },
  title: { fontSize: 17, fontWeight: '700' },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  composer: { paddingHorizontal: 12, paddingTop: 6 },
  field: { minHeight: 54, borderRadius: 27, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6 },
  fieldOrb: { width: 24, height: 24 },
  // minWidth 0: a text field has a width of its own on the web and would push past the buttons beside it.
  input: { flex: 1, minWidth: 0, fontSize: 16.5, minHeight: 44 },
  clear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rows: { marginHorizontal: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  thumb: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%', aspectRatio: undefined },
  rowWords: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '600' },
  origin: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  originText: { fontSize: 12.5, flexShrink: 1 },
  recent: { flexDirection: 'row', alignItems: 'center' },
  recentMain: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16 },
  recentText: { flex: 1, fontSize: 16.5, fontWeight: '500' },
  recentRemove: { width: 46, height: 54, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20 },
});
