// First run (proposal, 2026-10-02): the screen someone sees right after they
// first sign in — how to save from any app. Four ways, each showing it rather
// than describing it, in as few words as will do:
//   watch    a short scene loops: a post → Share → FoundKeep → into your library
//   steps    three pages: Tap Share · Pick FoundKeep · It's kept, ready for your agent
//   closeup  the share sheet up close, with the step people miss on iPhone
//            (FoundKeep not in the row: tap More and add it)
//   try      do it once: share a sample post to FoundKeep, here, and watch it land
// The sky carries on from sign-in (except closeup, a light page). `os` draws
// the iPhone share sheet or Android's share menu.
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, PanResponder, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { SkyBackdrop } from '../../sign-in/FirstScreen.tsx';
import { Swap } from '../../sign-in/Handoff.tsx';
import { AGENT_ORB, AppIcon, appLabel, GLOW, Library, native, PHOTOS, Post, POST, postShareAt, SF, ShareSheet, sheetAppAt, Tap, useLoop, type ShareOS } from './pieces.tsx';

export type FirstRunLook = 'watch' | 'steps' | 'closeup' | 'try';
type LookProps = { os: ShareOS; onDone: () => void; autoplay?: boolean };
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const SHEET_H = { ios: 228, android: 196 };
const SHARE_APPS = ['messages', 'mail', 'foundkeep', 'notes'] as const;

export function FirstRun({ look, os = 'ios', onDone = () => {}, autoplay = false }: { look: FirstRunLook; os?: ShareOS; onDone?: () => void; autoplay?: boolean }) {
  const props = { os, onDone, autoplay };
  if (look === 'steps') return <Steps {...props} />;
  if (look === 'closeup') return <Closeup {...props} />;
  if (look === 'try') return <Try {...props} />;
  return <Watch {...props} />;
}

// ——— One: watch it happen ———

function Watch({ os, onDone }: LookProps) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const at = useLoop(7400, 2350);
  const P = Math.min(W - 128, 250), postH = POST.header + P + POST.footer;
  const post = { left: (W - P) / 2, top: insets.top + 150 };
  const share = postShareAt(P);
  const sheetW = W - 24, sheetTop = H - insets.bottom - 88 - SHEET_H[os];
  const fk = sheetAppAt(os, sheetW, SHARE_APPS.length, 2);
  const lib = { x: W / 2, y: H - insets.bottom - 150 };
  const fly = { x: lib.x - (post.left + P / 2), y: lib.y - (post.top + postH / 2) };
  return <View style={styles.fill}>
    <StatusBar style="light" />
    <SkyBackdrop />
    <Words title="Save from any app" line="Tap Share, then FoundKeep." />
    <View style={[styles.libraryAt, { top: lib.y - 32 }]}>
      <Animated.View style={{ transform: [{ scale: at([3850, 4000, 4300], [1, 1.1, 1]) }] }}><Library photos={[PHOTOS.lake, PHOTOS.pasta, PHOTOS.kyoto]} /></Animated.View>
      <Animated.View style={[styles.saved, { opacity: at([3900, 4200, 6000, 6400], [0, 1, 1, 0]) }]}><Ionicons name="checkmark" size={14} color="#0d7a50" /><Text style={styles.savedText}>Saved</Text></Animated.View>
    </View>
    <Animated.View style={[styles.abs, { left: post.left, top: post.top, opacity: at([0, 3800, 3900, 6600, 7300], [1, 1, 0, 0, 1]),
      transform: [{ translateX: at([3000, 3900, 6500, 6510], [0, fly.x, fly.x, 0]) }, { translateY: at([3000, 3900, 6500, 6510, 6600, 7300], [0, fly.y, fly.y, 14, 14, 0]) }, { scale: at([3000, 3900, 6500, 6510], [1, 0.2, 0.2, 1]) }] }]}>
      <Post photo={PHOTOS.kyoto} handle="slow.travels" width={P} />
    </Animated.View>
    <Tap x={post.left + share.x} y={post.top + share.y} show={at([900, 1350], [0, 1])} />
    <Animated.View style={[styles.abs, { left: 12, top: sheetTop, opacity: at([1200, 1400, 2800, 3000], [0, 1, 1, 0]), transform: [{ translateY: at([1200, 1750, 2650, 3000], [320, 0, 0, 320]) }] }]}>
      <ShareSheet os={os} width={sheetW} apps={[...SHARE_APPS]} lift={at([1900, 2150, 2650, 2850], [1, 1.12, 1.12, 1])} photo={PHOTOS.kyoto} title="Two days in Kyoto" />
      <Tap x={fk.x} y={fk.y} show={at([2150, 2600], [0, 1])} />
    </Animated.View>
    <Foot><Pill label="Got it" tone="light" onPress={onDone} /></Foot>
  </View>;
}

// ——— Two: three steps ———

function Steps({ os, onDone, autoplay }: LookProps) {
  const { width: W } = useWindowDimensions();
  const motion = useMotionAllowed();
  const [page, setPage] = useState(0);
  const shown = useRef([0, 1, 2].map(i => new Animated.Value(i === 0 ? 0 : i))).current;
  useEffect(() => {
    shown.forEach((value, i) => Animated.timing(value, { toValue: i - page, duration: motion ? 620 : 0, easing: SETTLE, useNativeDriver: native }).start());
  }, [page, motion, shown]);
  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(() => setPage(p => (p + 1) % 3), 3400);
    return () => clearTimeout(timer);
  }, [autoplay, page]);
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => setPage(p => g.dx < -40 ? Math.min(2, p + 1) : g.dx > 40 ? Math.max(0, p - 1) : p),
  })).current;
  const pages: { title: string; line: string; art: ReactNode }[] = [
    { title: 'Tap Share', line: 'In any app.', art: <ShareArt /> },
    { title: 'Pick FoundKeep', line: os === 'ios' ? 'It’s in the share sheet.' : 'It’s in the share menu.', art: <PickArt os={os} /> },
    { title: 'It’s kept', line: 'Ready for your agent.', art: <KeptArt /> },
  ];
  return <View style={styles.fill} {...swipe.panHandlers}>
    <StatusBar style="light" />
    <SkyBackdrop />
    {pages.map((item, i) => <Animated.View key={item.title} pointerEvents={i === page ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, {
      opacity: shown[i].interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
      transform: [{ translateX: shown[i].interpolate({ inputRange: [-1, 0, 1], outputRange: [-W * 0.35, 0, W * 0.35] }) }] }]}>
      <Words title={item.title} line={item.line} />
      <View style={styles.stepArt}>{item.art}</View>
    </Animated.View>)}
    <Foot>
      <View style={styles.dots}>{[0, 1, 2].map(i => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Step ${i + 1}`} onPress={() => setPage(i)} hitSlop={8}><View style={[styles.dot, i === page && styles.dotOn]} /></Pressable>)}</View>
      <Pill label={page < 2 ? 'Next' : 'Got it'} tone="light" onPress={() => (page < 2 ? setPage(page + 1) : onDone())} />
    </Foot>
  </View>;
}
function ShareArt() {
  const at = useLoop(2600, 1100);
  const P = 210, share = postShareAt(P);
  return <View>
    <Post photo={PHOTOS.ramen} handle="noodle.diaries" width={P} />
    <Tap x={share.x} y={share.y} show={at([700, 1200], [0, 1])} />
  </View>;
}
function PickArt({ os }: { os: ShareOS }) {
  const { width: W } = useWindowDimensions();
  const at = useLoop(2600, 1200);
  const w = Math.min(W - 48, 340), fk = sheetAppAt(os, w, SHARE_APPS.length, 2);
  return <View>
    <ShareSheet os={os} width={w} apps={[...SHARE_APPS]} lift={at([500, 900, 1700, 2100], [1, 1.14, 1.14, 1])} photo={PHOTOS.ramen} title="Late-night ramen" />
    <Tap x={fk.x} y={fk.y} show={at([900, 1400], [0, 1])} />
  </View>;
}
function KeptArt() {
  const at = useLoop(5200, 0);
  return <View style={styles.keptArt}>
    <Library photos={[PHOTOS.lake, PHOTOS.ramen, PHOTOS.kyoto]} size={112} label="Your library" />
    <Animated.Image source={AGENT_ORB} accessible={false} style={[styles.keptOrb, { transform: [{ translateY: at([0, 2600, 5200], [0, -10, 0]) }] }]} />
  </View>;
}

// ——— Three: the share sheet up close ———

const CLOSE_ROW = ['messages', 'mail', 'notes', 'reminders', 'more'] as const;
const FAVOURITE_ROW = ['foundkeep', 'messages', 'mail', 'notes'] as const;
function Closeup({ os, onDone }: LookProps) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ios = os === 'ios';
  const at = useLoop(ios ? 8200 : 4200, ios ? 3600 : 1300);
  const sheetW = W - 24, cell = (sheetW - 32) / 4, shift = cell * (CLOSE_ROW.length - 4);
  // The sheet sits in the middle of the space between the words and the button.
  const sheetH = ios ? 300 : 236, sheetTop = Math.round((insets.top + 120 + (H - insets.bottom - 92)) / 2 - sheetH / 2);
  // More is the fifth app, a cell's width in once the row has slid; FoundKeep is the third row of the Apps panel.
  const moreAt = { x: 16 + cell * 3.5, y: 70 + 12 + 29 }, plusAt = { x: sheetW - 30, y: 38 + 52 * 2 + 26 };
  return <View style={[styles.fill, styles.page]}>
    <StatusBar style="dark" />
    <Words title="Find FoundKeep in Share" line={ios ? 'Not there? Tap More, and add it.' : 'Not there? Scroll the list.'} tone="page" />
    <View style={[styles.closeSheet, { left: 12, top: sheetTop, width: sheetW, height: sheetH }]}>
      {ios ? <>
        <View style={styles.closeHead}><Image source={PHOTOS.trail} style={styles.closeThumb} accessible={false} /><View style={styles.grow}><Text style={styles.closeTitle}>A ridge walk worth the climb</Text><Text style={styles.closeMeta}>Reel</Text></View></View>
        <View style={styles.closeRowClip}>
          <Animated.View style={[styles.closeRow, { opacity: at([4700, 5300, 7400, 8200], [1, 0, 0, 1]), transform: [{ translateX: at([900, 1700, 5300, 5400], [0, -shift, -shift, 0]) }] }]}>
            {CLOSE_ROW.map(kind => <AppCell key={kind} kind={kind} width={cell} />)}
          </Animated.View>
          <Animated.View style={[styles.closeRow, StyleSheet.absoluteFill, { opacity: at([4700, 5300, 7400, 8200], [0, 1, 1, 0]) }]}>
            {FAVOURITE_ROW.map(kind => <Animated.View key={kind} style={kind === 'foundkeep' ? { transform: [{ scale: at([5300, 5700, 6400, 6800], [1, 1.12, 1.12, 1]) }] } : null}><AppCell kind={kind} width={cell} /></Animated.View>)}
          </Animated.View>
        </View>
        <View style={styles.closeActions}><Text style={styles.closeAction}>Copy</Text><Ionicons name="copy-outline" size={18} color="#1d1d1f" /></View>
        <Tap x={moreAt.x} y={moreAt.y} show={at([1900, 2350], [0, 1])} />
        {/* More: the list of apps, where FoundKeep is added to the favourites. */}
        <Animated.View style={[styles.appsPanel, { opacity: at([2300, 2500, 4500, 4900], [0, 1, 1, 0]), transform: [{ translateY: at([2300, 2900, 4300, 4900], [300, 0, 0, 300]) }] }]}>
          <Text style={styles.panelTitle}>Apps</Text>
          {(['messages', 'mail', 'foundkeep', 'notes'] as const).map(kind => <View key={kind} style={styles.panelRow}>
            <AppIcon kind={kind} size={32} /><Text style={styles.panelName}>{appLabel(kind)}</Text>
            {kind === 'foundkeep' ? <View style={styles.panelControl}>
              <Animated.View style={[StyleSheet.absoluteFill, styles.centre, { opacity: at([3450, 3650], [1, 0]) }]}><Ionicons name="add-circle" size={26} color="#34c759" /></Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.centre, { opacity: at([3450, 3650], [0, 1]) }]}><Ionicons name="checkmark-circle" size={26} color="#0d7a50" /></Animated.View>
            </View> : <Ionicons name="remove-circle" size={26} color="#ff3b30" />}
          </View>)}
          <Tap x={plusAt.x} y={plusAt.y} show={at([3300, 3750], [0, 1])} />
        </Animated.View>
      </> : <>
        <Text style={styles.androidTitle}>Share</Text>
        <View style={styles.androidGrid}>
          {(['messages', 'mail', 'notes', 'reminders', 'more', 'foundkeep', 'messages', 'mail'] as const).map((kind, i) => <Animated.View key={i} style={[styles.androidCell, kind === 'foundkeep' ? { transform: [{ scale: at([600, 1000, 2600, 3000], [1, 1.14, 1.14, 1]) }] } : null]}>
            <AppIcon kind={kind} size={50} round /><Text style={styles.appName} numberOfLines={1}>{appLabel(kind)}</Text>
          </Animated.View>)}
        </View>
        <Tap x={16 + ((sheetW - 32) / 4) * 1.5} y={56 + 70 + 14 + 25} show={at([1000, 1500], [0, 1])} />
      </>}
    </View>
    <Foot><Pill label="Got it" tone="dark" onPress={onDone} /></Foot>
  </View>;
}
function AppCell({ kind, width }: { kind: Parameters<typeof AppIcon>[0]['kind']; width: number }) {
  return <View style={[styles.cell, { width }]}><AppIcon kind={kind} size={58} /><Text style={styles.appName} numberOfLines={1}>{appLabel(kind)}</Text></View>;
}

// ——— Four: try it once ———

type TryState = 'idle' | 'sheet' | 'saved';
export const TRY_LOOP = 7400;
/** Where the pointer taps in Try's playthrough, and when (ms into the loop). */
export function tryTaps(W: number, H: number, top: number, bottom: number, os: ShareOS) {
  const g = tryGeometry(W, H, top, bottom, os);
  return [{ x: W / 2, y: g.shareButton.y + 22, at: 1300 }, { x: 12 + g.fk.x, y: g.sheetTop + g.fk.y, at: 2900 }];
}
function tryGeometry(W: number, H: number, top: number, bottom: number, os: ShareOS) {
  const P = Math.min(W - 136, 236), postH = POST.header + P + POST.footer;
  const post = { left: (W - P) / 2, top: top + 150 };
  const sheetW = W - 24, sheetTop = H - bottom - 88 - SHEET_H[os];
  return { P, postH, post, shareButton: { y: post.top + postH + 18 }, sheetW, sheetTop, fk: sheetAppAt(os, sheetW, SHARE_APPS.length, 2), lib: { x: W / 2, y: H - bottom - 150 } };
}
function Try({ os, onDone, autoplay }: LookProps) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const [state, setState] = useState<TryState>('idle');
  const g = tryGeometry(W, H, insets.top, insets.bottom, os);
  const sheet = useRef(new Animated.Value(0)).current, fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const to = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, { toValue, duration: motion ? duration : 0, easing: SETTLE, useNativeDriver: native });
    if (state === 'idle') { fly.setValue(0); to(sheet, 0, 400).start(); }
    if (state === 'sheet') to(sheet, 1, 560).start();
    if (state === 'saved') Animated.parallel([to(sheet, 0, 420), Animated.sequence([Animated.delay(200), to(fly, 1, 900)])]).start();
  }, [state, motion, sheet, fly]);
  // The playthrough: share at 1.3 s, FoundKeep at 2.9 s, then start again.
  useEffect(() => {
    if (!autoplay) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      setState('idle');
      timers.push(setTimeout(() => setState('sheet'), 1450), setTimeout(() => setState('saved'), 3050), setTimeout(cycle, TRY_LOOP));
    };
    cycle();
    return () => timers.forEach(clearTimeout);
  }, [autoplay]);
  const saved = state === 'saved';
  const flyTo = { x: g.lib.x - (g.post.left + g.P / 2), y: g.lib.y - (g.post.top + g.postH / 2) };
  return <View style={styles.fill}>
    <StatusBar style="light" />
    <SkyBackdrop />
    <View style={[styles.words, { paddingTop: insets.top + 28 }]}>
      <Swap id={saved ? 'saved' : 'try'} align="start">
        <Text maxFontSizeMultiplier={1.3} style={[styles.title, GLOW]}>{saved ? 'Saved. That’s it.' : 'Try it once'}</Text>
        <Text maxFontSizeMultiplier={1.4} style={[styles.line, GLOW]}>{saved ? 'It’s in your library.' : 'Share this to FoundKeep.'}</Text>
      </Swap>
    </View>
    <View style={[styles.libraryAt, { top: g.lib.y - 32 }]}><Library photos={[PHOTOS.lake, PHOTOS.trail, PHOTOS.ramen]} /></View>
    <Animated.View style={[styles.abs, { left: g.post.left, top: g.post.top, opacity: fly.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] }),
      transform: [{ translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, flyTo.x] }) }, { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, flyTo.y] }) }, { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) }] }]}>
      <Post photo={PHOTOS.ramen} handle="noodle.diaries" width={g.P} />
    </Animated.View>
    <Animated.View style={[styles.abs, styles.shareRow, { top: g.shareButton.y, opacity: fly.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0] }) }]}>
      <Pressable accessibilityRole="button" onPress={() => setState('sheet')} disabled={state !== 'idle'} style={({ pressed }): StyleProp<ViewStyle> => [styles.shareButton, pressed && styles.pressed]}>
        <Ionicons name="share-outline" size={18} color="#1d1d1f" /><Text style={styles.shareLabel}>Share</Text>
      </Pressable>
    </Animated.View>
    <Animated.View pointerEvents={state === 'sheet' ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.scrim, { opacity: sheet }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setState('idle')} accessibilityLabel="Close the share sheet" />
    </Animated.View>
    <Animated.View pointerEvents={state === 'sheet' ? 'box-none' : 'none'} style={[styles.abs, { left: 12, top: g.sheetTop, opacity: sheet, transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }] }]}>
      <ShareSheet os={os} width={g.sheetW} apps={[...SHARE_APPS]} photo={PHOTOS.ramen} title="Late-night ramen" />
      <Pressable accessibilityRole="button" accessibilityLabel="FoundKeep" onPress={() => setState('saved')} style={[styles.fkTarget, { left: g.fk.x - 40, top: g.fk.y - 40 }]} />
    </Animated.View>
    <Foot><Swap id={saved ? 'go' : 'skip'}>{saved ? <Pill label="Start saving" tone="light" onPress={onDone} /> : <Pill label="Skip" tone="veil" onPress={onDone} />}</Swap></Foot>
  </View>;
}

// ——— Pieces of the page ———

function Words({ title, line, tone = 'sky' }: { title: string; line: string; tone?: 'sky' | 'page' }) {
  const insets = useSafeAreaInsets();
  const sky = tone === 'sky';
  return <View style={[styles.words, { paddingTop: insets.top + 28 }]}>
    <Text maxFontSizeMultiplier={1.3} style={[styles.title, sky ? GLOW : styles.ink]}>{title}</Text>
    <Text maxFontSizeMultiplier={1.4} style={[styles.line, sky ? GLOW : styles.muted]}>{line}</Text>
  </View>;
}
function Foot({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.foot, { paddingBottom: insets.bottom + 18 }]}>{children}</View>;
}
type PillTone = 'light' | 'dark' | 'veil';
const PILL: Record<PillTone, { background: string; ink: string }> = { light: { background: '#ffffff', ink: '#1d1d1f' }, dark: { background: '#0b0c0d', ink: '#ffffff' }, veil: { background: 'rgba(10,30,55,0.34)', ink: '#ffffff' } };
function Pill({ label, tone, onPress }: { label: string; tone: PillTone; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }): StyleProp<ViewStyle> => [styles.pill, { backgroundColor: PILL[tone].background }, pressed && styles.pressed]}>
    <Text maxFontSizeMultiplier={1.3} style={[styles.pillLabel, { color: PILL[tone].ink }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', backgroundColor: '#1a78c8' },
  page: { backgroundColor: '#f5f5f7' },
  abs: { position: 'absolute' },
  grow: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  words: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', paddingHorizontal: 32, gap: 6 },
  title: { fontFamily: SF, fontSize: 28, lineHeight: 33, fontWeight: '700', letterSpacing: -0.6, color: '#ffffff', textAlign: 'center' },
  line: { fontFamily: SF, fontSize: 16, lineHeight: 22, fontWeight: '500', color: '#ffffff', textAlign: 'center' },
  ink: { color: '#1d1d1f' },
  muted: { color: '#6e6e73' },
  foot: { position: 'absolute', left: 20, right: 20, bottom: 0, gap: 16 },
  pill: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  pillLabel: { fontFamily: SF, fontSize: 16, fontWeight: '600' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  libraryAt: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  saved: { position: 'absolute', top: -30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: '#ffffff' },
  savedText: { fontFamily: SF, fontSize: 13, fontWeight: '600', color: '#0d7a50' },
  stepArt: { position: 'absolute', left: 0, right: 0, top: '20%', height: '58%', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { width: 22, backgroundColor: '#ffffff' },
  keptArt: { width: 260, height: 220, alignItems: 'center', justifyContent: 'center' },
  keptOrb: { position: 'absolute', right: 0, top: -6, width: 78, height: 78 },
  closeSheet: { position: 'absolute', backgroundColor: '#f2f2f7', borderRadius: 30, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 30, shadowOffset: { width: 0, height: 8 } },
  closeHead: { height: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.12)' },
  closeThumb: { width: 42, height: 42, borderRadius: 9 },
  closeTitle: { fontFamily: SF, fontSize: 14.5, fontWeight: '600', color: '#1d1d1f' },
  closeMeta: { fontFamily: SF, fontSize: 12.5, color: '#6e6e73', marginTop: 1 },
  closeRowClip: { marginHorizontal: 16, marginTop: 12, height: 92, overflow: 'hidden' },
  closeRow: { flexDirection: 'row' },
  cell: { alignItems: 'center', gap: 6 },
  appName: { fontFamily: SF, fontSize: 11.5, color: '#1d1d1f', maxWidth: 72 },
  closeActions: { marginHorizontal: 16, marginTop: 10, height: 48, borderRadius: 12, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  closeAction: { fontFamily: SF, fontSize: 15.5, color: '#1d1d1f' },
  appsPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 250, backgroundColor: '#ffffff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 12 },
  panelTitle: { fontFamily: SF, fontSize: 15, fontWeight: '600', color: '#1d1d1f', textAlign: 'center', marginBottom: 6 },
  panelRow: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)' },
  panelName: { flex: 1, fontFamily: SF, fontSize: 15.5, color: '#1d1d1f' },
  panelControl: { width: 28, height: 28 },
  androidTitle: { height: 56, lineHeight: 56, paddingHorizontal: 22, fontFamily: SF, fontSize: 17, fontWeight: '600', color: '#1d1d1f' },
  androidGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, rowGap: 14 },
  androidCell: { width: '25%', alignItems: 'center', gap: 6 },
  shareRow: { left: 0, right: 0, alignItems: 'center' },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: '#ffffff', shadowColor: '#06203a', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  shareLabel: { fontFamily: SF, fontSize: 15.5, fontWeight: '600', color: '#1d1d1f' },
  scrim: { backgroundColor: 'rgba(3,16,32,0.32)' },
  fkTarget: { position: 'absolute', width: 80, height: 80 },
});
