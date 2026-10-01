// Proposal (2026-10-01): a second sign-in design after Pritam's reference — a
// light page with a window at the top that plays a film of FoundKeep at work
// (save from anywhere, it lands in one place, find it again, your agent uses
// it), then the locked headline and the two buttons. The first design, the
// floating cards over the sky, stays locked beside it until he picks.
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { OAUTH_NAMES } from '../../auth-oauth.ts';
import { useProviders } from './FirstScreen.tsx';
import { FilmView } from './FilmView.tsx';
import { KeepEveryHeadline, useHeadlineFont } from './Headline.tsx';

const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
// Google leads in black, Apple follows in grey, as in the reference.
const BUTTON = { google: { background: '#1d1d1f', ink: '#ffffff' }, other: { background: '#ececf0', ink: '#1d1d1f' } };

export function FilmScreen() {
  const fontReady = useHeadlineFont();
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const providers = useProviders();
  // The window is the film's own shape (360 × 400), as wide as the page allows.
  const windowW = Math.min(W - 32, 420), windowH = Math.round(windowW / 0.9);

  const v = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!motion) { v.forEach(value => value.setValue(1)); return; }
    v.forEach(value => value.setValue(0));
    const native = Platform.OS !== 'web';
    const run = Animated.parallel(v.map((value, i) => Animated.timing(value, { toValue: 1, delay: [60, 980, 1060][i], duration: [1100, 850, 850][i], easing: SETTLE, useNativeDriver: native })));
    run.start(); return () => run.stop();
  }, [motion, v]);
  const [film, ...buttons] = v;
  const rise = (value: Animated.Value, by = 20) => ({ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }] });

  return <View style={styles.fill}>
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.column, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 18 }]}>
      <Animated.View style={[styles.window, { width: windowW, height: windowH }, { opacity: film, transform: [{ scale: film.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
        <FilmView motion={motion} />
      </Animated.View>
      <View style={styles.words}><KeepEveryHeadline start={fontReady} motion={motion} tone="light" align="left" /></View>
      <View style={styles.actions}>
        {providers.map((provider, i) => {
          const tone = provider === 'google' ? BUTTON.google : BUTTON.other;
          return <Animated.View key={provider} style={rise(buttons[Math.min(i, 1)], 22)}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/oauth/complete', params: { provider, intent: 'sign-in' } })}
              style={({ pressed }): StyleProp<ViewStyle> => [styles.button, { backgroundColor: tone.background }, pressed ? styles.pressed : null]}>
              <Ionicons name={provider === 'apple' ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'globe-outline'} size={20} color={tone.ink} />
              <Text maxFontSizeMultiplier={1.3} style={[styles.buttonLabel, { color: tone.ink }]}>Continue with {OAUTH_NAMES[provider]}</Text>
            </Pressable>
          </Animated.View>;
        })}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fafafa' },
  column: { flexGrow: 1, alignItems: 'center' },
  window: { borderRadius: 30, overflow: 'hidden', backgroundColor: '#1a78c8' },
  words: { alignSelf: 'stretch', flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 18 },
  actions: { alignSelf: 'stretch', paddingHorizontal: 20, gap: 10 },
  button: { minHeight: 56, paddingHorizontal: 16, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
