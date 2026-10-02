// The parts the first-run proposals are drawn from (2026-10-02): a post you
// might come across, a share sheet (iPhone or Android), the library a save
// lands in, a finger's tap, and a looping clock to run a little scene on.
// The photographs are the film's generated ones (assets/images/film), never
// anyone's real saves; the other apps in the share sheet are generic.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';

export const native = Platform.OS !== 'web';
export const SF = Platform.select({ web: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', default: undefined });
export const GLOW = { textShadowColor: 'rgba(3,20,40,.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 };
export type ShareOS = 'ios' | 'android';

export const PHOTOS = {
  kyoto: require('../../../assets/images/film/kyoto.jpg'), ramen: require('../../../assets/images/film/ramen.jpg'),
  lake: require('../../../assets/images/film/lake.jpg'), pasta: require('../../../assets/images/film/pasta.jpg'),
  trail: require('../../../assets/images/film/trail.jpg'), coffee: require('../../../assets/images/film/coffee.jpg'),
};
const ICON = require('../../../assets/images/icon.png');
export const AGENT_ORB = require('../../../assets/images/elements/agent-orb.webp');

/** A scene on a loop `length` ms long. at(times, values) eases between moments and holds outside them;
 * with reduced motion the scene stands still at `still`. */
export function useLoop(length: number, still: number, run = true) {
  const motion = useMotionAllowed();
  // Made at 0: Animated.loop resets to the value it was made with before every round, so a clock
  // made at `still` would start each round mid-scene. Reduced motion moves it to `still` instead.
  const clock = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion || !run) { clock.setValue(still); return; }
    clock.setValue(0);
    const loop = Animated.loop(Animated.timing(clock, { toValue: length, duration: length, easing: Easing.linear, useNativeDriver: native }));
    loop.start(); return () => loop.stop();
  }, [motion, run, length, still, clock]);
  return (times: number[], values: number[]) => clock.interpolate({ inputRange: times, outputRange: values, extrapolate: 'clamp', easing: Easing.inOut(Easing.cubic) });
}

/** A post as an app shows it: who posted it, the photo, and its buttons — Share last. */
export const POST = { header: 44, footer: 46 };
export function Post({ photo, handle, width }: { photo: ImageSourcePropType; handle: string; width: number }) {
  return <View style={[styles.post, { width }]}>
    <View style={styles.postHead}><View style={styles.avatar} /><Text style={styles.handle}>{handle}</Text></View>
    <Image source={photo} style={{ width, height: width }} accessible={false} />
    <View style={styles.postFoot}>
      <Ionicons name="heart-outline" size={22} color="#1d1d1f" />
      <Ionicons name="chatbubble-outline" size={20} color="#1d1d1f" />
      <View style={styles.grow} />
      <Ionicons name="share-outline" size={22} color="#1d1d1f" />
    </View>
  </View>;
}
/** Where the post's Share button is, from the post's top-left corner. */
export const postShareAt = (width: number) => ({ x: width - 25, y: POST.header + width + POST.footer / 2 });

type AppKind = 'messages' | 'mail' | 'notes' | 'reminders' | 'foundkeep' | 'more';
const APPS: Record<AppKind, { label: string; color: string; icon?: string; ink?: string }> = {
  messages: { label: 'Messages', color: '#34c759', icon: 'chatbubble' }, mail: { label: 'Mail', color: '#1e88ff', icon: 'mail' },
  notes: { label: 'Notes', color: '#ffd60a', icon: 'document-text', ink: '#5b4a00' }, reminders: { label: 'Reminders', color: '#ff9f0a', icon: 'list' },
  foundkeep: { label: 'FoundKeep', color: '#181a18' }, more: { label: 'More', color: '#e5e5ea', icon: 'ellipsis-horizontal', ink: '#3a3a3c' },
};
export function AppIcon({ kind, size = 58, round = false }: { kind: AppKind; size?: number; round?: boolean }) {
  const app = APPS[kind];
  return <View style={[styles.appIcon, { width: size, height: size, borderRadius: round ? size / 2 : size * 0.23, backgroundColor: app.color }]}>
    {kind === 'foundkeep' ? <Image source={ICON} style={{ width: size, height: size }} accessible={false} />
      : <Ionicons name={app.icon as 'mail'} size={size * 0.48} color={app.ink ?? '#ffffff'} />}
  </View>;
}
export const appLabel = (kind: AppKind) => APPS[kind].label;

/** The share sheet's row of apps (iPhone) or grid (Android); `lift` raises FoundKeep. */
export const SHEET = { ios: { head: 70, row: 96 }, android: { head: 56, row: 92 } };
export function ShareSheet({ os, width, apps, lift, photo, title }: { os: ShareOS; width: number; apps: AppKind[]; lift?: Animated.AnimatedInterpolation<number> | Animated.Value; photo: ImageSourcePropType; title: string }) {
  const ios = os === 'ios';
  return <View style={[styles.sheet, { width }, !ios && styles.sheetAndroid]}>
    {ios ? <View style={styles.sheetHead}><Image source={photo} style={styles.sheetThumb} accessible={false} /><View style={styles.grow}><Text style={styles.sheetTitle} numberOfLines={1}>{title}</Text><Text style={styles.sheetMeta}>Reel</Text></View><View style={styles.sheetClose}><Ionicons name="close" size={16} color="#6e6e73" /></View></View>
      : <Text style={styles.androidTitle}>Share</Text>}
    <View style={styles.sheetRow}>
      {apps.map(kind => <Animated.View key={kind} style={[styles.sheetApp, kind === 'foundkeep' && lift ? { transform: [{ scale: lift }] } : null]}>
        <AppIcon kind={kind} size={ios ? 58 : 52} round={!ios} />
        <Text style={styles.appName} numberOfLines={1}>{appLabel(kind)}</Text>
      </Animated.View>)}
    </View>
    {ios ? <View style={styles.sheetActions}><Text style={styles.sheetAction}>Copy</Text><Ionicons name="copy-outline" size={18} color="#1d1d1f" /></View> : null}
  </View>;
}
/** The centre of app `index` in a sheet of `width` with `count` apps, from the sheet's top-left. */
export const sheetAppAt = (os: ShareOS, width: number, count: number, index: number) => ({ x: 16 + ((width - 32) / count) * (index + 0.5), y: SHEET[os].head + 34 });

/** The library a save lands in: a small stack of the last few saves. */
export function Library({ photos, label = 'Your library', size = 56 }: { photos: ImageSourcePropType[]; label?: string; size?: number }) {
  return <View style={styles.library}>
    <View style={{ width: size * 1.7, height: size * 1.15, alignItems: 'center', justifyContent: 'center' }}>
      {photos.slice(0, 3).map((photo, i) => <Image key={i} source={photo} accessible={false} style={[styles.stackCard, { width: size, height: size, borderRadius: size * 0.21, transform: [{ rotate: `${(i - 1) * 7}deg` }, { translateX: (i - 1) * size * 0.16 }], zIndex: i }]} />)}
    </View>
    {/* On a dim glass chip, so it reads over bright cloud. */}
    {label ? <View style={styles.libraryChip}><Text style={styles.libraryLabel}>{label}</Text></View> : null}
  </View>;
}

/** A finger's tap: a soft ring that blooms and fades. */
export function Tap({ x, y, show }: { x: number; y: number; show: Animated.AnimatedInterpolation<number> }) {
  return <Animated.View pointerEvents="none" style={[styles.tap, { left: x - 26, top: y - 26, opacity: show.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }), transform: [{ scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) }] }]} />;
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  post: { backgroundColor: '#ffffff', borderRadius: 22, overflow: 'hidden', shadowColor: '#06203a', shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 14 } },
  postHead: { height: POST.header, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f2a65a', borderWidth: 2, borderColor: '#ffe3c4' },
  handle: { fontFamily: SF, fontSize: 13.5, fontWeight: '600', color: '#1d1d1f' },
  postFoot: { height: POST.footer, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14 },
  appIcon: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sheet: { backgroundColor: '#f2f2f7', borderRadius: 30, paddingBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 30, shadowOffset: { width: 0, height: -4 } },
  sheetAndroid: { backgroundColor: '#ffffff', borderRadius: 26 },
  sheetHead: { height: SHEET.ios.head, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.12)' },
  sheetThumb: { width: 42, height: 42, borderRadius: 9 },
  sheetTitle: { fontFamily: SF, fontSize: 14.5, fontWeight: '600', color: '#1d1d1f' },
  sheetMeta: { fontFamily: SF, fontSize: 12.5, color: '#6e6e73', marginTop: 1 },
  sheetClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  androidTitle: { height: SHEET.android.head, lineHeight: SHEET.android.head, paddingHorizontal: 22, fontFamily: SF, fontSize: 17, fontWeight: '600', color: '#1d1d1f' },
  sheetRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 },
  sheetApp: { flex: 1, alignItems: 'center', gap: 6 },
  appName: { fontFamily: SF, fontSize: 11.5, color: '#1d1d1f', maxWidth: 72 },
  sheetActions: { marginHorizontal: 16, marginTop: 14, height: 48, borderRadius: 12, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  sheetAction: { fontFamily: SF, fontSize: 15.5, color: '#1d1d1f' },
  library: { alignItems: 'center', gap: 10 },
  stackCard: { position: 'absolute', borderWidth: 2, borderColor: '#ffffff' },
  libraryChip: { paddingHorizontal: 11, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: 'rgba(10,30,55,0.38)' },
  libraryLabel: { fontFamily: SF, fontSize: 13, fontWeight: '600', color: '#ffffff' },
  tap: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: 'rgba(0,0,0,0.12)' },
});
