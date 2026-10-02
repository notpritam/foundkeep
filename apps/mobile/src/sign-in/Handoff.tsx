// After "Continue with Google" (Pritam, 2026-10-02: "the cards gather"): the
// sign-in sky stays, and the floating cards gather into a slow ring round
// Google's (or Apple's) mark while it opens and waits in the browser, close in
// as you're signed in, and go back to their places if it didn't finish. The
// words under the mark say what's happening; the buttons at the foot are the
// only ones there are. Each change is a soft cross-fade (blurring, on the web)
// and the space it needs eases to its new size, so nothing jumps. The screen's
// logic is app/oauth/complete.tsx; this is how it looks.
import { StatusBar } from 'expo-status-bar';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveText as Text } from '../components/AdaptiveText.tsx';
import { AdaptiveIcon as Ionicons } from '../components/AdaptiveIcon.tsx';
import { useMotionAllowed } from '../components/motion.tsx';
import type { OAuthProvider } from '../auth-oauth.ts';
import { FloatingFinds, ProviderButton, SkyBackdrop } from './FirstScreen.tsx';
import { KeepEveryHeadline, useHeadlineFont } from './Headline.tsx';
import { handoffWords, type HandoffPhase } from './handoffWords.ts';

/** What a button asks for: a provider (the sign-in buttons), or one of the handoff's own. */
export type HandoffAction = OAuthProvider | 'reopen' | 'retry' | 'back' | 'connect';
export type HandoffProps = {
  phase: HandoffPhase; provider: OAuthProvider | null; on: (action: HandoffAction) => void;
  /** failed: why, when the app knows. */
  reason?: string;
  /** link: the password field, and what went wrong with the last try. */
  password?: string; onPassword?: (value: string) => void; passwordError?: string; busy?: boolean;
  /** Arrive from the sign-in screen as it was — cards in their places, the headline showing. */
  enter?: boolean;
};

const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
const native = Platform.OS !== 'web';
const SF = Platform.select({ web: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif', default: undefined });
const INK = { ink: '#1d1d1f', muted: '#6e6e73', well: '#eef0f3', field: '#f2f3f5', error: '#c4321b' };
const GLOW = { textShadowColor: 'rgba(3,20,40,.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 };
/** 0: the cards in their places; 1: a ring round the mark; 2: closer in. */
const GATHER: Record<HandoffPhase, number> = { choose: 0, opening: 1, browser: 1, finishing: 2, failed: 0, link: 1 };

export function HandoffView({ phase, provider, on, reason, password = '', onPassword, passwordError, busy = false, enter = false }: HandoffProps) {
  const { height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fontReady = useHeadlineFont();
  const motion = useMotionAllowed();
  // While the words fade back to the headline they keep saying what they last said.
  const shown = useRef<HandoffPhase>(phase === 'choose' ? 'opening' : phase);
  if (phase !== 'choose') shown.current = phase;
  const words = handoffWords(shown.current, provider, reason);
  // In the ring the words sit inside it, under the mark; with the cards back in their places they sit higher and run wider.
  const wide = GATHER[shown.current] === 0;
  const gather = useEased(GATHER[phase], 1700, enter ? 0 : undefined);
  const away = useEased(phase === 'choose' ? 0 : 1, 760, enter ? 0 : undefined);
  const lift = useEased(wide ? -36 : 0, 1200);
  // VoiceOver and TalkBack hear each new state, as it would be seen.
  useEffect(() => {
    if (phase !== 'choose') AccessibilityInfo.announceForAccessibility([words.title, phase === 'link' ? '' : words.body].filter(Boolean).join('. '));
  }, [phase, words.title, words.body]);

  return <View style={styles.fill}>
    <StatusBar style="light" />
    <SkyBackdrop />
    <FloatingFinds settled gather={gather} />
    {/* Under the buttons, so the password card can rise over it when the keyboard opens. */}
    <Animated.View pointerEvents="none" style={[styles.ringMiddle, { top: H * 0.42 - 66, transform: [{ translateY: lift }] }]}>
      <Animated.View style={[styles.ringStack, softly(away)]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ProviderMark provider={provider} />
        <Swap id={shown.current} align="start">
          <View style={[styles.ringWords, { maxWidth: wide ? 260 : 180 }]}>
            <Text maxFontSizeMultiplier={1.3} style={[styles.title, GLOW]}>{words.title}</Text>
            {shown.current !== 'link' && words.body ? <Text maxFontSizeMultiplier={1.4} style={[styles.body, GLOW]}>{words.body}</Text> : null}
            {!words.body ? <View style={styles.progressCentre}><Progress /></View> : null}
          </View>
        </Swap>
      </Animated.View>
    </Animated.View>
    <KeyboardAvoidingView style={styles.fill0} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.column, { paddingTop: insets.top + 12 }]}>
        <View style={styles.center} importantForAccessibility={phase === 'choose' ? 'auto' : 'no-hide-descendants'} accessibilityElementsHidden={phase !== 'choose'}>
          <Animated.View style={softly(away, true)}><KeepEveryHeadline start={fontReady} motion={motion} settled /></Animated.View>
        </View>
        <View style={[styles.actions, { paddingBottom: insets.bottom + 18, minHeight: 122 + insets.bottom + 18 }]}>
          <Swap id={phase}>
            {phase === 'choose' ? <View style={styles.stack}><ProviderButton provider="google" onPress={() => on('google')} /><ProviderButton provider="apple" onPress={() => on('apple')} /></View>
              : phase === 'link' ? <View style={styles.card}>
                <Text maxFontSizeMultiplier={1.4} style={styles.cardBody}>{words.body}</Text>
                <TextInput value={password} onChangeText={onPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="go"
                  onSubmitEditing={() => { if (password && !busy) on('connect'); }} editable={!busy}
                  placeholder="FoundKeep password" placeholderTextColor={INK.muted} style={styles.field} accessibilityLabel="FoundKeep password" />
                {passwordError ? <Text maxFontSizeMultiplier={1.4} style={styles.error} accessibilityLiveRegion="polite">{passwordError}</Text> : null}
                <View style={styles.row}>
                  <Pill label={busy ? 'Connecting…' : 'Connect'} tone="dark" disabled={!password || busy} onPress={() => on('connect')} grow />
                  <Pill label="Back" tone="ghost" disabled={busy} onPress={() => on('back')} />
                </View>
              </View>
              : <Actions phase={phase} provider={provider} on={on} />}
          </Swap>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

/** The buttons over the sky for a state (opening and signing in have none: there's nothing to do but wait). */
function Actions({ phase, provider, on }: { phase: HandoffPhase; provider: OAuthProvider | null; on: (action: HandoffAction) => void }) {
  if (phase === 'browser' && provider) return <View style={styles.stack}>
    <Pill label={`Open ${provider === 'apple' ? 'Apple' : 'Google'} again`} tone="light" onPress={() => on('reopen')} />
    <Pill label="Back" tone="veil" onPress={() => on('back')} />
  </View>;
  if (phase === 'failed') return <View style={styles.stack}>
    {provider ? <ProviderButton provider={provider} onPress={() => on('retry')} /> : null}
    <Pill label={provider ? 'Back' : 'Back to sign-in'} tone={provider ? 'veil' : 'light'} onPress={() => on('back')} />
  </View>;
  return null;
}

type PillTone = 'dark' | 'light' | 'ghost' | 'veil';
const PILL: Record<PillTone, { background: string; ink: string }> = {
  dark: { background: '#0b0c0d', ink: '#ffffff' }, light: { background: '#ffffff', ink: '#202020' },
  // veil: over the sky, a dim glass that reads on blue and on bright cloud alike.
  ghost: { background: 'transparent', ink: INK.ink }, veil: { background: 'rgba(10,30,55,0.34)', ink: '#ffffff' },
};
function Pill({ label, tone, onPress, grow = false, disabled = false }: { label: string; tone: PillTone; onPress: () => void; grow?: boolean; disabled?: boolean }) {
  const look = PILL[tone];
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }): StyleProp<ViewStyle> => [styles.pill, grow && styles.grow, { backgroundColor: look.background }, disabled && styles.disabled, pressed ? styles.pressed : null]}>
    <Text maxFontSizeMultiplier={1.3} style={[styles.pillLabel, { color: look.ink }]}>{label}</Text>
  </Pressable>;
}

function ProviderMark({ provider }: { provider: OAuthProvider | null }) {
  return <View style={styles.mark}>
    <Ionicons name={provider === 'apple' ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'log-in-outline'} size={28} color={INK.ink} />
  </View>;
}

/** A thin bar with a soft light moving along it: working, with no promise of how long. */
function Progress() {
  const motion = useMotionAllowed();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }));
    loop.start(); return () => loop.stop();
  }, [motion, t]);
  const width = 128, light = width * 0.36;
  return <View style={[styles.track, { width }]}>
    <Animated.View style={[styles.light, { width: light, opacity: motion ? 0.75 : 0, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-light, width] }) }] }]} />
  </View>;
}

/** A value that eases to wherever it is told to be (from `from`, the first time, when given). */
function useEased(to: number, duration: number, from?: number) {
  const motion = useMotionAllowed();
  const value = useRef(new Animated.Value(from ?? to)).current;
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

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', backgroundColor: '#1a78c8' },
  fill0: { flex: 1 },
  swap: { alignSelf: 'stretch' },
  column: { flexGrow: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 16, paddingBottom: 84 },
  actions: { paddingHorizontal: 20, justifyContent: 'flex-end' },
  stack: { gap: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  grow: { flexGrow: 1 },
  card: { backgroundColor: '#ffffff', borderRadius: 28, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  cardBody: { fontFamily: SF, fontSize: 15, lineHeight: 20, color: INK.muted, paddingHorizontal: 2 },
  field: { fontFamily: SF, minHeight: 50, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: INK.ink, backgroundColor: INK.field },
  error: { fontFamily: SF, fontSize: 14, lineHeight: 19, color: INK.error, paddingHorizontal: 2 },
  ringMiddle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ringStack: { alignSelf: 'stretch', alignItems: 'center', gap: 12 },
  ringWords: { alignSelf: 'center', alignItems: 'center', gap: 6 },
  title: { fontFamily: SF, fontSize: 19, lineHeight: 24, fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: -0.3 },
  body: { fontFamily: SF, fontSize: 14, lineHeight: 19, fontWeight: '500', color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  progressCentre: { alignItems: 'center', paddingTop: 16 },
  pill: { minHeight: 50, paddingHorizontal: 18, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  pillLabel: { fontFamily: SF, fontSize: 16, fontWeight: '600' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  disabled: { opacity: 0.5 },
  mark: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#06203a', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.28)' },
  light: { height: 4, borderRadius: 2, backgroundColor: '#ffffff' },
});
