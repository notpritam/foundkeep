// Proposal (sign-in, 2026-09-30): the words are the design. Four headline
// treatments for the first screen, each a display face with character and
// colour that means something in FoundKeep (a highlight, tags, the kinds of
// things you keep). Fonts: Google Fonts, SIL OFL (assets/fonts/OFL.txt).
import { useFonts } from 'expo-font';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type TextStyle } from 'react-native';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';

export type HeadlineType = 'highlighter' | 'tags' | 'rotating' | 'stack';
export const DISPLAY = { serif: 'InstrumentSerif', serifItalic: 'InstrumentSerif-Italic', grotesque: 'Bricolage-ExtraBold', unbounded: 'Unbounded-Bold', syne: 'Syne-ExtraBold', jakarta: 'PlusJakartaSans-ExtraBold', hand: 'Caveat-Bold', dmSerif: 'DMSerifDisplay', dmSerifItalic: 'DMSerifDisplay-Italic' } as const;

export function useDisplayFonts() {
  const [loaded, error] = useFonts({
    [DISPLAY.serif]: require('../../../assets/fonts/InstrumentSerif-Regular.ttf'),
    [DISPLAY.serifItalic]: require('../../../assets/fonts/InstrumentSerif-Italic.ttf'),
    [DISPLAY.grotesque]: require('../../../assets/fonts/BricolageGrotesque-ExtraBold.ttf'),
    [DISPLAY.unbounded]: require('../../../assets/fonts/Unbounded-Bold.ttf'),
    [DISPLAY.syne]: require('../../../assets/fonts/Syne-ExtraBold.ttf'),
    [DISPLAY.jakarta]: require('../../../assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
    [DISPLAY.hand]: require('../../../assets/fonts/Caveat-Bold.ttf'),
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

/** Type pairings for the rotating headline: the lead words, then the changing word. */
export type RotatingFont = 'instrument' | 'bricolage' | 'unbounded' | 'syne' | 'jakarta' | 'dmserif';
type Face = { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing: number };
export const ROTATING_FONTS: Record<RotatingFont, { label: string; lead: Face; word: Face }> = {
  instrument: { label: 'Instrument Serif', lead: { fontFamily: DISPLAY.serif, fontSize: 52, lineHeight: 56, letterSpacing: -0.6 }, word: { fontFamily: DISPLAY.serifItalic, fontSize: 64, lineHeight: 70, letterSpacing: -0.8 } },
  bricolage: { label: 'Bricolage Grotesque', lead: { fontFamily: DISPLAY.grotesque, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 }, word: { fontFamily: DISPLAY.grotesque, fontSize: 50, lineHeight: 58, letterSpacing: -1.6 } },
  unbounded: { label: 'Unbounded', lead: { fontFamily: DISPLAY.unbounded, fontSize: 30, lineHeight: 38, letterSpacing: -0.6 }, word: { fontFamily: DISPLAY.unbounded, fontSize: 38, lineHeight: 48, letterSpacing: -1 } },
  syne: { label: 'Syne', lead: { fontFamily: DISPLAY.syne, fontSize: 40, lineHeight: 46, letterSpacing: -1 }, word: { fontFamily: DISPLAY.syne, fontSize: 50, lineHeight: 58, letterSpacing: -1.4 } },
  jakarta: { label: 'Plus Jakarta Sans + Caveat', lead: { fontFamily: DISPLAY.jakarta, fontSize: 38, lineHeight: 44, letterSpacing: -1.2 }, word: { fontFamily: DISPLAY.hand, fontSize: 62, lineHeight: 66, letterSpacing: 0 } },
  dmserif: { label: 'DM Serif Display', lead: { fontFamily: DISPLAY.dmSerif, fontSize: 44, lineHeight: 50, letterSpacing: -0.6 }, word: { fontFamily: DISPLAY.dmSerifItalic, fontSize: 54, lineHeight: 62, letterSpacing: -0.8 } },
};

/** A brand type candidate for the headline (the Storybook Type toolbar,
 * design-system/simulator/brand-type.ts); replaces the font's two faces. */
export type HeadlineFaces = { lead: TextStyle & { lineHeight: number }; word: TextStyle & { lineHeight: number } };

const WORDS = [{ word: 'link.', color: INK.butter }, { word: 'photo.', color: INK.peach }, { word: 'highlight.', color: INK.mint }, { word: 'voice memo.', color: INK.ice }, { word: 'idea.', color: INK.lilac }];
/** C: "Keep every …" — the thing you keep keeps changing: link, photo, highlight… in its own colour. */
export function RotatingHeadline({ start, motion, sub, subColor, font = 'instrument', faces, shadow = false }: Props & { font?: RotatingFont; faces?: HeadlineFaces }) {
  const glow = shadow ? SHADOW : null;
  const face = faces ?? ROTATING_FONTS[font];
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
  return <View style={styles.center} accessibilityRole="header" accessibilityLabel="Keep every link, photo, highlight, voice memo and idea.">
    <Animated.View style={rise(l1)}><Text maxFontSizeMultiplier={1.3} style={[face.lead, styles.centred, { color: INK.white }, glow]}>Keep every</Text></Animated.View>
    <Animated.View style={[rise(l2), styles.rotor, { minHeight: face.word.lineHeight }]}>
      <Animated.View style={{ opacity: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }), transform: [{ translateY: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [22, 0, -18] }) }] }}>
        <Text maxFontSizeMultiplier={1.3} style={[face.word, styles.centred, { color: current.color }, glow]}>{current.word}</Text>
      </Animated.View>
    </Animated.View>
    <Animated.View style={rise(s, 10)}><Text maxFontSizeMultiplier={1.4} style={[styles.subCenter, { color: subColor }, glow]}>{sub}</Text></Animated.View>
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
