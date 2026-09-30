// Proposal (sign-in, 2026-09-30): the words are the design. Four headline
// treatments for the first screen, each a display face with character and
// colour that means something in FoundKeep (a highlight, tags, the kinds of
// things you keep). The brand's own face is SF Pro, Apple's system font;
// these expressive faces are for moments like sign-in and onboarding.
// Fonts: Google Fonts, SIL OFL (assets/fonts/OFL.txt).
import { useFonts } from 'expo-font';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';

export type HeadlineType = 'highlighter' | 'tags' | 'rotating' | 'stack';
export const DISPLAY = { serif: 'InstrumentSerif', serifItalic: 'InstrumentSerif-Italic', grotesque: 'Bricolage-ExtraBold', hand: 'Caveat-Bold', mono: 'SpaceMono-Bold', dmSerif: 'DMSerifDisplay', dmSerifItalic: 'DMSerifDisplay-Italic' } as const;
/** SF Pro: the system font on iOS; on the web, the same face through -apple-system (Inter or the system sans elsewhere). */
export const SF = Platform.select({ web: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', default: undefined });

export function useDisplayFonts() {
  const [loaded, error] = useFonts({
    [DISPLAY.serif]: require('../../../assets/fonts/InstrumentSerif-Regular.ttf'),
    [DISPLAY.serifItalic]: require('../../../assets/fonts/InstrumentSerif-Italic.ttf'),
    [DISPLAY.grotesque]: require('../../../assets/fonts/BricolageGrotesque-ExtraBold.ttf'),
    [DISPLAY.hand]: require('../../../assets/fonts/Caveat-Bold.ttf'),
    [DISPLAY.mono]: require('../../../assets/fonts/SpaceMono-Bold.ttf'),
    [DISPLAY.dmSerif]: require('../../../assets/fonts/DMSerifDisplay-Regular.ttf'),
    [DISPLAY.dmSerifItalic]: require('../../../assets/fonts/DMSerifDisplay-Italic.ttf'),
  });
  // A font that fails to load falls back to the system face rather than blocking sign-in.
  return loaded || !!error;
}

/** Colours for words on a bright sky or meadow. */
export const INK = { white: '#ffffff', soft: 'rgba(255,255,255,.86)', butter: '#ffe066', peach: '#ffc3a3', mint: '#a9f1cf', ice: '#d8f1ff', lilac: '#dccfff', coral: '#ff5a4e', navy: '#0b2e4a', forest: '#073d29' };

const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const native = Platform.OS !== 'web';

/** One 0 → 1 value per piece, started together with their own delays once `start` is true. */
function useEntrance(delays: number[], start: boolean, motion: boolean, duration = 1000) {
  const values = useRef(delays.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!start) return;
    if (!motion) { values.forEach(v => v.setValue(1)); return; }
    values.forEach(v => v.setValue(0));
    const run = Animated.parallel(values.map((v, i) => Animated.timing(v, { toValue: 1, delay: delays[i], duration, easing: SETTLE, useNativeDriver: native })));
    run.start(); return () => run.stop();
  }, [start, motion]); // eslint-disable-line react-hooks/exhaustive-deps
  return values;
}
const rise = (v: Animated.Value, by = 18) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }] });
const slide = (v: Animated.Value, by = -22) => ({ opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }] });

type Props = { start: boolean; motion: boolean; sub: string; subColor: string; shadow?: boolean };
/** Over a photograph, a soft shadow keeps white words readable on bright patches of sky. */
const SHADOW = { textShadowColor: 'rgba(3,20,40,.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 };

/** A: an elegant serif, and "good things" swept with a highlighter, as you would in FoundKeep. */
export function HighlighterHeadline({ start, motion, sub, subColor }: Props) {
  const [l1, l2, l3, sweep, s] = useEntrance([380, 480, 580, 1150, 760], start, motion);
  return <View style={styles.left} accessibilityRole="header" accessibilityLabel="Keep the good things you find.">
    <Animated.View style={rise(l1)}><Text maxFontSizeMultiplier={1.3} style={[styles.serif, { color: INK.white }]}>Keep the</Text></Animated.View>
    <Animated.View style={[rise(l2), styles.row]}>
      <View>
        <Animated.View style={[styles.marker, { transform: [{ skewX: '-8deg' }, { scaleX: sweep }], transformOrigin: 'left' }]} />
        <Text maxFontSizeMultiplier={1.3} style={[styles.serifItalic, { color: INK.navy }]}> good things </Text>
      </View>
    </Animated.View>
    <Animated.View style={rise(l3)}><Text maxFontSizeMultiplier={1.3} style={[styles.serif, { color: INK.white }]}>you find.</Text></Animated.View>
    <Animated.View style={rise(s, 10)}><Text maxFontSizeMultiplier={1.4} style={[styles.subLeft, { color: subColor }]}>{sub}</Text></Animated.View>
  </View>;
}

/** B: a chunky grotesque; the verbs land as coloured tags — save it, tag it, find it again. */
export function TagsHeadline({ start, motion, sub, subColor }: Props) {
  const [l1, l2, l3, t1, t2, s] = useEntrance([360, 480, 600, 820, 960, 780], start, motion);
  const pill = (v: Animated.Value) => ({ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] });
  return <View style={styles.center} accessibilityRole="header" accessibilityLabel="Save it. Tag it. Find it again.">
    <Animated.View style={rise(l1)}><Text maxFontSizeMultiplier={1.3} style={[styles.grotesque, { color: INK.white }]}>Save it.</Text></Animated.View>
    <Animated.View style={[rise(l2), styles.row]}>
      <Animated.View style={[styles.tag, { backgroundColor: INK.coral }, pill(t1)]}><View style={styles.hole} /><Text maxFontSizeMultiplier={1.3} style={[styles.grotesque, { color: INK.white }]}>Tag</Text></Animated.View>
      <Text maxFontSizeMultiplier={1.3} style={[styles.grotesque, { color: INK.white }]}> it.</Text>
    </Animated.View>
    <Animated.View style={[rise(l3), styles.row]}>
      <Animated.View style={[styles.tag, { backgroundColor: INK.mint }, pill(t2)]}><Text maxFontSizeMultiplier={1.3} style={[styles.grotesque, { color: INK.forest }]}>Find</Text></Animated.View>
      <Text maxFontSizeMultiplier={1.3} style={[styles.grotesque, { color: INK.white }]}> it again.</Text>
    </Animated.View>
    <Animated.View style={rise(s, 10)}><Text maxFontSizeMultiplier={1.4} style={[styles.subCenter, { color: subColor }]}>{sub}</Text></Animated.View>
  </View>;
}

/** "Keep every" in SF Pro, and the thing you keep in a face (and a frame) of its own. */
export type KeepStyle = 'serif' | 'hand' | 'mono' | 'soft' | 'weight' | 'per-find';
type Face = TextStyle & { fontSize: number; lineHeight: number };
/** A changing word: its face, a frame around it (pill, marker), a tilt and, on a frame with a fill, its own ink. */
type Word = { face: Face; frame?: ViewStyle; tilt?: string; ink?: string };
const lead: Face = { fontFamily: SF, fontWeight: '700', fontSize: 40, lineHeight: 46, letterSpacing: -1.2 };
const WORD = {
  serif: { face: { fontFamily: DISPLAY.serifItalic, fontSize: 70, lineHeight: 74, letterSpacing: -1 } },
  hand: { face: { fontFamily: DISPLAY.hand, fontSize: 70, lineHeight: 74 }, tilt: '-4deg' },
  mono: { face: { fontFamily: DISPLAY.mono, fontSize: 40, lineHeight: 54, letterSpacing: -1.6 }, frame: { marginTop: 6, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,.5)', backgroundColor: 'rgba(255,255,255,.16)' } },
  heavy: { face: { fontFamily: SF, fontWeight: '800', fontSize: 54, lineHeight: 62, letterSpacing: -1.8 } },
  marker: { face: { fontFamily: SF, fontWeight: '800', fontSize: 52, lineHeight: 64, letterSpacing: -1.8 }, frame: { marginTop: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: INK.butter }, tilt: '-1.5deg', ink: INK.navy },
  dmItalic: { face: { fontFamily: DISPLAY.dmSerifItalic, fontSize: 62, lineHeight: 70, letterSpacing: -0.8 } },
} satisfies Record<string, Word>;
/** Pritam's pick (2026-09-30): 'hand', SF Pro + Caveat, tilted. */
export const KEEP_STYLES: Record<KeepStyle, { label: string; lead: Face; word: Word; per?: Record<string, Word> }> = {
  serif: { label: 'SF Pro + Instrument Serif italic', lead, word: WORD.serif },
  hand: { label: 'SF Pro + Caveat, tilted', lead, word: WORD.hand },
  mono: { label: 'SF Pro + Space Mono, in a field', lead, word: WORD.mono },
  soft: { label: 'Instrument Serif + SF Pro Heavy', lead: { fontFamily: DISPLAY.serifItalic, fontSize: 52, lineHeight: 56, letterSpacing: -0.6 }, word: WORD.heavy },
  weight: { label: 'SF Pro only: light over black', lead: { fontFamily: SF, fontWeight: '400', fontSize: 38, lineHeight: 44, letterSpacing: -0.9 }, word: { face: { fontFamily: SF, fontWeight: '900', fontSize: 52, lineHeight: 60, letterSpacing: -2 } } },
  'per-find': { label: 'A style for each find', lead, word: WORD.serif, per: { 'link.': WORD.mono, 'photo.': WORD.serif, 'highlight.': WORD.marker, 'voice memo.': { ...WORD.hand, face: { ...WORD.hand.face, fontSize: 62, lineHeight: 70 } }, 'idea.': WORD.dmItalic } },
};

/** Sizes and letter spacing Pritam tunes in Storybook Controls; unset values keep the style's own. */
export type Tune = { leadSize?: number; leadSpacing?: number; wordSize?: number; wordSpacing?: number; subSize?: number };
function tuned(style: (typeof KEEP_STYLES)[KeepStyle], t: Tune = {}) {
  const lead: Face = { ...style.lead, ...(t.leadSize ? { fontSize: t.leadSize, lineHeight: Math.round(t.leadSize * 1.15) } : null), ...(t.leadSpacing != null ? { letterSpacing: t.leadSpacing } : null) };
  // The word size is the base word's; per-find words keep their proportions to it.
  const scale = t.wordSize ? t.wordSize / style.word.face.fontSize : 1;
  const word = (w: Word): Word => ({ ...w, face: { ...w.face, fontSize: Math.round(w.face.fontSize * scale), lineHeight: Math.round(w.face.lineHeight * scale), ...(t.wordSpacing != null ? { letterSpacing: t.wordSpacing } : null) } });
  const sub = t.subSize ? { fontSize: t.subSize, lineHeight: Math.round(t.subSize * 1.45) } : null;
  return { lead, word: word(style.word), per: style.per && Object.fromEntries(Object.entries(style.per).map(([k, w]) => [k, word(w)])), sub };
}

const WORDS = [{ word: 'link.', color: INK.butter }, { word: 'photo.', color: INK.peach }, { word: 'highlight.', color: INK.mint }, { word: 'voice memo.', color: INK.ice }, { word: 'idea.', color: INK.lilac }];
/** C: "Keep every …" — the thing you keep keeps changing: link, photo, highlight… in its own colour. */
export function RotatingHeadline({ start, motion, sub, subColor, keep = 'serif', tune, shadow = false }: Props & { keep?: KeepStyle; tune?: Tune }) {
  const glow = shadow ? SHADOW : null;
  const style = tuned(KEEP_STYLES[keep], tune);
  const [l1, l2, s] = useEntrance([380, 520, 760], start, motion);
  const [index, setIndex] = useState(0);
  const turn = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!start || !motion) return;
    let live = true;
    const next = () => {
      Animated.timing(turn, { toValue: 2, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() => {
        if (!live) return;
        setIndex(i => (i + 1) % WORDS.length); turn.setValue(0);
        Animated.timing(turn, { toValue: 1, duration: 620, easing: SETTLE, useNativeDriver: native }).start();
      });
    };
    const timer = setInterval(next, 2600);
    return () => { live = false; clearInterval(timer); };
  }, [start, motion, turn]);
  const current = motion ? WORDS[index] : { word: 'find.', color: INK.butter };
  const word = style.per?.[current.word] ?? style.word;
  // The row keeps the height of its tallest word, so nothing below jumps as they change.
  const rowHeight = Math.max(...[style.word, ...Object.values(style.per ?? {})].map(w => w.face.lineHeight + (w.frame ? 12 : 0)));
  return <View style={styles.center} accessibilityRole="header" accessibilityLabel="Keep every link, photo, highlight, voice memo and idea.">
    <Animated.View style={rise(l1)}><Text maxFontSizeMultiplier={1.3} style={[style.lead, styles.centred, { color: INK.white }, glow]}>Keep Every</Text></Animated.View>
    <Animated.View style={[rise(l2), styles.rotor, { minHeight: rowHeight }]}>
      <Animated.View style={[word.frame, { opacity: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }), transform: [{ rotate: word.tilt ?? '0deg' }, { translateY: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [22, 0, -18] }) }] }]}>
        <Text maxFontSizeMultiplier={1.3} style={[word.face, styles.centred, { color: word.ink ?? current.color }, word.ink ? null : glow]}>{current.word}</Text>
      </Animated.View>
    </Animated.View>
    <Animated.View style={rise(s, 10)}><Text maxFontSizeMultiplier={1.4} style={[styles.subCenter, style.sub, { color: subColor }, glow]}>{sub}</Text></Animated.View>
  </View>;
}

/** D: three huge words in three colours, and the name set small in the serif. */
export function StackHeadline({ start, motion, sub, subColor }: Props) {
  const [w1, w2, w3, s] = useEntrance([380, 500, 620, 820], start, motion, 1100);
  return <View style={styles.left} accessibilityRole="header" accessibilityLabel="Found. Kept. Yours.">
    <Animated.View style={slide(w1)}><Text maxFontSizeMultiplier={1.2} style={[styles.stack, { color: INK.butter }]}>Found.</Text></Animated.View>
    <Animated.View style={slide(w2)}><Text maxFontSizeMultiplier={1.2} style={[styles.stack, { color: INK.white }]}>Kept.</Text></Animated.View>
    <Animated.View style={slide(w3)}><Text maxFontSizeMultiplier={1.2} style={[styles.stack, { color: INK.mint }]}>Yours.</Text></Animated.View>
    <Animated.View style={rise(s, 10)}><Text maxFontSizeMultiplier={1.4} style={[styles.subLeft, { color: subColor }]}>{sub}</Text></Animated.View>
  </View>;
}

/** The name, set in type (the mark is gone from this screen). */
export function Wordmark({ color, start, motion }: { color: string; start: boolean; motion: boolean }) {
  const [v] = useEntrance([150], start, motion, 900);
  return <Animated.View style={rise(v, 8)}><Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={[styles.wordmark, { color }]}>FoundKeep</Text></Animated.View>;
}

const styles = StyleSheet.create({
  left: { alignSelf: 'stretch', alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  serif: { fontFamily: DISPLAY.serif, fontSize: 54, lineHeight: 58, letterSpacing: -0.5 },
  serifItalic: { fontFamily: DISPLAY.serifItalic, fontSize: 54, lineHeight: 58, letterSpacing: -0.5 },
  marker: { position: 'absolute', left: 0, right: 0, top: 8, bottom: 4, backgroundColor: INK.butter, borderRadius: 6 },
  grotesque: { fontFamily: DISPLAY.grotesque, fontSize: 44, lineHeight: 54, letterSpacing: -1.2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingLeft: 14, paddingRight: 16, marginVertical: 3 },
  hole: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,.75)' },
  centred: { textAlign: 'center' },
  rotor: { justifyContent: 'center' },
  stack: { fontFamily: DISPLAY.grotesque, fontSize: 68, lineHeight: 70, letterSpacing: -2.4 },
  subLeft: { fontSize: 16, lineHeight: 23, marginTop: 14, maxWidth: 300 },
  subCenter: { fontSize: 16, lineHeight: 23, marginTop: 14, maxWidth: 300, textAlign: 'center' },
  wordmark: { fontFamily: DISPLAY.serifItalic, fontSize: 26, lineHeight: 30, letterSpacing: -0.2 },
});
