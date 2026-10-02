// The sign-in screen's words (Pritam, 2026-10-01): "Keep Every" in SF Pro,
// the brand face, and the thing you keep in Caveat, tilted, changing through
// what you come across while browsing. Under it, one quiet line about the
// other half of FoundKeep: your agent can use it. Caveat: Google Fonts, SIL OFL
// (assets/fonts/OFL.txt).
import { useFonts } from 'expo-font';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { AdaptiveText as Text } from '../components/AdaptiveText.tsx';

const HAND = 'Caveat-Bold';
/** SF Pro: the system font on iOS; on the web, the same face through -apple-system (Inter or the system sans elsewhere). */
const SF = Platform.select({ web: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', default: undefined });

export function useHeadlineFont() {
  const [loaded, error] = useFonts({ [HAND]: require('../../assets/fonts/Caveat-Bold.ttf') });
  // A font that fails to load falls back to the system face rather than blocking sign-in.
  return loaded || !!error;
}

const INK = { white: '#ffffff', butter: '#ffe066', peach: '#ffc3a3', mint: '#a9f1cf', ice: '#d8f1ff', lilac: '#dccfff', pink: '#ffc9e6' };
// What you come across while browsing: the posts people save, each in its own
// colour — pastel over the sky, deeper on a light page (still 3:1 at this size).
const WORDS = [
  { word: 'Reel.', sky: INK.peach, light: '#f0563a' }, { word: 'Short.', sky: INK.butter, light: '#c27c00' }, { word: 'Article.', sky: INK.mint, light: '#0d7a50' },
  { word: 'Tweet.', sky: INK.ice, light: '#2c6fdb' }, { word: 'Post.', sky: INK.lilac, light: '#7656f0' }, { word: 'Thread.', sky: INK.pink, light: '#d6408f' },
];
const TONE = { sky: { lead: INK.white, line: INK.white, glow: true }, light: { lead: '#1d1d1f', line: '#6e6e73', glow: false } };
const LINE = 'All in one place,\nready for your agent.';

const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const native = Platform.OS !== 'web';
/** Over the photograph, a soft shadow keeps white words readable on bright patches of sky. */
const GLOW = { textShadowColor: 'rgba(3,20,40,.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 };
const rise = (v: Animated.Value, by = 18) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }] });

/** "Keep Every Reel." — the word changes every 2.6 s; reduced motion shows "Post." still.
 * onWord: told each time the word changes, so the objects can answer it.
 * tone: white over the sky, or ink on a light page; align: centred, or set left.
 * settled: already in place (a screen continuing this one), the word still turning. */
export function KeepEveryHeadline({ start, motion, onWord, tone = 'sky', align = 'center', settled = false }: { start: boolean; motion: boolean; onWord?: (word: string) => void; tone?: 'sky' | 'light'; align?: 'center' | 'left'; settled?: boolean }) {
  const entrance = useRef([0, 1, 2].map(() => new Animated.Value(settled ? 1 : 0))).current;
  useEffect(() => {
    if (!start) return;
    if (!motion || settled) { entrance.forEach(v => v.setValue(1)); return; }
    entrance.forEach(v => v.setValue(0));
    const run = Animated.parallel(entrance.map((v, i) => Animated.timing(v, { toValue: 1, delay: [380, 520, 760][i], duration: 1000, easing: SETTLE, useNativeDriver: native })));
    run.start(); return () => run.stop();
  }, [start, motion, settled, entrance]);

  const [index, setIndex] = useState(0);
  const turn = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!start || !motion) return;
    let live = true;
    const timer = setInterval(() => {
      Animated.timing(turn, { toValue: 2, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() => {
        if (!live) return;
        setIndex(i => (i + 1) % WORDS.length); turn.setValue(0);
        Animated.timing(turn, { toValue: 1, duration: 620, easing: SETTLE, useNativeDriver: native }).start();
      });
    }, 2600);
    return () => { live = false; clearInterval(timer); };
  }, [start, motion, turn]);

  const current = motion ? WORDS[index] : WORDS[4];
  const ink = TONE[tone], glow = ink.glow ? GLOW : null, left = align === 'left';
  useEffect(() => { if (start) onWord?.(current.word); }, [start, current.word, onWord]);
  const [lead, word, line] = entrance;
  return <View style={left ? styles.left : styles.center} accessibilityRole="header" accessibilityLabel="Keep every reel, short, article, tweet, post and thread. All in one place, ready for your agent.">
    <Animated.View style={rise(lead)}><Text maxFontSizeMultiplier={1.3} style={[styles.lead, { color: ink.lead, textAlign: align }, glow]}>Keep Every</Text></Animated.View>
    <Animated.View style={[rise(word), styles.rotor, left && styles.rotorLeft]}>
      <Animated.View style={{ opacity: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }), transformOrigin: left ? 'left' : 'center', transform: [{ rotate: '-4deg' }, { translateY: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [22, 0, -18] }) }] }}>
        <Text maxFontSizeMultiplier={1.3} style={[styles.word, { color: current[tone], textAlign: align }, glow]}>{current.word}</Text>
      </Animated.View>
    </Animated.View>
    <Animated.View style={rise(line, 10)}><Text maxFontSizeMultiplier={1.4} style={[styles.line, { color: ink.line, textAlign: align }, glow]}>{LINE}</Text></Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  left: { alignItems: 'flex-start', alignSelf: 'stretch' },
  lead: { fontFamily: SF, fontWeight: '700', fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  rotor: { justifyContent: 'center', minHeight: 74 },
  rotorLeft: { alignSelf: 'stretch', alignItems: 'flex-start', paddingLeft: 4 },
  word: { fontFamily: HAND, fontSize: 70, lineHeight: 74 },
  line: { fontSize: 16, lineHeight: 22, marginTop: 14, fontWeight: '500' },
});
