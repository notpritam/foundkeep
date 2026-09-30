// Proposal (sign-in, 2026-09-30): the app's first screen, after Pritam's
// reference. FoundKeep's own 3D objects (design-system/assets-3d) drift in
// around a centred headline and keep drifting; the sign-in buttons rise last.
// Real sign-in: the same Apple/Google route as today. Only the two buttons at
// the bottom: no email option and no terms line (Pritam, 2026-09-30).
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { useAppearance } from '../../appearance/AppearanceProvider.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { isOAuthProvider, OAUTH_NAMES, type OAuthProvider } from '../../auth-oauth.ts';
import { gradient, look as lookFor, type LookName } from './looks.ts';
import { HighlighterHeadline, RotatingHeadline, StackHeadline, TagsHeadline, useDisplayFonts, Wordmark, type HeadlineType, type RotatingFont } from './Headlines.tsx';

/** Depth: 0 far (smaller, slower, softer), 1 middle, 2 near (larger, livelier). */
type Find = { source: ImageSourcePropType; x: number; y: number; size: number; rotate: number; depth: 0 | 1 | 2; delay: number; period: number };
/** What FoundKeep keeps, around the edges; x and y are fractions of the screen. */
/** Around a centred headline. */
const AROUND: Find[] = [
  { source: require('../../../assets/images/finds/photo.webp'), x: 0.05, y: 0.075, size: 84, rotate: -6, depth: 1, delay: 90, period: 9.2 },
  { source: require('../../../assets/images/finds/post.webp'), x: 0.68, y: 0.07, size: 104, rotate: 5, depth: 2, delay: 170, period: 10.6 },
  { source: require('../../../assets/images/finds/voice.webp'), x: -0.03, y: 0.235, size: 96, rotate: -8, depth: 0, delay: 240, period: 8.4 },
  { source: require('../../../assets/images/finds/sparkles.webp'), x: 0.8, y: 0.235, size: 62, rotate: 8, depth: 0, delay: 300, period: 7.6 },
  { source: require('../../../assets/images/finds/highlight.webp'), x: 0.01, y: 0.53, size: 92, rotate: -4, depth: 1, delay: 360, period: 9.8 },
  { source: require('../../../assets/images/finds/folder.webp'), x: 0.8, y: 0.52, size: 82, rotate: 6, depth: 1, delay: 410, period: 8.9 },
  { source: require('../../../assets/images/finds/video.webp'), x: 0.0, y: 0.655, size: 100, rotate: -5, depth: 2, delay: 470, period: 10.2 },
  { source: require('../../../assets/images/finds/tag.webp'), x: 0.78, y: 0.645, size: 84, rotate: 9, depth: 2, delay: 530, period: 8.1 },
];
/** Above and beside a headline set low on the left. */
const ABOVE: Find[] = [
  { source: require('../../../assets/images/finds/photo.webp'), x: 0.05, y: 0.15, size: 84, rotate: -7, depth: 1, delay: 90, period: 9.2 },
  { source: require('../../../assets/images/finds/post.webp'), x: 0.56, y: 0.075, size: 112, rotate: 5, depth: 2, delay: 170, period: 10.6 },
  { source: require('../../../assets/images/finds/voice.webp'), x: 0.32, y: 0.26, size: 88, rotate: -6, depth: 0, delay: 240, period: 8.4 },
  { source: require('../../../assets/images/finds/sparkles.webp'), x: 0.82, y: 0.24, size: 56, rotate: 8, depth: 0, delay: 300, period: 7.6 },
  { source: require('../../../assets/images/finds/highlight.webp'), x: 0.0, y: 0.33, size: 90, rotate: -4, depth: 1, delay: 360, period: 9.8 },
  { source: require('../../../assets/images/finds/folder.webp'), x: 0.66, y: 0.36, size: 86, rotate: 6, depth: 2, delay: 410, period: 8.9 },
  { source: require('../../../assets/images/finds/tag.webp'), x: 0.8, y: 0.52, size: 70, rotate: 9, depth: 1, delay: 470, period: 8.1 },
];
const LAYOUT: Record<HeadlineType, 'centre' | 'left'> = { highlighter: 'left', tags: 'centre', rotating: 'centre', stack: 'left' };
const SUB: Record<HeadlineType, string> = {
  highlighter: 'Pages, posts, photos and notes, kept in one private place.',
  tags: 'Everything you find, organised for you.',
  rotating: 'One private place for everything you find.',
  stack: 'A private library for everything you find.',
};

// Motion: long, soft ease-outs (no springs), and a continuous drift.
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);          // expo out: fast start, long gentle landing
const DEPTH = [{ travel: 64, drift: 4, turn: 1.5, opacity: 0.94 }, { travel: 84, drift: 6, turn: 2, opacity: 1 }, { travel: 104, drift: 8, turn: 2.5, opacity: 1 }];
// A smooth loop (a sine wave) from a linear 0 → 1 phase.
const STEPS = Array.from({ length: 25 }, (_, i) => i / 24);
const wave = (amplitude: number, offset = 0) => ({ inputRange: STEPS, outputRange: STEPS.map(t => amplitude * Math.sin((t + offset) * Math.PI * 2)) });

function useProviders(): OAuthProvider[] {
  const { client } = useSession();
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  useEffect(() => {
    let live = true;
    void client.oauthProviders().then(value => { if (live && Array.isArray(value.providers)) setProviders(value.providers.filter(isOAuthProvider)); }).catch(() => {});
    return () => { live = false; };
  }, [client]);
  // Google first, then Apple, as in the reference; any others after.
  return [...providers].sort((a, b) => ['google', 'apple'].indexOf(a) - ['google', 'apple'].indexOf(b));
}

/** backdrop: a sky photograph shown behind everything with a very slight blur; without one, the look's gradient. */
export function FirstScreen({ look: lookName, type = 'rotating', font, backdrop, blur = 2, objects = true }: { look: LookName; type?: HeadlineType; font?: RotatingFont; backdrop?: ImageSourcePropType; blur?: number; objects?: boolean }) {
  const layout = LAYOUT[type], FINDS = layout === 'left' ? ABOVE : AROUND;
  const fontsReady = useDisplayFonts();
  const { scheme } = useAppearance();
  const look = useMemo(() => lookFor(lookName, scheme), [lookName, scheme]);
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const providers = useProviders();

  // Entrance values run 0 → 1 once; drift phases loop 0 → 1 for ever.
  const v = useRef({
    finds: AROUND.map(() => new Animated.Value(0)),
    buttons: [0, 1].map(() => new Animated.Value(0)),
    drift: AROUND.map(() => new Animated.Value(0)),
  }).current;

  useEffect(() => {
    const entrance = [...v.finds, ...v.buttons];
    if (!motion) {
      // Reduced motion (or not known yet): the finished screen, still.
      const settle = setTimeout(() => entrance.forEach(value => value.setValue(1)), 120);
      return () => clearTimeout(settle);
    }
    entrance.forEach(value => value.setValue(0));
    const native = Platform.OS !== 'web';
    const to = (value: Animated.Value, delay: number, duration: number, easing = SETTLE) => Animated.timing(value, { toValue: 1, delay, duration, easing, useNativeDriver: native });
    const run = Animated.parallel([
      ...v.finds.map((value, i) => to(value, (FINDS[i] ?? FINDS[0]).delay, 1500 + (FINDS[i] ?? FINDS[0]).depth * 120)),
      ...v.buttons.map((value, i) => to(value, 980 + i * 80, 850)),
    ]);
    // The drift starts with the entrance, so nothing ever stops and restarts;
    // each object has its own period, so they never move in step.
    const drift = v.drift.map((value, i) => {
      value.setValue(0);
      const period = (FINDS[i]?.period ?? 9.5) * 1000;
      return Animated.loop(Animated.timing(value, { toValue: 1, duration: period, easing: Easing.linear, useNativeDriver: native }));
    });
    run.start(); drift.forEach(loop => loop.start());
    return () => { run.stop(); drift.forEach(loop => loop.stop()); };
  }, [motion, v, FINDS]);

  const rise = (value: Animated.Value, by = 20) => ({ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }] });
  const cx = W / 2, cy = H * 0.42;

  return <View style={[styles.fill, gradient(look.background)]}>
    {backdrop ? <>
      {/* Larger than the screen by more than the blur reaches, so it never shows a soft edge. */}
      <Image source={backdrop} blurRadius={blur} resizeMode="cover" accessible={false} style={[styles.backdrop, { top: -(blur * 3 + 8), left: -(blur * 3 + 8), right: -(blur * 3 + 8), bottom: -(blur * 3 + 8) }]} />
      {/* A gentle shade where the words sit, clear again behind the buttons. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, gradient('linear-gradient(180deg, rgba(4,24,48,.18) 0%, rgba(4,24,48,.26) 42%, rgba(4,24,48,.12) 66%, rgba(255,255,255,0) 82%)')]} />
    </> : look.haze.map((h, i) => <View key={i} pointerEvents="none" style={[styles.haze, { left: h.x * W, top: h.y * H, width: h.w * W, height: h.h * H }, gradient(`radial-gradient(closest-side, ${h.color}, transparent)`)]} />)}

    {objects ? FINDS.map((find, i) => {
      const d = DEPTH[find.depth], entry = v.finds[i], phase = v.drift[i], offset = (i * 0.37) % 1;
      // Each object drifts in towards its place from beyond it, turning as it settles.
      const px = find.x * W + find.size / 2, py = find.y * H + find.size / 2, len = Math.hypot(px - cx, py - cy) || 1;
      const fromX = ((px - cx) / len) * d.travel, fromY = ((py - cy) / len) * d.travel;
      const turn = Animated.add(entry.interpolate({ inputRange: [0, 1], outputRange: [find.rotate + (fromX > 0 ? 10 : -10), find.rotate] }), phase.interpolate(wave(d.turn, offset + 0.25)));
      return <Animated.View key={i} pointerEvents="none" style={[styles.find, { left: find.x * W, top: find.y * H, width: find.size, height: find.size,
        opacity: entry.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, d.opacity, d.opacity] }),
        transform: [
          { translateX: Animated.add(entry.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }), phase.interpolate(wave(d.drift * 0.6, offset + 0.5))) },
          { translateY: Animated.add(entry.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }), phase.interpolate(wave(d.drift, offset))) },
          { scale: entry.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
          { rotate: turn.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
        ] }]}>
        <Image source={find.source} style={styles.img} accessible={false} />
      </Animated.View>;
    }) : null}

    {/* The words and buttons form a column: the headline centres (or sits low) in
        the space above the buttons; when large text needs more room than the
        screen has, the column scrolls instead of running under the buttons. */}
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.column, { paddingTop: insets.top + 12 }]}>
      <View style={[styles.center, layout === 'left' ? styles.low : styles.lifted]}>
        {/* Left layouts: the name at the top, the words low; they stack rather than overlap. */}
        {layout === 'left' ? <><View style={styles.wordmark}><Wordmark color={look.ink} start motion={motion} /></View><View style={styles.spacer} /></> : null}
        {type === 'highlighter' ? <HighlighterHeadline start={fontsReady} motion={motion} sub={SUB[type]} subColor={look.ink} />
          : type === 'tags' ? <TagsHeadline start={fontsReady} motion={motion} sub={SUB[type]} subColor={look.ink} />
          : type === 'stack' ? <StackHeadline start={fontsReady} motion={motion} sub={SUB[type]} subColor={look.ink} />
          : <RotatingHeadline start={fontsReady} motion={motion} sub={SUB[type]} subColor={look.ink} font={font} shadow={!!backdrop} />}
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 18 }]}>
        {providers.map((provider, i) => {
          const tone = provider === 'apple' ? look.primary : look.secondary;
          return <Animated.View key={provider} style={rise(v.buttons[Math.min(i, 1)], 22)}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/oauth/complete', params: { provider, intent: 'sign-in' } })}
              style={({ pressed }): StyleProp<ViewStyle> => [styles.button, { backgroundColor: tone.background, borderColor: tone.border }, pressed ? styles.pressed : null]}>
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
  fill: { flex: 1, overflow: 'hidden' },
  haze: { position: 'absolute' },
  backdrop: { position: 'absolute' },
  find: { position: 'absolute' },
  img: { width: '100%', height: '100%', resizeMode: 'contain' },
  column: { flexGrow: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 16, gap: 22 },
  low: { justifyContent: 'flex-start', alignItems: 'stretch', paddingBottom: 28, paddingTop: 4 },
  // Centred words sit a little above the middle, clear of the objects beside them.
  lifted: { paddingBottom: 84 },
  wordmark: { alignSelf: 'flex-start' },
  spacer: { flexGrow: 1, minHeight: 24 },
  actions: { paddingHorizontal: 20, gap: 10 },
  button: { minHeight: 56, paddingHorizontal: 16, borderRadius: 28, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
