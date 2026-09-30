import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Icon } from '../../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { isOAuthProvider, OAUTH_NAMES, type OAuthProvider } from '../../auth-oauth.ts';
import { EmailSheet } from '../sign-in/EmailSheet.tsx';
import { gradient } from '../sign-in/looks.ts';

// Pritam's corrected brief: KEEP the reference composition. Generated physical
// objects frame a glowing mark + centred headline; the buttons rise last.
// All five proposals share that composition. Their objects, framing, copy and
// sky tones differ. No flat-card/editorial alternative layouts remain.
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const NATIVE = Platform.OS !== 'web';
const MARK = require('../../../assets/images/mark.png');
const OBJECTS = {
  photo: require('../../../assets/images/sign-in-sky/photo.webp'),
  highlight: require('../../../assets/images/sign-in-sky/highlight.webp'),
  voice: require('../../../assets/images/sign-in-sky/voice.webp'),
  folder: require('../../../assets/images/sign-in-sky/folder.webp'),
  webpage: require('../../../assets/images/sign-in-sky/webpage.webp'),
  video: require('../../../assets/images/sign-in-sky/video.webp'),
} satisfies Record<string, ImageSourcePropType>;

type ObjectName = keyof typeof OBJECTS;
type FloatingObject = { object: ObjectName; side: 'left' | 'right'; band: 'top' | 'middle' | 'bottom'; size: number; turn: number; inset?: number };
export type SkyIdea = 'found' | 'worth' | 'curiosity' | 'moments' | 'corner';
type Idea = { headline: string; alternate: string; sky: [string, string]; objects: FloatingObject[]; clouds?: boolean };
export const ideas: Record<SkyIdea, Idea> = {
  found: {
    headline: 'Meet FoundKeep,\na place for things\nworth keeping.',
    alternate: 'Everything you find.\nA place to keep it.',
    sky: ['#0879bb', '#2083c2'],
    objects: [
      { object: 'photo', side: 'left', band: 'top', size: 132, turn: -15, inset: 0 },
      { object: 'webpage', side: 'right', band: 'top', size: 138, turn: 10, inset: -4 },
      { object: 'voice', side: 'left', band: 'middle', size: 103, turn: -17, inset: -20 },
      { object: 'highlight', side: 'right', band: 'middle', size: 98, turn: 12, inset: -18 },
      { object: 'video', side: 'left', band: 'bottom', size: 133, turn: -13, inset: -6 },
      { object: 'folder', side: 'right', band: 'bottom', size: 127, turn: 10, inset: 2 },
    ],
  },
  worth: {
    headline: 'That’s a keeper.\nGive it a place\nto stay.',
    alternate: 'For the things\nyou’ll want\nto find again.',
    sky: ['#0b70b3', '#177fbd'],
    objects: [
      { object: 'highlight', side: 'left', band: 'top', size: 150, turn: -17, inset: -8 },
      { object: 'photo', side: 'right', band: 'top', size: 132, turn: 14, inset: 8 },
      { object: 'webpage', side: 'left', band: 'middle', size: 90, turn: -18, inset: -26 },
      { object: 'voice', side: 'right', band: 'middle', size: 83, turn: 8, inset: -12 },
      { object: 'folder', side: 'right', band: 'bottom', size: 153, turn: -2, inset: -14 },
      { object: 'highlight', side: 'left', band: 'bottom', size: 111, turn: -8, inset: -2 },
    ],
  },
  curiosity: {
    headline: 'Follow your curiosity.\nKeep what\nyou find.',
    alternate: 'Good ideas start\nwith a little\n“I’ll keep that.”',
    sky: ['#136ec0', '#277dbe'],
    objects: [
      { object: 'webpage', side: 'left', band: 'top', size: 143, turn: -15, inset: -7 },
      { object: 'highlight', side: 'right', band: 'top', size: 144, turn: 11, inset: 4 },
      { object: 'folder', side: 'left', band: 'middle', size: 90, turn: -12, inset: -20 },
      { object: 'photo', side: 'right', band: 'middle', size: 86, turn: 22, inset: -18 },
      { object: 'voice', side: 'left', band: 'bottom', size: 122, turn: -16, inset: 4 },
      { object: 'webpage', side: 'right', band: 'bottom', size: 130, turn: 8, inset: -4 },
    ],
  },
  moments: {
    headline: 'A thought. A photo.\nA little moment.\nKeep it here.',
    alternate: 'Some things\nare too good\nto scroll past.',
    sky: ['#086eac', '#177fb8'], clouds: true,
    objects: [
      { object: 'photo', side: 'left', band: 'top', size: 146, turn: -12, inset: -9 },
      { object: 'video', side: 'right', band: 'top', size: 142, turn: 11, inset: -5 },
      { object: 'highlight', side: 'right', band: 'middle', size: 81, turn: 18, inset: -18 },
      { object: 'voice', side: 'left', band: 'bottom', size: 145, turn: -14, inset: -10 },
      { object: 'folder', side: 'right', band: 'bottom', size: 123, turn: 13, inset: 3 },
    ],
  },
  corner: {
    headline: 'Your own corner\nfor everything\nworth keeping.',
    alternate: 'Found out there.\nKept right here.\nJust for you.',
    sky: ['#076aab', '#1b7db6'], clouds: true,
    objects: [
      { object: 'photo', side: 'left', band: 'top', size: 157, turn: -17, inset: -12 },
      { object: 'highlight', side: 'right', band: 'top', size: 146, turn: 16, inset: -3 },
      { object: 'webpage', side: 'left', band: 'bottom', size: 143, turn: -12, inset: -7 },
      { object: 'folder', side: 'right', band: 'bottom', size: 157, turn: 7, inset: -9 },
    ],
  },
};

function Floating({ item, index }: { item: FloatingObject; index: number }) {
  const motion = useMotionAllowed();
  const insets = useSafeAreaInsets();
  const entry = useRef(new Animated.Value(1)).current;
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { entry.setValue(1); phase.setValue(0); return; }
    entry.setValue(0); phase.setValue(0);
    const arrive = Animated.timing(entry, { toValue: 1, duration: 1650, delay: 80 + index * 95, easing: SETTLE, useNativeDriver: NATIVE });
    const drift = Animated.loop(Animated.timing(phase, { toValue: 1, duration: 8500 + index * 570, easing: Easing.linear, useNativeDriver: NATIVE, isInteraction: false }));
    arrive.start(); drift.start();
    return () => { arrive.stop(); drift.stop(); };
  }, [motion, index, entry, phase]);
  const steps = Array.from({ length: 33 }, (_, i) => i / 32);
  // Continuous sine drift; one cycle ends at the exact pose/velocity it starts.
  const wave = (amplitude: number) => phase.interpolate({ inputRange: steps, outputRange: steps.map(t => amplitude * Math.sin(t * Math.PI * 2)) });
  const edge = item.side === 'left' ? -1 : 1;
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[
    styles.object,
    { width: item.size, height: item.size, [item.side]: item.inset ?? 0,
      ...(item.band === 'bottom' ? { bottom: 0 } : { top: insets.top + (item.band === 'top' ? 4 : 118) }),
      opacity: entry,
      transform: [
        { translateX: Animated.add(entry.interpolate({ inputRange: [0, 1], outputRange: [edge * 95, 0] }), wave(3)) },
        { translateY: Animated.add(entry.interpolate({ inputRange: [0, 1], outputRange: [item.band === 'bottom' ? 65 : -55, 0] }), wave(5 + index % 3)) },
        { rotate: entry.interpolate({ inputRange: [0, 1], outputRange: [`${item.turn + edge * 18}deg`, `${item.turn}deg`] }) },
        { scale: entry.interpolate({ inputRange: [0, 1], outputRange: [0.87, 1] }) },
      ],
    },
  ]}><Image source={OBJECTS[item.object]} style={styles.image} accessible={false} /></Animated.View>;
}

export function SkyObjectsScreen({ idea }: { idea: SkyIdea }) {
  const design = ideas[idea];
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const { client } = useSession();
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const v = useRef({ emblem: new Animated.Value(1), headline: new Animated.Value(1), actions: [0, 1, 2].map(() => new Animated.Value(1)) }).current;
  useEffect(() => {
    let live = true;
    setProviders([]);
    void client.oauthProviders().then(value => {
      if (live && Array.isArray(value.providers)) setProviders(value.providers.filter(isOAuthProvider));
    }).catch(() => {});
    return () => { live = false; };
  }, [client]);
  useEffect(() => {
    const values = [v.emblem, v.headline, ...v.actions];
    if (!motion) { values.forEach(value => value.setValue(1)); return; }
    values.forEach(value => value.setValue(0));
    const animation = Animated.parallel(values.map((value, i) => Animated.timing(value, {
      toValue: 1, duration: i < 2 ? 1300 : 950, delay: [200, 400, 1050, 1150, 1250][i], easing: SETTLE, useNativeDriver: NATIVE,
    })));
    animation.start();
    return () => animation.stop();
  }, [motion, v]);
  const rise = (value: Animated.Value, distance = 20) => ({ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] });
  const ordered = [...providers].sort((a, b) => ['google', 'apple'].indexOf(a) - ['google', 'apple'].indexOf(b));
  return <View style={styles.fill}>
    {/* Same reference layout at every size. Insets + flowing top/bottom object
        bands leave the headline clear even at 200%; the whole column scrolls. */}
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.column}>
      <View style={[styles.hero, gradient(`linear-gradient(180deg, ${design.sky[0]}, ${design.sky[1]})`), { paddingTop: insets.top + 118, paddingBottom: Math.max(135, ...design.objects.filter(item => item.band === 'bottom').map(item => item.size + 12)), paddingLeft: 26 + insets.left, paddingRight: 26 + insets.right }]}>
        {design.clouds ? <Image source={require('../../../assets/images/sign-in-sky/cloudscape.webp')} style={[StyleSheet.absoluteFill, { opacity: 0.13 }]} resizeMode="cover" accessible={false} /> : null}
        <View pointerEvents="none" style={[styles.topHaze, gradient('radial-gradient(closest-side, rgba(219,245,255,.2), transparent)')]} />
        {design.objects.map((item, i) => <Floating key={`${idea}-${i}`} item={item} index={i} />)}
        <View style={styles.words}>
          <Animated.View style={[styles.emblem, rise(v.emblem, 14)]}><Image source={MARK} style={styles.mark} accessibilityLabel="FoundKeep" /></Animated.View>
          <Animated.View style={rise(v.headline)}><Text accessibilityRole="header" style={styles.headline}>{design.headline}</Text></Animated.View>
        </View>
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }, gradient(`linear-gradient(180deg, ${design.sky[1]} 0%, #a5d9f1 42%, #daf1fb 76%)`)]}>
        {ordered.map((provider, i) => {
          const apple = provider === 'apple';
          return <Animated.View key={provider} style={rise(v.actions[Math.min(i, 1)], 24)}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/oauth/complete', params: { provider, intent: 'sign-in' } })}
              style={({ pressed }) => [styles.button, { backgroundColor: apple ? '#0b1115' : '#fff' }, pressed && { opacity: 0.85 }]}>
              <Icon name={apple ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'globe-outline'} size={20} color={apple ? '#fff' : '#172f3c'} />
              <Text style={[styles.buttonLabel, { color: apple ? '#fff' : '#172f3c' }]}>Continue with {OAUTH_NAMES[provider]}</Text>
            </Pressable>
          </Animated.View>;
        })}
        <Animated.View style={[styles.more, rise(v.actions[2], 12)]}>
          <Pressable accessibilityRole="button" onPress={() => setEmailOpen(true)} style={styles.emailTarget}><Text style={styles.email}>Continue with email</Text></Pressable>
          <Text style={styles.legal}>By continuing you accept the Terms and Privacy.</Text>
        </Animated.View>
      </View>
    </ScrollView>
    {emailOpen ? <EmailSheet onClose={() => setEmailOpen(false)} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0879bb', overflow: 'hidden' },
  column: { flexGrow: 1 },
  hero: { flexGrow: 1, justifyContent: 'center', paddingBottom: 135, overflow: 'hidden' },
  object: { position: 'absolute' },
  image: { width: '100%', height: '100%', resizeMode: 'contain' },
  topHaze: { position: 'absolute', left: '10%', top: '6%', width: '70%', height: 100 },
  words: { alignItems: 'center', gap: 22 },
  emblem: { width: 76, height: 76, borderRadius: 38, borderColor: '#d6f2ffaa', borderWidth: 1, backgroundColor: '#ffffff28', alignItems: 'center', justifyContent: 'center', shadowColor: '#d9f8ff', shadowOpacity: 0.8, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } },
  mark: { width: 38, height: 38, borderRadius: 9 },
  headline: { fontSize: 30, lineHeight: 37, fontWeight: '500', letterSpacing: -0.6, color: '#fff', textAlign: 'center' },
  actions: { paddingTop: 10, gap: 10 },
  button: { minHeight: 56, paddingVertical: 15, paddingHorizontal: 16, borderRadius: 32, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#18415b', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  buttonLabel: { fontSize: 16, lineHeight: 22, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  more: { alignItems: 'center', gap: 4, paddingTop: 8, backgroundColor: '#daf1fb', borderRadius: 12 },
  emailTarget: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  email: { fontSize: 15, lineHeight: 22, color: '#143c55', fontWeight: '600', textAlign: 'center' },
  legal: { fontSize: 12, lineHeight: 18, color: '#36556a', textAlign: 'center', paddingHorizontal: 6 },
});
