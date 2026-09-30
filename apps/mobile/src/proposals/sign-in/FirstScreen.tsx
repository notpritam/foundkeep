// Proposal (sign-in, 2026-09-30): the app's first screen, after Pritam's
// reference (a sky of 3D objects flying in around a centred headline, the
// sign-in buttons rising last). Real sign-in: the same Apple/Google route and
// email sign-in as today. Three looks: sky, meadow, paper (looks.ts).
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
import { EmailSheet } from './EmailSheet.tsx';
import { gradient, look as lookFor, type LookName } from './looks.ts';

type Find = { source: ImageSourcePropType; x: number; y: number; size: number; rotate: number; from: [number, number]; float: number };
/** Things people keep, around the edges; x and y are fractions of the screen. */
const FINDS: Find[] = [
  { source: require('../../../assets/images/finds/camera.png'), x: 0.04, y: 0.085, size: 88, rotate: -12, from: [-1, -1], float: 3.4 },
  { source: require('../../../assets/images/finds/airplane.png'), x: 0.72, y: 0.07, size: 104, rotate: 8, from: [1, -1], float: 4.1 },
  { source: require('../../../assets/images/finds/admission_tickets.png'), x: -0.07, y: 0.22, size: 96, rotate: -18, from: [-1, 0], float: 3.8 },
  { source: require('../../../assets/images/finds/steaming_bowl.png'), x: 0.76, y: 0.2, size: 90, rotate: 6, from: [1, 0], float: 3.1 },
  { source: require('../../../assets/images/finds/light_bulb.png'), x: 0.06, y: 0.5, size: 60, rotate: -8, from: [-1, 0], float: 4.4 },
  { source: require('../../../assets/images/finds/books.png'), x: 0.8, y: 0.49, size: 72, rotate: 10, from: [1, 0], float: 3.6 },
  { source: require('../../../assets/images/finds/headphone.png'), x: -0.07, y: 0.62, size: 92, rotate: -14, from: [-1, 1], float: 3.9 },
  { source: require('../../../assets/images/finds/hot_beverage.png'), x: 0.81, y: 0.61, size: 80, rotate: 12, from: [1, 1], float: 3.3 },
];
const BOOKMARK = require('../../../assets/images/finds/bookmark.png');
const MARK = require('../../../assets/images/mark.png');
const LINES = ['Meet FoundKeep,', 'a place for the things', 'worth keeping.'];

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

export function FirstScreen({ look: lookName, emailOpen: startOpen = false }: { look: LookName; emailOpen?: boolean }) {
  const { scheme } = useAppearance();
  const look = useMemo(() => lookFor(lookName, scheme), [lookName, scheme]);
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const providers = useProviders();
  const [emailOpen, setEmailOpen] = useState(startOpen);

  // One value per moment of the entrance, 0 → 1.
  const values = useRef({ emblem: new Animated.Value(0), finds: FINDS.map(() => new Animated.Value(0)), lines: LINES.map(() => new Animated.Value(0)), bookmark: new Animated.Value(0), buttons: [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)], float: FINDS.map(() => new Animated.Value(0)) }).current;
  useEffect(() => {
    const all = [values.emblem, ...values.finds, ...values.lines, values.bookmark, ...values.buttons];
    if (!motion) {
      // Reduced motion (or not known yet): the finished screen, without movement.
      const settle = setTimeout(() => all.forEach(v => v.setValue(1)), 120);
      return () => clearTimeout(settle);
    }
    all.forEach(v => v.setValue(0));
    const native = Platform.OS !== 'web';
    const spring = (value: Animated.Value, delay: number, bounciness = 9) => Animated.sequence([Animated.delay(delay), Animated.spring(value, { toValue: 1, bounciness, speed: 11, useNativeDriver: native })]);
    const fade = (value: Animated.Value, delay: number, duration = 420) => Animated.timing(value, { toValue: 1, delay, duration, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    const entrance = Animated.parallel([
      fade(values.emblem, 0, 500),
      ...values.finds.map((value, i) => spring(value, 140 + i * 55)),
      ...values.lines.map((value, i) => fade(value, 320 + i * 120)),
      spring(values.bookmark, 760, 12),
      ...values.buttons.map((value, i) => fade(value, 900 + i * 130, 380)),
    ]);
    const floats = values.float.map((value, i) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: FINDS[i].float * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(value, { toValue: 0, duration: FINDS[i].float * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ])));
    entrance.start(({ finished }) => { if (finished) floats.forEach(f => f.start()); });
    return () => { entrance.stop(); floats.forEach(f => f.stop()); };
  }, [motion, values]);

  const rise = (v: Animated.Value, by = 16) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [by, 0] }) }] });
  const primaryIsApple = (p: OAuthProvider) => p === 'apple';

  return <View style={[styles.fill, gradient(look.background)]}>
    {look.haze.map((h, i) => <View key={i} pointerEvents="none" style={[styles.haze, { left: h.x * W, top: h.y * H, width: h.w * W, height: h.h * H }, gradient(`radial-gradient(closest-side, ${h.color}, transparent)`)]} />)}

    {FINDS.map((find, i) => {
      const v = values.finds[i];
      const bob = values.float[i].interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
      return <Animated.View key={i} pointerEvents="none" style={[styles.find, { left: find.x * W, top: find.y * H, width: find.size, height: find.size, opacity: v,
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [find.from[0] * 120, 0] }) },
          { translateY: Animated.add(v.interpolate({ inputRange: [0, 1], outputRange: [find.from[1] * 120, 0] }), bob) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${find.rotate - 30}deg`, `${find.rotate}deg`] }) },
        ] }]}>
        <Image source={find.source} style={styles.img} accessible={false} />
      </Animated.View>;
    })}

    {/* The words and buttons form a column: the emblem and headline centre in
        the space above the buttons; when large text needs more room than the
        screen has, the column scrolls instead of running under the buttons. */}
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.column, { paddingTop: insets.top + 12 }]}>
      <View style={styles.center}>
        <Animated.View style={[styles.emblem, { backgroundColor: look.emblem.fill, borderColor: look.emblem.ring, shadowColor: look.emblem.glow,
          opacity: values.emblem, transform: [{ scale: values.emblem.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
          <Image source={MARK} style={styles.mark} accessibilityLabel="FoundKeep" />
        </Animated.View>
        <View style={styles.headline} accessibilityRole="header">
          {LINES.map((line, i) => <Animated.View key={line} style={rise(values.lines[i])}><Text maxFontSizeMultiplier={1.4} style={[styles.line, { color: look.ink }]}>{line}</Text></Animated.View>)}
        </View>
        {/* The bookmark drops in below the headline, on screens with room for it. */}
        {H >= 720 ? <Animated.View pointerEvents="none" style={[styles.bookmark, { opacity: values.bookmark,
          transform: [{ translateY: values.bookmark.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }, { rotate: values.bookmark.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '-8deg'] }) }] }]}>
          <Image source={BOOKMARK} style={styles.img} accessible={false} />
        </Animated.View> : null}
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 18 }]}>
      {providers.map((provider, i) => {
        const tone = primaryIsApple(provider) ? look.primary : look.secondary;
        return <Animated.View key={provider} style={rise(values.buttons[Math.min(i, 1)], 28)}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/oauth/complete', params: { provider, intent: 'sign-in' } })}
            style={({ pressed }): StyleProp<ViewStyle> => [styles.button, { backgroundColor: tone.background, borderColor: tone.border }, pressed ? styles.pressed : null]}>
            <Ionicons name={provider === 'apple' ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'globe-outline'} size={20} color={tone.ink} />
            <Text maxFontSizeMultiplier={1.3} style={[styles.buttonLabel, { color: tone.ink }]}>Continue with {OAUTH_NAMES[provider]}</Text>
          </Pressable>
        </Animated.View>;
      })}
      <Animated.View style={[styles.more, rise(values.buttons[2], 12)]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue with email" onPress={() => setEmailOpen(true)} hitSlop={8}>
          <Text maxFontSizeMultiplier={1.4} style={[styles.email, { color: look.bottomInk }]}>Continue with email</Text>
        </Pressable>
        <Text maxFontSizeMultiplier={1.4} style={[styles.legal, { color: look.bottomMuted }]}>By continuing you accept the Terms and Privacy.</Text>
      </Animated.View>
      </View>
    </ScrollView>

    {emailOpen ? <EmailSheet onClose={() => setEmailOpen(false)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  haze: { position: 'absolute' },
  find: { position: 'absolute' },
  img: { width: '100%', height: '100%', resizeMode: 'contain' },
  column: { flexGrow: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 16, gap: 22 },
  emblem: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOpacity: 1, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  mark: { width: 38, height: 38, borderRadius: 9 },
  headline: { alignItems: 'center' },
  line: { fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.6, textAlign: 'center' },
  bookmark: { width: 68, height: 68, marginTop: 6 },
  actions: { paddingHorizontal: 20, gap: 10 },
  button: { minHeight: 56, paddingHorizontal: 16, borderRadius: 28, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  more: { alignItems: 'center', gap: 6, paddingTop: 6 },
  email: { fontSize: 15, fontWeight: '600', paddingVertical: 6 },
  legal: { fontSize: 12, textAlign: 'center' },
});
