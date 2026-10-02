// The sign-in screen (Pritam, 2026-10-01; version one of the design, chosen on
// X): floating cards — what you come across while browsing, and your agent —
// drift in around a centred headline over the Cumulus sky (blur 1) and keep
// drifting; the Google and Apple buttons rise last. Sign-in is Apple or Google
// only: no email anywhere. The second version (a film in a window,
// proposals/sign-in/FilmScreen.tsx) is kept for an A/B test. No email option and
// no terms line. Real sign-in: the same Apple/Google route as today.
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../components/motion.tsx';
import { useSession } from '../session/SessionProvider.tsx';
import { OAUTH_NAMES, type OAuthProvider } from '../auth-oauth.ts';
import { loadSignInProviders, type SignInProviders } from './providers.ts';
import { KeepEveryHeadline, useHeadlineFont } from './Headline.tsx';

const SKY = require('../../assets/images/sign-in-backgrounds/sky-cumulus-top-medium.webp');
const BLUR = 1;
/** A gentle shade where the words sit, clear again behind the buttons. */
const SHADE = 'linear-gradient(180deg, rgba(4,24,48,.18) 0%, rgba(4,24,48,.26) 42%, rgba(4,24,48,.12) 66%, rgba(255,255,255,0) 82%)';
const shade = (Platform.OS === 'web' ? { backgroundImage: SHADE } : { experimental_backgroundImage: SHADE }) as ViewStyle;
const BUTTON = { apple: { background: '#0b0c0d', ink: '#ffffff', border: '#0b0c0d' }, other: { background: '#ffffff', ink: '#202020', border: 'rgba(255,255,255,0)' } };

/** Depth: 0 far (smaller, slower, softer), 1 middle, 2 near (larger, livelier).
 * x and y are fractions of the screen; word: the headline word it stands for. */
export type Find = { source: ImageSourcePropType; x: number; y: number; size: number; rotate: number; depth: 0 | 1 | 2; delay: number; period: number; word?: string };
const E = {
  reel: require('../../assets/images/elements/reel.webp'), tweet: require('../../assets/images/elements/tweet.webp'),
  photoPost: require('../../assets/images/elements/photo-post.webp'), agentOrb: require('../../assets/images/elements/agent-orb.webp'),
  article: require('../../assets/images/elements/article.webp'), short: require('../../assets/images/elements/short.webp'),
  thread: require('../../assets/images/elements/thread.webp'), agentReply: require('../../assets/images/elements/agent-reply.webp'),
};
/** What you come across while browsing, and your agent, around the edges: the cards (assets/images/elements). */
export const FINDS: Find[] = [
  { source: E.reel, x: 0.06, y: 0.07, size: 88, rotate: -6, depth: 1, delay: 90, period: 9.2, word: 'Reel.' },
  { source: E.tweet, x: 0.66, y: 0.075, size: 108, rotate: 5, depth: 2, delay: 170, period: 10.6, word: 'Tweet.' },
  { source: E.photoPost, x: -0.02, y: 0.235, size: 96, rotate: -8, depth: 0, delay: 240, period: 8.4, word: 'Post.' },
  { source: E.agentOrb, x: 0.8, y: 0.235, size: 66, rotate: 0, depth: 0, delay: 300, period: 7.6 },
  { source: E.article, x: 0.02, y: 0.52, size: 94, rotate: -4, depth: 1, delay: 360, period: 9.8, word: 'Article.' },
  { source: E.short, x: 0.78, y: 0.51, size: 90, rotate: 6, depth: 1, delay: 410, period: 8.9, word: 'Short.' },
  { source: E.thread, x: 0.0, y: 0.65, size: 100, rotate: -5, depth: 2, delay: 470, period: 10.2, word: 'Thread.' },
  { source: E.agentReply, x: 0.76, y: 0.645, size: 90, rotate: 7, depth: 2, delay: 530, period: 8.1 },
];

// Motion: long, soft ease-outs (no springs), and a continuous drift.
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);          // expo out: fast start, long gentle landing
const DEPTH = [{ travel: 64, drift: 4, turn: 1.5, opacity: 0.94 }, { travel: 84, drift: 6, turn: 2, opacity: 1 }, { travel: 104, drift: 8, turn: 2.5, opacity: 1 }];
// A smooth loop (a sine wave) from a linear 0 → 1 phase.
const STEPS = Array.from({ length: 25 }, (_, i) => i / 24);
const wave = (amplitude: number, offset = 0) => ({ inputRange: STEPS, outputRange: STEPS.map(t => amplitude * Math.sin((t + offset) * Math.PI * 2)) });

/** How the objects keep moving once they have arrived (proposal, 2026-10-01).
 * drift: a small float and turn (today). orbit: a slow ellipse round their
 * place. bob: floating on water, up and down with a sway. rise: drifting
 * upwards like bubbles, fading out at the top and in again below. spotlight:
 * drift, and the object for the headline's word lifts forward as it shows. */
export type Movement = 'drift' | 'orbit' | 'bob' | 'rise' | 'spotlight';
type Depth = (typeof DEPTH)[number];
function moving(movement: Movement, d: Depth, phase: Animated.Value, offset: number) {
  if (movement === 'orbit') return { x: phase.interpolate(wave(d.drift * 2.4, offset + 0.25)), y: phase.interpolate(wave(d.drift * 1.5, offset)), turn: phase.interpolate(wave(d.turn, offset)), fade: null };
  if (movement === 'bob') return { x: phase.interpolate(wave(0, 0)), y: phase.interpolate(wave(d.drift * 2.2, offset)), turn: phase.interpolate(wave(d.turn * 2.6, offset + 0.15)), fade: null };
  if (movement === 'rise') {
    // Each object starts somewhere along its climb (t) and jumps back to the
    // bottom exactly when it has faded out at the top.
    const t = offset, top = 1 - t;
    const points: [number, number][] = [[0, t], ...[0.15, 0.85].filter(c => c > t).map((c): [number, number] => [c - t, c]), [top, 1], [top, 0], ...[0.15, 0.85].filter(c => c < t).map((c): [number, number] => [c + top, c]), [1, t]];
    const inputRange = points.map(p => p[0]);
    const fade = (c: number) => c < 0.15 ? c / 0.15 : c > 0.85 ? (1 - c) / 0.15 : 1;
    return { x: phase.interpolate(wave(d.drift * 0.8, offset)), y: phase.interpolate({ inputRange, outputRange: points.map(p => 30 - p[1] * 60) }), turn: phase.interpolate(wave(d.turn, offset)),
      fade: phase.interpolate({ inputRange, outputRange: points.map(p => fade(p[1])) }) };
  }
  return { x: phase.interpolate(wave(d.drift * 0.6, offset + 0.5)), y: phase.interpolate(wave(d.drift, offset)), turn: phase.interpolate(wave(d.turn, offset + 0.25)), fade: null };
}

/** The Cumulus sky (blur 1 unless asked), with a gentle shade where the words sit (shared by the sign-in versions). */
export function SkyBackdrop({ blur = BLUR }: { blur?: number }) {
  return <>
    {/* Larger than the screen by more than the blur reaches, so it never shows a soft edge. */}
    <Image source={SKY} blurRadius={blur} resizeMode="cover" accessible={false} style={[styles.backdrop, { top: -(blur * 3 + 8), left: -(blur * 3 + 8), right: -(blur * 3 + 8), bottom: -(blur * 3 + 8) }]} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, shade]} />
  </>;
}

/** The sign-in providers, loaded once; when they can't be, `failed` and a way to try again. */
export function useSignInProviders() {
  const { client } = useSession();
  const [state, setState] = useState<SignInProviders & { loading: boolean }>({ providers: [], failed: false, loading: true });
  const load = useCallback(() => {
    let live = true;
    // A retry keeps the message up ("Trying again…") rather than blinking it away.
    setState(value => ({ ...value, loading: true }));
    void loadSignInProviders(client).then(result => { if (live) setState({ ...result, loading: false }); });
    return () => { live = false; };
  }, [client]);
  useEffect(() => load(), [load]);
  return { ...state, retry: load };
}

/** The floating cards: they drift in to their places (already there when
 * settled, for a screen that continues this one) and keep drifting.
 * word: the headline's word, for spotlight. gather, 0 → 1 → 2: draws them from
 * their places into a slow ring round the middle, then closer in. */
export function FloatingFinds({ movement = 'drift', settled = false, word, gather }: { movement?: Movement; settled?: boolean; word?: string; gather?: Animated.Value }) {
  const finds = FINDS;
  const { width: W, height: H } = useWindowDimensions();
  const motion = useMotionAllowed();
  // Entrance values run 0 → 1 once; drift phases (and the ring) loop 0 → 1 for ever.
  const v = useRef({
    finds: finds.map(() => new Animated.Value(settled ? 1 : 0)),
    drift: finds.map(() => new Animated.Value(0)),
    focus: finds.map(() => new Animated.Value(0)),
    ring: new Animated.Value(0),
  }).current;

  // Spotlight: the object for the word on screen comes forward; the last one settles back.
  useEffect(() => {
    if (movement !== 'spotlight' || !motion) return;
    const run = Animated.parallel(v.focus.map((value, i) => Animated.timing(value, { toValue: finds[i].word === word ? 1 : 0, duration: 700, easing: SETTLE, useNativeDriver: Platform.OS !== 'web' })));
    run.start(); return () => run.stop();
  }, [word, movement, motion, v, finds]);

  useEffect(() => {
    if (!motion) {
      // Reduced motion (or not known yet): the cards in place, still.
      const settle = setTimeout(() => v.finds.forEach(value => value.setValue(1)), 120);
      return () => clearTimeout(settle);
    }
    // Continuing a screen: the cards are already in place, drifting.
    if (settled) v.finds.forEach(value => value.setValue(1));
    const native = Platform.OS !== 'web';
    const arrive = settled ? null : Animated.parallel(v.finds.map((value, i) => {
      value.setValue(0);
      return Animated.timing(value, { toValue: 1, delay: finds[i].delay, duration: 1500 + finds[i].depth * 120, easing: SETTLE, useNativeDriver: native });
    }));
    // The drift starts with the entrance, so nothing ever stops and restarts;
    // each object has its own period, so they never move in step.
    const loops = [...v.drift.map((value, i) => {
      value.setValue(0);
      return Animated.loop(Animated.timing(value, { toValue: 1, duration: finds[i].period * (movement === 'rise' ? 1800 : 1000), easing: Easing.linear, useNativeDriver: native }));
    }), Animated.loop(Animated.timing(v.ring, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: native }))];
    arrive?.start(); loops.forEach(loop => loop.start());
    return () => { arrive?.stop(); loops.forEach(loop => loop.stop()); };
  }, [motion, settled, v, finds, movement]);

  const cx = W / 2, cy = H * 0.42, radius = Math.min(W * 0.38, 156);
  const toMiddle = gather?.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const inRing = gather?.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0.82], extrapolate: 'clamp' });
  const shrink = gather?.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 0.64, 0.54], extrapolate: 'clamp' });
  return <>{finds.map((find, i) => {
    const d = DEPTH[find.depth], entry = v.finds[i], phase = v.drift[i], offset = (i * 0.37) % 1;
    // Each object drifts in towards its place from beyond it, turning as it settles.
    const px = find.x * W + find.size / 2, py = find.y * H + find.size / 2, len = Math.hypot(px - cx, py - cy) || 1;
    const fromX = ((px - cx) / len) * d.travel, fromY = ((py - cy) / len) * d.travel;
    const move = moving(movement === 'spotlight' ? 'drift' : movement, d, phase, offset);
    // Gathered: each takes its own place round the ring (a slow, shared turn), from wherever it is.
    const at = i / finds.length;
    const ringX = toMiddle && inRing ? Animated.add(Animated.multiply(toMiddle, cx - px), Animated.multiply(inRing, v.ring.interpolate(wave(radius, at + 0.25)))) : 0;
    const ringY = toMiddle && inRing ? Animated.add(Animated.multiply(toMiddle, cy - py), Animated.multiply(inRing, v.ring.interpolate(wave(radius * 0.94, at)))) : 0;
    const turn = Animated.add(entry.interpolate({ inputRange: [0, 1], outputRange: [find.rotate + (fromX > 0 ? 10 : -10), find.rotate] }), move.turn);
    const shown = entry.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, d.opacity, d.opacity] });
    const scale = Animated.multiply(entry.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }), v.focus[i].interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }));
    return <Animated.View key={i} pointerEvents="none" style={[styles.find, { left: find.x * W, top: find.y * H, width: find.size, height: find.size,
      opacity: move.fade ? Animated.multiply(shown, move.fade) : shown,
      transform: [
        { translateX: Animated.add(Animated.add(entry.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }), move.x), ringX) },
        { translateY: Animated.add(Animated.add(entry.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }), move.y), ringY) },
        { translateY: v.focus[i].interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
        { scale: shrink ? Animated.multiply(scale, shrink) : scale },
        { rotate: turn.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
      ] }]}>
      <Image source={find.source} style={styles.img} accessible={false} />
    </Animated.View>;
  })}</>;
}

/** A sign-in button: white for Google, black for Apple. */
export function ProviderButton({ provider, onPress }: { provider: OAuthProvider; onPress: () => void }) {
  const tone = provider === 'apple' ? BUTTON.apple : BUTTON.other;
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }): StyleProp<ViewStyle> => [styles.button, { backgroundColor: tone.background, borderColor: tone.border }, pressed ? styles.pressed : null]}>
    <Ionicons name={provider === 'apple' ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'globe-outline'} size={20} color={tone.ink} />
    <Text maxFontSizeMultiplier={1.3} style={[styles.buttonLabel, { color: tone.ink }]}>Continue with {OAUTH_NAMES[provider]}</Text>
  </Pressable>;
}

/** movement: how the cards keep moving — drift is the chosen one; the others stay for comparison.
 * settled: everything already in place (a screen continuing this one); actions: in place of the buttons. */
export function FirstScreen({ movement = 'drift', settled = false, actions }: { movement?: Movement; settled?: boolean; actions?: ReactNode }) {
  const fontReady = useHeadlineFont();
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const { providers, failed, loading, retry } = useSignInProviders();
  const buttons = useRef([0, 1].map(() => new Animated.Value(settled ? 1 : 0))).current;
  const [word, setWord] = useState<string>();
  const onWord = useCallback((next: string) => setWord(next), []);

  useEffect(() => {
    if (!motion || settled) {
      const settle = setTimeout(() => buttons.forEach(value => value.setValue(1)), settled ? 0 : 120);
      return () => clearTimeout(settle);
    }
    buttons.forEach(value => value.setValue(0));
    const run = Animated.parallel(buttons.map((value, i) => Animated.timing(value, { toValue: 1, delay: 980 + i * 80, duration: 850, easing: SETTLE, useNativeDriver: Platform.OS !== 'web' })));
    run.start(); return () => run.stop();
  }, [motion, settled, buttons]);

  const rise = (value: Animated.Value, by = 20) => ({ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }] });

  return <View style={styles.fill}>
    <StatusBar style="light" />
    <SkyBackdrop />
    <FloatingFinds movement={movement} settled={settled} word={word} />

    {/* The words and buttons form a column: the headline centres in the space
        above the buttons; when large text needs more room than the screen has,
        the column scrolls instead of running under the buttons. */}
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.column, { paddingTop: insets.top + 12 }]}>
      <View style={styles.center}><KeepEveryHeadline start={fontReady} motion={motion} onWord={onWord} settled={settled} /></View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 18 }]}>
        {actions ?? <>
          {/* Apple or Google is the only way in: if neither can be reached, say so and offer to try again. */}
          {failed ? <Animated.View style={[styles.unavailable, rise(buttons[0], 22)]} accessibilityLiveRegion="polite">
            <Text maxFontSizeMultiplier={1.3} style={styles.unavailableText}>Can't reach Apple or Google sign-in right now.</Text>
            <Pressable accessibilityRole="button" disabled={loading} onPress={retry} style={({ pressed }): StyleProp<ViewStyle> => [styles.button, { backgroundColor: BUTTON.apple.background, borderColor: BUTTON.apple.border }, pressed ? styles.pressed : null]}>
              <Text maxFontSizeMultiplier={1.3} style={[styles.buttonLabel, { color: BUTTON.apple.ink }]}>{loading ? 'Trying again…' : 'Try again'}</Text>
            </Pressable>
          </Animated.View> : null}
          {providers.map((provider, i) => <Animated.View key={provider} style={rise(buttons[Math.min(i, 1)], 22)}>
            <ProviderButton provider={provider} onPress={() => router.push({ pathname: '/oauth/complete', params: { provider, intent: 'sign-in' } })} />
          </Animated.View>)}
        </>}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', backgroundColor: '#1a78c8' },
  backdrop: { position: 'absolute' },
  find: { position: 'absolute' },
  img: { width: '100%', height: '100%', resizeMode: 'contain' },
  column: { flexGrow: 1 },
  // The words sit a little above the middle, clear of the objects beside them.
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 16, paddingBottom: 84 },
  actions: { paddingHorizontal: 20, gap: 10 },
  button: { minHeight: 56, paddingHorizontal: 16, borderRadius: 28, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  unavailable: { gap: 12, padding: 18, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.94)' },
  unavailableText: { fontSize: 15, lineHeight: 21, color: '#233E4B', textAlign: 'center' },
});
