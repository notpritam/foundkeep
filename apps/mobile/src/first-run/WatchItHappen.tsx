// First run: "Save from any app", shown by watching it happen (Pritam picked
// it 2026-10-02). PROVISIONAL: once the app's other screens are designed,
// Pritam will record the real flow on his phone and this is remade from that
// recording — until then it stands in, and the concept stays: save from any app.
//
// On the sign-in sky, a window plays two scenes on a loop, by themselves:
//   1. A post in an X-style app → Share → the iOS share sheet → FoundKeep is
//      right there in the row → FoundKeep's save sheet → Save.
//   2. A reel → Share → FoundKeep isn't in the row → slide along to More →
//      the Apps list → FoundKeep → Save.
// Each save leaves the window as one of the sign-in screen's floating cards,
// turning as it settles the way they arrive there, and lands in your library;
// the sign-in cards float at the window's edges. The words say only what to do.
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../components/motion.tsx';
import { SkyBackdrop } from '../sign-in/FirstScreen.tsx';
import { AppRow, AppsList, APPS_LIST, FavouriteActions, FILM_PHOTOS, GlassSheet, Reel, REEL_AT, SAVE, SavedCard, SaveSheet, SCREEN, SHEET, ShareSheetHead, sheetAppAt, X_AT, XPost } from './apps.tsx';

const native = Platform.OS !== 'web';
const SF = Platform.select({ web: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', default: undefined });
const GLOW = { textShadowColor: 'rgba(3,20,40,.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 };
const E = {
  reel: require('../../assets/images/elements/reel.webp'), tweet: require('../../assets/images/elements/tweet.webp'), article: require('../../assets/images/elements/article.webp'),
  short: require('../../assets/images/elements/short.webp'), thread: require('../../assets/images/elements/thread.webp'), agentReply: require('../../assets/images/elements/agent-reply.webp'),
};
const LIBRARY = [require('../../assets/images/film/lake.jpg'), require('../../assets/images/film/trail.jpg')];

/** The loop, in ms: scene one, then scene two. */
export const WATCH = {
  length: 17000, still: 3600,
  x: { share: 1100, sheet: [1300, 1800], lift: [2250, 2500, 2800], tapApp: 2500, sheetOut: [2850, 3200], save: [2950, 3450], tapSave: 4300, saveOut: [4600, 4900], fly: 4650, land: 5900 },
  swap: [7400, 8000],
  reel: { share: 8900, sheet: [9100, 9600], slide: [9900, 10600], tapMore: 10800, list: [11000, 11500], tapApp: 12000, listOut: [12300, 12600], save: [12350, 12850], tapSave: 13700, saveOut: [14000, 14300], fly: 14050, land: 15300 },
  back: [16400, 17000],
};
const REEL_ROW = ['messages', 'mail', 'notes', 'reminders', 'more'] as const;
const X_ROW = ['messages', 'mail', 'foundkeep', 'notes', 'reminders'] as const;

export function WatchItHappen({ onDone }: { onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const at = useLoop(WATCH.length, WATCH.still);
  const T = WATCH;
  // The window: as large as fits between the words and the library above the button.
  const top = insets.top + 100, floor = H - insets.bottom - 18 - 52 - 16 - 96 - 12;
  const scale = Math.min(Math.min(W - 96, 330) / SCREEN.width, (floor - top) / SCREEN.height);
  const win = { left: (W - SCREEN.width * scale) / 2, top, width: SCREEN.width * scale, height: SCREEN.height * scale };
  const lib = { x: W / 2, y: win.top + win.height + 14 + 32 };
  // Where a save leaves from: its photo in FoundKeep's save sheet.
  const from = { x: win.left + (8 + SAVE.thumb.x) * scale, y: win.top + (SCREEN.height - 8 - SAVE.height + SAVE.thumb.y) * scale };
  const slide = 14 + SHEET.cell * REEL_ROW.length - (SCREEN.width - 2 * SHEET.inset) + 6;
  const sheetTop = SCREEN.height - SHEET.inset - SHEET.height, listTop = SCREEN.height - SHEET.inset - APPS_LIST.height;
  const showX = at([0, T.swap[0], T.swap[1], T.back[0], T.back[1]], [1, 1, 0, 0, 1]);
  const lineX = at([0, T.swap[0], T.swap[1], T.back[0], T.back[1]], [1, 1, 0, 0, 1]);
  const landed = at([T.x.land - 60, T.x.land + 160, T.reel.land - 60, T.reel.land + 160], [0, 1, 1, 0]);
  const cards = [
    { source: E.reel, side: -1, y: 0.08, size: 78, turn: -7 }, { source: E.article, side: -1, y: 0.46, size: 84, turn: -4 }, { source: E.thread, side: -1, y: 0.8, size: 80, turn: -6 },
    { source: E.tweet, side: 1, y: 0.04, size: 90, turn: 6 }, { source: E.short, side: 1, y: 0.42, size: 80, turn: 7 }, { source: E.agentReply, side: 1, y: 0.76, size: 78, turn: 5 },
  ];

  return <View style={styles.fill}>
    <StatusBar style="light" />
    <SkyBackdrop />
    <View style={[styles.words, { paddingTop: insets.top + 24 }]} accessibilityLiveRegion="polite">
      <Text maxFontSizeMultiplier={1.3} style={[styles.title, GLOW]}>Save from any app</Text>
      <View style={styles.lines}>
        <Animated.Text maxFontSizeMultiplier={1.4} style={[styles.line, GLOW, { opacity: lineX }]}>Tap Share, then FoundKeep.</Animated.Text>
        <Animated.Text maxFontSizeMultiplier={1.4} style={[styles.line, styles.lineOver, GLOW, { opacity: Animated.subtract(1, lineX) }]}>Not in the row? Tap More.</Animated.Text>
      </View>
    </View>

    {/* The sign-in screen's cards, floating at the window's edges. */}
    {cards.map((card, i) => <Drift key={i} index={i} style={{ position: 'absolute', width: card.size, height: card.size,
      left: card.side < 0 ? win.left - card.size * 0.58 : win.left + win.width - card.size * 0.42, top: win.top + win.height * card.y }} turn={card.turn}>
      <Image source={card.source} style={styles.img} accessible={false} />
    </Drift>)}

    <View style={[styles.window, win]} accessibilityLabel="A post and a reel being saved to FoundKeep from the share sheet" accessible>
      <View style={{ width: SCREEN.width, height: SCREEN.height, transform: [{ scale }], transformOrigin: 'top left' }}>
        {/* Scene one: the post. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: showX }]}>
          <XPost photo={FILM_PHOTOS.kyoto} />
          <Tap x={X_AT.share.x} y={X_AT.share.y} show={at([T.x.share, T.x.share + 450], [0, 1])} />
          <Sheet show={at([T.x.sheet[0], T.x.sheet[1], T.x.sheetOut[0], T.x.sheetOut[1]], [0, 1, 1, 0])}>
            <GlassSheet height={SHEET.height}>
              <ShareSheetHead photo={FILM_PHOTOS.kyoto} title="Two days in Kyoto" source="Post by Slow Travels" />
              <AppRow apps={[...X_ROW]} lift={at([T.x.lift[0], T.x.lift[1], T.x.lift[2]], [1, 1.12, 1])} />
              <FavouriteActions />
            </GlassSheet>
            <Tap x={SHEET.inset + sheetAppAt(2).x} y={sheetTop + sheetAppAt(2).y} show={at([T.x.tapApp, T.x.tapApp + 450], [0, 1])} />
          </Sheet>
          <Sheet show={at([T.x.save[0], T.x.save[1], T.x.saveOut[0], T.x.saveOut[1]], [0, 1, 1, 0])}>
            <SaveSheet photo={FILM_PHOTOS.kyoto} title="Two days in Kyoto. The best part was getting lost in Gion after dark." source="Post · Slow Travels" folder="Travel" tag="Kyoto" />
            <Tap x={8 + SAVE.save.x} y={SCREEN.height - 8 - SAVE.height + SAVE.save.y} show={at([T.x.tapSave, T.x.tapSave + 450], [0, 1])} />
          </Sheet>
        </Animated.View>

        {/* Scene two: the reel, and More. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, showX) }]}>
          <Reel photo={FILM_PHOTOS.ramen} zoom={[{ scale: at([T.swap[0], T.length], [1, 1.08]) }]} />
          <Tap x={REEL_AT.share.x} y={REEL_AT.share.y} show={at([T.reel.share, T.reel.share + 450], [0, 1])} />
          <Sheet show={at([T.reel.sheet[0], T.reel.sheet[1], T.reel.list[0], T.reel.list[1]], [0, 1, 1, 0])}>
            <GlassSheet height={SHEET.height}>
              <ShareSheetHead photo={FILM_PHOTOS.ramen} title="Ten-minute ramen" source="Reel by noodle.diaries" />
              <Animated.View style={{ transform: [{ translateX: at([T.reel.slide[0], T.reel.slide[1], T.back[0], T.back[1]], [0, -slide, -slide, 0]) }] }}><AppRow apps={[...REEL_ROW]} /></Animated.View>
              <FavouriteActions />
            </GlassSheet>
            <Tap x={SHEET.inset + sheetAppAt(4).x - slide} y={sheetTop + sheetAppAt(4).y} show={at([T.reel.tapMore, T.reel.tapMore + 450], [0, 1])} />
          </Sheet>
          <Sheet show={at([T.reel.list[0], T.reel.list[1], T.reel.listOut[0], T.reel.listOut[1]], [0, 1, 1, 0])}>
            <GlassSheet height={APPS_LIST.height} opaque><AppsList apps={['messages', 'mail', 'foundkeep', 'notes', 'reminders']} /></GlassSheet>
            <Tap x={150} y={listTop + APPS_LIST.rowTop + APPS_LIST.row * 2.5} show={at([T.reel.tapApp, T.reel.tapApp + 450], [0, 1])} />
          </Sheet>
          <Sheet show={at([T.reel.save[0], T.reel.save[1], T.reel.saveOut[0], T.reel.saveOut[1]], [0, 1, 1, 0])}>
            <SaveSheet photo={FILM_PHOTOS.ramen} title="Ten-minute ramen, one pot. Saving this one for tonight." source="Reel · noodle.diaries" folder="Recipes" tag="Quick" />
            <Tap x={8 + SAVE.save.x} y={SCREEN.height - 8 - SAVE.height + SAVE.save.y} show={at([T.reel.tapSave, T.reel.tapSave + 450], [0, 1])} />
          </Sheet>
        </Animated.View>
      </View>
    </View>

    {/* Your library: the last two saves land on top. */}
    <View style={[styles.library, { top: lib.y - 32 }]} pointerEvents="none">
      <Animated.View style={[styles.stack, { transform: [{ scale: at([T.x.land, T.x.land + 160, T.x.land + 420, T.reel.land, T.reel.land + 160, T.reel.land + 420], [1, 1.1, 1, 1, 1.1, 1]) }] }]}>
        <Image source={LIBRARY[0]} style={[styles.stackCard, { transform: [{ rotate: '-8deg' }, { translateX: -10 }] }]} accessible={false} />
        <Image source={LIBRARY[1]} style={[styles.stackCard, { transform: [{ rotate: '5deg' }, { translateX: 8 }] }]} accessible={false} />
        <Animated.Image source={FILM_PHOTOS.ramen} style={[styles.stackCard, { opacity: Animated.subtract(1, landed) }]} accessible={false} />
        <Animated.Image source={FILM_PHOTOS.kyoto} style={[styles.stackCard, { opacity: landed }]} accessible={false} />
      </Animated.View>
      <View style={styles.chip}><Text style={styles.chipText}>Your library</Text></View>
      <Animated.View style={[styles.saved, { opacity: at([T.x.land, T.x.land + 300, T.x.land + 1300, T.x.land + 1700, T.reel.land, T.reel.land + 300, T.reel.land + 1100, T.reel.land + 1400], [0, 1, 1, 0, 0, 1, 1, 0]) }]}>
        <Ionicons name="checkmark" size={13} color="#0d7a50" /><Text style={styles.savedText}>Saved</Text>
      </Animated.View>
    </View>

    {/* Each save, as a floating card from the save sheet into the library. */}
    {[{ photo: FILM_PHOTOS.kyoto, start: T.x.fly, end: T.x.land }, { photo: FILM_PHOTOS.ramen, start: T.reel.fly, end: T.reel.land }].map(({ photo, start, end }, i) => {
      const lift = start + 380, size = 92;
      return <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: -size / 2, top: -size / 2,
        opacity: at([start, start + 150, end - 120, end], [0, 1, 1, 0]),
        transform: [
          { translateX: at([start, lift, end], [from.x, from.x + (lib.x - from.x) * 0.3, lib.x]) },
          { translateY: at([start, lift, end], [from.y, from.y - 46, lib.y]) },
          { rotate: at([start, lift, end], [-8, 9, -3]).interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
          { scale: at([start, lift, end], [0.62, 1, 0.58]) },
        ] }}>
        <SavedCard photo={photo} size={size} />
      </Animated.View>;
    })}

    <View style={[styles.foot, { paddingBottom: insets.bottom + 18 }]}>
      <Pressable accessibilityRole="button" onPress={onDone} style={({ pressed }): StyleProp<ViewStyle> => [styles.button, pressed && styles.pressed]}>
        <Text maxFontSizeMultiplier={1.3} style={styles.buttonText}>Got it</Text>
      </Pressable>
    </View>
  </View>;
}

/** A sheet inside the window: rises in, slips away. */
function Sheet({ show, children }: { show: Animated.AnimatedInterpolation<number>; children: React.ReactNode }) {
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: show, transform: [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) }] }]}>{children}</Animated.View>;
}
/** A finger's tap: a soft ring that blooms and fades (in the window's units). */
function Tap({ x, y, show }: { x: number; y: number; show: Animated.AnimatedInterpolation<number> }) {
  return <Animated.View pointerEvents="none" style={[styles.tap, { left: x - 28, top: y - 28, opacity: show.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.65, 0] }), transform: [{ scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) }] }]} />;
}
/** A card that drifts on its own slow loop, never in step with the others. */
function Drift({ index, style, turn, children }: { index: number; style: ViewStyle; turn: number; children: React.ReactNode }) {
  const motion = useMotionAllowed();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 7800 + index * 1300, easing: Easing.linear, useNativeDriver: native }));
    loop.start(); return () => loop.stop();
  }, [motion, index, t]);
  const steps = Array.from({ length: 25 }, (_, i) => i / 24), offset = (index * 0.37) % 1;
  const wave = (amplitude: number, shift: number) => t.interpolate({ inputRange: steps, outputRange: steps.map(s => amplitude * Math.sin((s + offset + shift) * Math.PI * 2)) });
  return <Animated.View pointerEvents="none" style={[style, { transform: [{ translateY: wave(6, 0) }, { translateX: wave(3, 0.5) }, { rotate: wave(2, 0.25).interpolate({ inputRange: [-10, 10], outputRange: [`${turn - 10}deg`, `${turn + 10}deg`] }) }] }]}>{children}</Animated.View>;
}
/** A loop `length` ms long; at(times, values) eases between moments. Made at 0 — Animated.loop
 * resets to a value's first value each round — and held at `still` when motion is reduced. */
function useLoop(length: number, still: number) {
  const motion = useMotionAllowed();
  const clock = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { clock.setValue(still); return; }
    clock.setValue(0);
    const loop = Animated.loop(Animated.timing(clock, { toValue: length, duration: length, easing: Easing.linear, useNativeDriver: native }));
    loop.start(); return () => loop.stop();
  }, [motion, length, still, clock]);
  return (times: number[], values: number[]) => clock.interpolate({ inputRange: times, outputRange: values, extrapolate: 'clamp', easing: Easing.inOut(Easing.cubic) });
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', backgroundColor: '#1a78c8' },
  img: { width: '100%', height: '100%', resizeMode: 'contain' },
  words: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', paddingHorizontal: 28, gap: 6 },
  title: { fontFamily: SF, fontSize: 28, lineHeight: 33, fontWeight: '700', letterSpacing: -0.6, color: '#ffffff', textAlign: 'center' },
  lines: { alignSelf: 'stretch', alignItems: 'center' },
  line: { fontFamily: SF, fontSize: 16, lineHeight: 22, fontWeight: '500', color: '#ffffff', textAlign: 'center' },
  lineOver: { position: 'absolute', left: 0, right: 0 },
  window: { position: 'absolute', borderRadius: 30, overflow: 'hidden', backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', shadowColor: '#06203a', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 16 } },
  tap: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(120,120,128,0.35)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  library: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  stack: { width: 96, height: 64, alignItems: 'center', justifyContent: 'center' },
  stackCard: { position: 'absolute', width: 56, height: 56, borderRadius: 12, borderWidth: 2, borderColor: '#ffffff' },
  chip: { paddingHorizontal: 11, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: 'rgba(10,30,55,0.38)' },
  chipText: { fontFamily: SF, fontSize: 13, fontWeight: '600', color: '#ffffff' },
  saved: { position: 'absolute', top: -30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: '#ffffff' },
  savedText: { fontFamily: SF, fontSize: 13, fontWeight: '600', color: '#0d7a50' },
  foot: { position: 'absolute', left: 20, right: 20, bottom: 0 },
  button: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  buttonText: { fontFamily: SF, fontSize: 16, fontWeight: '600', color: '#1d1d1f' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
