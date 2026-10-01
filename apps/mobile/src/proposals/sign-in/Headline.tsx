// The first screen's words, locked 2026-10-01 (Pritam): "Keep Every" in SF Pro,
// the brand face, and the thing you keep in Caveat, tilted, changing through
// what you come across while browsing. Under it, one quiet line about the
// other half of FoundKeep: your agent can use it. Caveat: Google Fonts, SIL OFL
// (assets/fonts/OFL.txt).
import { useFonts } from 'expo-font';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';

const HAND = 'Caveat-Bold';
/** SF Pro: the system font on iOS; on the web, the same face through -apple-system (Inter or the system sans elsewhere). */
const SF = Platform.select({ web: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', default: undefined });

export function useHeadlineFont() {
  const [loaded, error] = useFonts({ [HAND]: require('../../../assets/fonts/Caveat-Bold.ttf') });
  // A font that fails to load falls back to the system face rather than blocking sign-in.
  return loaded || !!error;
}

const INK = { white: '#ffffff', butter: '#ffe066', peach: '#ffc3a3', mint: '#a9f1cf', ice: '#d8f1ff', lilac: '#dccfff', pink: '#ffc9e6' };
// What you come across while browsing: the posts people save, each in its own colour.
const WORDS = [{ word: 'Reel.', color: INK.peach }, { word: 'Short.', color: INK.butter }, { word: 'Article.', color: INK.mint }, { word: 'Tweet.', color: INK.ice }, { word: 'Post.', color: INK.lilac }, { word: 'Thread.', color: INK.pink }];
const LINE = 'All in one place,\nready for your agent.';

const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const native = Platform.OS !== 'web';
/** Over the photograph, a soft shadow keeps white words readable on bright patches of sky. */
const GLOW = { textShadowColor: 'rgba(3,20,40,.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 };
const rise = (v: Animated.Value, by = 18) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }] });

/** "Keep Every Reel." — the word changes every 2.6 s; reduced motion shows "Post." still. */
/** onWord: told each time the word changes, so the objects can answer it. */
export function KeepEveryHeadline({ start, motion, onWord }: { start: boolean; motion: boolean; onWord?: (word: string) => void }) {
  const entrance = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!start) return;
    if (!motion) { entrance.forEach(v => v.setValue(1)); return; }
    entrance.forEach(v => v.setValue(0));
    const run = Animated.parallel(entrance.map((v, i) => Animated.timing(v, { toValue: 1, delay: [380, 520, 760][i], duration: 1000, easing: SETTLE, useNativeDriver: native })));
    run.start(); return () => run.stop();
  }, [start, motion, entrance]);

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

  const current = motion ? WORDS[index] : { word: 'Post.', color: INK.lilac };
  useEffect(() => { if (start) onWord?.(current.word); }, [start, current.word, onWord]);
  const [lead, word, line] = entrance;
  return <View style={styles.center} accessibilityRole="header" accessibilityLabel="Keep every reel, short, article, tweet, post and thread. All in one place, ready for your agent.">
    <Animated.View style={rise(lead)}><Text maxFontSizeMultiplier={1.3} style={[styles.lead, GLOW]}>Keep Every</Text></Animated.View>
    <Animated.View style={[rise(word), styles.rotor]}>
      <Animated.View style={{ opacity: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }), transform: [{ rotate: '-4deg' }, { translateY: turn.interpolate({ inputRange: [0, 1, 2], outputRange: [22, 0, -18] }) }] }}>
        <Text maxFontSizeMultiplier={1.3} style={[styles.word, { color: current.color }, GLOW]}>{current.word}</Text>
      </Animated.View>
    </Animated.View>
    <Animated.View style={rise(line, 10)}><Text maxFontSizeMultiplier={1.4} style={[styles.line, GLOW]}>{LINE}</Text></Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  lead: { fontFamily: SF, fontWeight: '700', fontSize: 40, lineHeight: 46, letterSpacing: -1.2, color: INK.white, textAlign: 'center' },
  rotor: { justifyContent: 'center', minHeight: 74 },
  word: { fontFamily: HAND, fontSize: 70, lineHeight: 74, textAlign: 'center' },
  line: { fontSize: 16, lineHeight: 22, marginTop: 14, fontWeight: '500', color: INK.white, textAlign: 'center' },
});
