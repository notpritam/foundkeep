// Kept as it was proposed, for the design log: Pritam picked "gather" (2026-10-02),
// built for real in sign-in/Handoff.tsx; the other three looks stay here as the
// alternatives it was chosen from.
//
// The step after "Continue with Google" (proposal, 2026-10-02): FoundKeep opens
// Google (or Apple) in the browser, waits, and finishes signing in when it comes
// back. Four ways to show it, each with every sign-in state the real screen
// (app/oauth/complete.tsx) has — opening, finish in the browser, signing in,
// didn't finish, and an existing collection to connect with its password:
//   screen  the sign-in screen stays; its buttons become a card saying what's happening
//   sheet   the sign-in screen stays behind; a sheet rises over it
//   gather  the cards gather into a slow ring round Google's mark
//   quiet   a calm light page with Google's mark
// Every change of state is a soft cross-fade (blurring, on the web) and the
// space it needs eases to its new size, so nothing jumps.
import { StatusBar } from 'expo-status-bar';
import { createElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../../components/motion.tsx';
import { OAUTH_NAMES, type OAuthProvider } from '../../auth-oauth.ts';
import { FirstScreen, FloatingFinds, ProviderButton, SkyBackdrop } from '../../sign-in/FirstScreen.tsx';
import { KeepEveryHeadline, useHeadlineFont } from '../../sign-in/Headline.tsx';

export type HandoffPhase = 'choose' | 'opening' | 'browser' | 'finishing' | 'failed' | 'link';
export type HandoffLook = 'screen' | 'sheet' | 'gather' | 'quiet';
/** What a button asks for: a provider (from the sign-in buttons), or one of the handoff's own. */
export type HandoffAction = OAuthProvider | 'reopen' | 'retry' | 'back' | 'connect';
type LookProps = { phase: HandoffPhase; provider: OAuthProvider; on: (action: HandoffAction) => void };

const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const native = Platform.OS !== 'web';
const SF = Platform.select({ web: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', default: undefined });
const INK = { ink: '#1d1d1f', muted: '#6e6e73', page: '#f5f5f7', well: '#eef0f3', field: '#f2f3f5' };
const GLOW = { textShadowColor: 'rgba(3,20,40,.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 };

/** What each state says. */
export function handoffWords(phase: HandoffPhase, provider: OAuthProvider) {
  const name = OAUTH_NAMES[provider];
  return {
    choose: { title: '', body: '' },
    opening: { title: `Opening ${name}…`, body: '' },
    browser: { title: `Waiting for ${name}`, body: 'Finish signing in there and you’ll come straight back.' },
    finishing: { title: 'Signing you in…', body: '' },
    failed: { title: 'Sign-in didn’t finish', body: `It was canceled, or ${name} couldn’t confirm it was you. Nothing has changed.` },
    link: { title: 'You already have a collection', body: `Your email already has a FoundKeep account. Enter its password once to connect ${name} to it.` },
  }[phase];
}

export function Handoff({ look, phase, provider = 'google', on = () => {} }: { look: HandoffLook; phase: HandoffPhase; provider?: OAuthProvider; on?: (action: HandoffAction) => void }) {
  const props = { phase, provider, on };
  if (look === 'sheet') return <InSheet {...props} />;
  if (look === 'gather') return <Gathered {...props} />;
  if (look === 'quiet') return <Quiet {...props} />;
  return <OnScreen {...props} />;
}

// ——— Look one: the buttons become a card ———

function OnScreen({ phase, provider, on }: LookProps) {
  const words = handoffWords(phase, provider);
  // The space the two buttons took stays held, so the headline above never moves for a shorter card.
  return <FirstScreen settled actions={<View style={styles.hold}><Swap id={phase === 'choose' ? 'choose' : 'card'}>
    {phase === 'choose' ? <Choose on={on} /> : <View style={styles.card}>
      <Swap id={phase} align="start" gap={14}>
        <View style={styles.cardRow}>
          <ProviderMark provider={provider} size={44} well={INK.well} />
          <View style={styles.cardWords}>
            <Text maxFontSizeMultiplier={1.3} style={styles.cardTitle}>{words.title}</Text>
            {words.body ? <Text maxFontSizeMultiplier={1.4} style={styles.cardBody}>{words.body}</Text> : <View style={styles.progressGap}><Progress /></View>}
          </View>
        </View>
        {phase === 'link' ? <PasswordField /> : null}
        <Actions phase={phase} provider={provider} on={on} tone="card" />
      </Swap>
    </View>}
  </Swap></View>} />;
}

// ——— Look two: a sheet over the sign-in screen ———

function InSheet({ phase, provider, on }: LookProps) {
  const insets = useSafeAreaInsets();
  const open = phase !== 'choose';
  // While the sheet slides away it keeps showing what it last said.
  const shown = useRef<HandoffPhase>(open ? phase : 'opening');
  if (open) shown.current = phase;
  const t = useEased(open ? 1 : 0, open ? 640 : 420);
  const words = handoffWords(shown.current, provider);
  return <View style={styles.fill}>
    <FirstScreen settled />
    <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.scrim, { opacity: t }]} />
    <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 14, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [620, 0] }) }] }]}>
      <View style={styles.grabber} />
      <ProviderMark provider={provider} size={60} well={INK.well} />
      <View style={styles.sheetBody}>
        <Swap id={shown.current} align="start">
          <Text maxFontSizeMultiplier={1.3} style={styles.sheetTitle}>{words.title}</Text>
          {words.body ? <Text maxFontSizeMultiplier={1.4} style={styles.sheetText}>{words.body}</Text> : <View style={styles.progressCentre}><Progress /></View>}
          {shown.current === 'link' ? <PasswordField /> : null}
          <Actions phase={shown.current} provider={provider} on={on} tone="sheet" />
        </Swap>
      </View>
    </Animated.View>
  </View>;
}

// ——— Look three: the cards gather round Google's mark ———

/** 0: the cards in their places; 1: a ring round the mark; 2: closer in. */
const GATHER: Record<HandoffPhase, number> = { choose: 0, opening: 1, browser: 1, finishing: 2, failed: 0, link: 1 };

function Gathered({ phase, provider, on }: LookProps) {
  const { height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fontReady = useHeadlineFont();
  const motion = useMotionAllowed();
  // While the words fade back to the headline they keep saying what they last said.
  const shown = useRef<HandoffPhase>(phase === 'choose' ? 'opening' : phase);
  if (phase !== 'choose') shown.current = phase;
  const words = handoffWords(shown.current, provider);
  // In the ring the words sit inside it, under the mark; with the cards back in their places they sit higher and run wider.
  const wide = GATHER[shown.current] === 0;
  const gather = useEased(GATHER[phase], 1700);
  const away = useEased(phase === 'choose' ? 0 : 1, 760);
  const lift = useEased(wide ? -36 : 0, 1200);
  return <View style={styles.fill}>
    <StatusBar style="light" />
    <SkyBackdrop />
    <FloatingFinds settled gather={gather} />
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.column, { paddingTop: insets.top + 12 }]}>
      <View style={styles.center}><Animated.View style={softly(away, true)}><KeepEveryHeadline start={fontReady} motion={motion} settled /></Animated.View></View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 18, minHeight: 122 + insets.bottom + 18, justifyContent: 'flex-end' }]}>
        <Swap id={phase}>
          {phase === 'choose' ? <Choose on={on} /> : phase === 'link'
            ? <View style={styles.card}><Text maxFontSizeMultiplier={1.4} style={styles.cardBody}>{words.body}</Text><PasswordField /><Actions phase={phase} provider={provider} on={on} tone="card" /></View>
            : <Actions phase={phase} provider={provider} on={on} tone="sky" />}
        </Swap>
      </View>
    </ScrollView>
    <Animated.View pointerEvents="none" style={[styles.ringMiddle, { top: H * 0.42 - 76, transform: [{ translateY: lift }] }]}>
      <Animated.View style={[styles.ringStack, softly(away)]}>
        <ProviderMark provider={provider} size={76} well="#ffffff" shadow />
        <Swap id={shown.current} align="start">
          <View style={[styles.ringWords, { maxWidth: wide ? 250 : 214 }]}>
            <Text maxFontSizeMultiplier={1.3} style={[styles.skyTitle, GLOW]}>{words.title}</Text>
            {shown.current !== 'link' && words.body ? <Text maxFontSizeMultiplier={1.4} style={[styles.skyText, GLOW]}>{words.body}</Text> : null}
            {!words.body ? <View style={styles.progressCentre}><Progress tone="sky" /></View> : null}
          </View>
        </Swap>
      </Animated.View>
    </Animated.View>
  </View>;
}

// ——— Look four: a calm light page ———

function Quiet({ phase, provider, on }: LookProps) {
  const insets = useSafeAreaInsets();
  const open = phase !== 'choose';
  const shown = useRef<HandoffPhase>(open ? phase : 'opening');
  if (open) shown.current = phase;
  const t = useEased(open ? 1 : 0, 560);
  const words = handoffWords(shown.current, provider);
  const waiting = ['opening', 'browser', 'finishing'].includes(shown.current);
  return <View style={styles.fill}>
    <FirstScreen settled />
    <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.page, { opacity: t }]}>
      {open ? <StatusBar style="dark" /> : null}
      <View style={[styles.pageMiddle, { paddingTop: insets.top + 24 }]}>
        <Breathing active={open && waiting}><ProviderMark provider={provider} size={76} well="#ffffff" shadow /></Breathing>
        <Swap id={shown.current} align="start">
          <View style={styles.pageWords}>
            <Text maxFontSizeMultiplier={1.3} style={styles.pageTitle}>{words.title}</Text>
            {words.body ? <Text maxFontSizeMultiplier={1.4} style={styles.pageText}>{words.body}</Text> : <View style={styles.progressCentre}><Progress /></View>}
          </View>
        </Swap>
      </View>
      <View style={[styles.actions, { paddingBottom: insets.bottom + 18, minHeight: 122 + insets.bottom + 18, justifyContent: 'flex-end' }]}>
        <Swap id={shown.current}>
          {shown.current === 'link' ? <PasswordField onPage /> : null}
          <Actions phase={shown.current} provider={provider} on={on} tone="page" />
        </Swap>
      </View>
    </Animated.View>
  </View>;
}

// ——— Pieces ———

function Choose({ on }: { on: (action: HandoffAction) => void }) {
  return <View style={styles.stack}><ProviderButton provider="google" onPress={() => on('google')} /><ProviderButton provider="apple" onPress={() => on('apple')} /></View>;
}

/** The buttons for a state; tone: where they sit (a white card or sheet, the sky, or the light page). */
function Actions({ phase, provider, on, tone }: LookProps & { tone: 'card' | 'sheet' | 'sky' | 'page' }) {
  const name = OAUTH_NAMES[provider];
  const lead = tone === 'sky' ? 'light' : 'dark', quiet = tone === 'sky' ? 'veil' : 'ghost';
  const row = tone === 'card';
  const pair = (first: ReactNode, back = true) => <View style={row ? styles.row : styles.stack}>{first}{back ? <Pill label="Back" tone={quiet} onPress={() => on('back')} grow={!row} /> : null}</View>;
  if (phase === 'browser') return pair(<Pill label={`Open ${name} again`} tone={lead} onPress={() => on('reopen')} grow />);
  if (phase === 'failed') return pair(tone === 'sky' || tone === 'page'
    ? <ProviderButton provider={provider} onPress={() => on('retry')} />
    : <Pill label="Try again" tone={lead} onPress={() => on('retry')} grow />);
  if (phase === 'link') return pair(<Pill label="Connect" tone={lead} onPress={() => on('connect')} grow />);
  return null;
}

type PillTone = 'dark' | 'light' | 'ghost' | 'veil';
const PILL: Record<PillTone, { background: string; ink: string }> = {
  dark: { background: '#0b0c0d', ink: '#ffffff' }, light: { background: '#ffffff', ink: '#202020' },
  // veil: over the sky, a dim glass that reads on blue and on bright cloud alike.
  ghost: { background: 'transparent', ink: INK.ink }, veil: { background: 'rgba(10,30,55,0.34)', ink: '#ffffff' },
};
function Pill({ label, tone, onPress, grow = false }: { label: string; tone: PillTone; onPress: () => void; grow?: boolean }) {
  const look = PILL[tone];
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }): StyleProp<ViewStyle> => [styles.pill, grow && styles.grow, { backgroundColor: look.background }, pressed ? styles.pressed : null]}>
    <Text maxFontSizeMultiplier={1.3} style={[styles.pillLabel, { color: look.ink }]}>{label}</Text>
  </Pressable>;
}

function PasswordField({ onPage = false }: { onPage?: boolean }) {
  const [value, setValue] = useState('');
  return <TextInput value={value} onChangeText={setValue} secureTextEntry autoCapitalize="none" textContentType="password" placeholder="FoundKeep password" placeholderTextColor={INK.muted} style={[styles.field, onPage && styles.fieldOnPage]} accessibilityLabel="FoundKeep password" />;
}

function ProviderMark({ provider, size, well, shadow = false }: { provider: OAuthProvider; size: number; well: string; shadow?: boolean }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: well }, styles.mark, shadow && styles.markShadow]} accessible={false}>
    <Ionicons name={provider === 'apple' ? 'logo-apple' : 'logo-google'} size={Math.round(size * 0.42)} color={INK.ink} />
  </View>;
}

/** A thin bar with a soft light moving along it: working, with no promise of how long. */
function Progress({ tone = 'ink' }: { tone?: 'ink' | 'sky' }) {
  const motion = useMotionAllowed();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }));
    loop.start(); return () => loop.stop();
  }, [motion, t]);
  const width = 128, light = width * 0.36;
  return <View style={[styles.track, { width, backgroundColor: tone === 'sky' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.08)' }]}>
    <Animated.View style={[styles.light, { width: light, backgroundColor: tone === 'sky' ? '#ffffff' : INK.ink, opacity: motion ? 0.75 : 0,
      transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-light, width] }) }] }]} />
  </View>;
}

/** Two soft rings breathing out from the mark while it waits. */
function Breathing({ active, children }: { active: boolean; children: ReactNode }) {
  const motion = useMotionAllowed();
  const rings = useRef([new Animated.Value(0), new Animated.Value(0)]).current;
  const on = useEased(active && motion ? 1 : 0, 500);
  useEffect(() => {
    if (!motion) return;
    const loops = rings.map((ring, i) => Animated.loop(Animated.sequence([Animated.delay(i * 1200), Animated.timing(ring, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: native }), Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: native })])));
    loops.forEach(loop => loop.start()); return () => loops.forEach(loop => loop.stop());
  }, [motion, rings]);
  return <View style={styles.breathing}>
    {rings.map((ring, i) => <Animated.View key={i} pointerEvents="none" style={[styles.ring, { opacity: Animated.multiply(on, ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] })), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] }]} />)}
    {children}
  </View>;
}

/** A value that eases to wherever it is told to be. */
function useEased(to: number, duration: number) {
  const motion = useMotionAllowed();
  const value = useRef(new Animated.Value(to)).current;
  useEffect(() => {
    if (!motion) { value.setValue(to); return; }
    const run = Animated.timing(value, { toValue: to, duration, easing: SETTLE, useNativeDriver: native });
    run.start(); return () => run.stop();
  }, [to, duration, motion, value]);
  return value;
}

/** Shown at 1, gone at 0 (or the other way round): a fade with a little rise and, on the web, a soft blur. */
function softly(value: Animated.Value, leaving = false) {
  const shown = leaving ? value.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : value;
  return {
    opacity: shown,
    transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [leaving ? -8 : 10, 0] }) }],
    ...(native ? null : { filter: shown.interpolate({ inputRange: [0, 1], outputRange: ['blur(10px)', 'blur(0px)'] }) }),
  };
}

/** One thing at a time: when id changes, the old fades out (softly blurring, on
 * the web) as the new fades in, and the space between them eases to the new
 * height. align: which edge holds still while the height changes. */
export function Swap({ id, children, align = 'end', gap = 0 }: { id: string; children: ReactNode; align?: 'start' | 'center' | 'end'; gap?: number }) {
  const motion = useMotionAllowed();
  const last = useRef({ id, node: children });
  const enter = useRef(new Animated.Value(1)).current;
  const height = useRef(new Animated.Value(0)).current;
  const [measured, setMeasured] = useState(false);
  const [leaving, setLeaving] = useState<{ key: number; node: ReactNode; t: Animated.Value }[]>([]);
  const count = useRef(0);
  useLayoutEffect(() => {
    if (last.current.id === id) { last.current.node = children; return; }
    const gone = { key: ++count.current, node: last.current.node, t: new Animated.Value(1) };
    last.current = { id, node: children };
    if (!motion) return;
    setLeaving(list => [...list, gone]);
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, delay: 110, duration: 600, easing: SETTLE, useNativeDriver: native }).start();
    Animated.timing(gone.t, { toValue: 2, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: native }).start(() => setLeaving(list => list.filter(item => item !== gone)));
  });
  const measure = (h: number) => {
    if (!measured) { height.setValue(h); setMeasured(true); return; }
    if (!motion) { height.setValue(h); return; }
    Animated.timing(height, { toValue: h, duration: 560, easing: SETTLE, useNativeDriver: false }).start();
  };
  const justify = align === 'end' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
  const look = (t: Animated.Value) => ({
    opacity: t.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
    transform: [{ translateY: t.interpolate({ inputRange: [0, 1, 2], outputRange: [10, 0, -6] }) }],
    ...(native ? null : { filter: t.interpolate({ inputRange: [0, 1, 2], outputRange: ['blur(8px)', 'blur(0px)', 'blur(8px)'] }) }),
  });
  return <Animated.View style={[styles.swap, measured ? { height } : null]}>
    {leaving.map(item => <View key={item.key} pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: justify }]}>
      <Animated.View style={[{ gap }, look(item.t)]}>{item.node}</Animated.View>
    </View>)}
    <View style={measured ? [StyleSheet.absoluteFill, { justifyContent: justify }] : null}>
      <Animated.View style={[{ gap }, look(enter)]} onLayout={event => measure(event.nativeEvent.layout.height)}>{children}</Animated.View>
    </View>
  </Animated.View>;
}

// ——— Playthrough, for the design system: a pointer taps Continue, and the states follow ———

const PLAY: [HandoffPhase, number][] = [['choose', 2400], ['opening', 1600], ['browser', 2800], ['finishing', 2400]];

export function HandoffPlaythrough({ look, provider = 'google' }: { look: HandoffLook; provider?: OAuthProvider }) {
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => { setStep(s => (s + 1) % PLAY.length); if (step === PLAY.length - 1) setRound(r => r + 1); }, PLAY[step][1]);
    return () => clearTimeout(timer);
  }, [step]);
  return <View style={styles.fill}>
    <Handoff look={look} phase={PLAY[step][0]} provider={provider} />
    <TapPointer key={round} provider={provider} />
  </View>;
}

/** The Mac pointer, gliding in to the Continue button and pressing it (on the web only — it is for showing the flow). */
const ARROW = 'M2 1.5 L2 17.6 L6.1 13.8 L8.9 20.2 L11.7 19 L8.95 12.7 L14.6 12.7 Z';
function TapPointer({ provider }: { provider: OAuthProvider }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotionAllowed();
  const t = useRef({ glide: new Animated.Value(0), press: new Animated.Value(0), shown: new Animated.Value(0) }).current;
  useEffect(() => {
    if (!motion) return;
    const run = Animated.sequence([
      Animated.delay(250),
      Animated.parallel([Animated.timing(t.shown, { toValue: 1, duration: 300, useNativeDriver: false }), Animated.timing(t.glide, { toValue: 1, duration: 1250, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: false })]),
      Animated.delay(120),
      Animated.timing(t.press, { toValue: 1, duration: 110, useNativeDriver: false }), Animated.timing(t.press, { toValue: 0, duration: 160, useNativeDriver: false }),
      Animated.delay(400),
      Animated.timing(t.shown, { toValue: 0, duration: 420, useNativeDriver: false }),
    ]);
    run.start(); return () => run.stop();
  }, [motion, t]);
  if (native) return null;
  // The Continue buttons sit at the foot of the screen: Google first, then Apple.
  const y = H - insets.bottom - 18 - 28 - (provider === 'google' ? 66 : 0);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, opacity: t.shown,
    transform: [{ translateX: t.glide.interpolate({ inputRange: [0, 1], outputRange: [W * 0.86, W / 2 + 36] }) }, { translateY: t.glide.interpolate({ inputRange: [0, 1], outputRange: [H * 0.62, y] }) }, { scale: t.press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.84] }) }] }}>
    {/* Drawn as SVG, as the film draws it: an image of it would load late, or not at all from a data URL. */}
    {createElement('svg', { width: 20, height: 26, viewBox: '0 0 17 22', style: { display: 'block', overflow: 'visible', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' } },
      createElement('path', { d: ARROW, fill: '#111', stroke: '#fff', strokeWidth: 1.3, strokeLinejoin: 'round' }))}
  </Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', backgroundColor: '#1a78c8' },
  swap: { alignSelf: 'stretch' },
  column: { flexGrow: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 16, paddingBottom: 84 },
  actions: { paddingHorizontal: 20 },
  hold: { minHeight: 122, justifyContent: 'flex-end' },
  stack: { gap: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  grow: { flexGrow: 1 },
  card: { backgroundColor: '#ffffff', borderRadius: 28, padding: 16, gap: 14, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  cardRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cardWords: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: SF, fontSize: 17, lineHeight: 22, fontWeight: '600', color: INK.ink, letterSpacing: -0.2 },
  cardBody: { fontFamily: SF, fontSize: 15, lineHeight: 20, color: INK.muted },
  progressGap: { paddingTop: 9 },
  progressCentre: { alignItems: 'center', paddingTop: 16 },
  scrim: { backgroundColor: 'rgba(3,16,32,0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff', borderTopLeftRadius: 34, borderTopRightRadius: 34, borderCurve: 'continuous', paddingTop: 10, paddingHorizontal: 22, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 30, shadowOffset: { width: 0, height: -6 } },
  grabber: { width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.14)', marginBottom: 22 },
  sheetBody: { alignSelf: 'stretch', paddingTop: 16 },
  sheetTitle: { fontFamily: SF, fontSize: 21, lineHeight: 26, fontWeight: '600', color: INK.ink, textAlign: 'center', letterSpacing: -0.3 },
  sheetText: { fontFamily: SF, fontSize: 15, lineHeight: 21, color: INK.muted, textAlign: 'center', marginTop: 6, marginBottom: 20, paddingHorizontal: 8 },
  ringMiddle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ringStack: { alignSelf: 'stretch', alignItems: 'center', gap: 14 },
  ringWords: { alignSelf: 'center', alignItems: 'center', gap: 6 },
  skyTitle: { fontFamily: SF, fontSize: 22, lineHeight: 27, fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: -0.4 },
  skyText: { fontFamily: SF, fontSize: 15, lineHeight: 21, fontWeight: '500', color: '#ffffff', textAlign: 'center' },
  page: { backgroundColor: INK.page },
  pageMiddle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 22 },
  pageWords: { alignSelf: 'center', alignItems: 'center', gap: 8, maxWidth: 320 },
  pageTitle: { fontFamily: SF, fontSize: 24, lineHeight: 30, fontWeight: '600', color: INK.ink, textAlign: 'center', letterSpacing: -0.5 },
  pageText: { fontFamily: SF, fontSize: 16, lineHeight: 22, color: INK.muted, textAlign: 'center' },
  pill: { minHeight: 50, paddingHorizontal: 18, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  pillLabel: { fontFamily: SF, fontSize: 16, fontWeight: '600' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  fieldOnPage: { backgroundColor: '#ffffff', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.14)' },
  field: { fontFamily: SF, minHeight: 50, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: INK.ink, backgroundColor: INK.field, marginBottom: 10 },
  mark: { alignItems: 'center', justifyContent: 'center' },
  markShadow: { shadowColor: '#06203a', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  light: { height: 4, borderRadius: 2 },
  breathing: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 1.5, borderColor: 'rgba(29,29,31,0.22)' },
});
