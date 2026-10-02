// Plays a screen's states on a loop for the design system, with the Mac
// pointer gliding in to tap where the first step is left (a button at the
// foot of the screen, by default Continue with Google).
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMotionAllowed } from '../../../apps/mobile/src/components/motion.tsx';

export function Playthrough<P extends string>({ steps, render, tap = 'google' }: { steps: [P, number][]; render: (phase: P) => ReactNode; tap?: 'google' | 'apple' }) {
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => { setStep(s => (s + 1) % steps.length); if (step === steps.length - 1) setRound(r => r + 1); }, steps[step][1]);
    return () => clearTimeout(timer);
  }, [step, steps]);
  return <View style={styles.fill}>{render(steps[step][0])}<TapPointer key={round} tap={tap} /></View>;
}

const ARROW = 'M2 1.5 L2 17.6 L6.1 13.8 L8.9 20.2 L11.7 19 L8.95 12.7 L14.6 12.7 Z';
/** The Mac pointer, gliding in to the Continue button and pressing it. */
export function TapPointer({ tap }: { tap: 'google' | 'apple' }) {
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
  // The Continue buttons sit at the foot of the screen: Google first, then Apple.
  const y = H - insets.bottom - 18 - 28 - (tap === 'google' ? 66 : 0);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, opacity: t.shown,
    transform: [{ translateX: t.glide.interpolate({ inputRange: [0, 1], outputRange: [W * 0.86, W / 2 + 36] }) }, { translateY: t.glide.interpolate({ inputRange: [0, 1], outputRange: [H * 0.62, y] }) }, { scale: t.press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.84] }) }] }}>
    {createElement('svg', { width: 20, height: 26, viewBox: '0 0 17 22', style: { display: 'block', overflow: 'visible', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' } },
      createElement('path', { d: ARROW, fill: '#111', stroke: '#fff', strokeWidth: 1.3, strokeLinejoin: 'round' }))}
  </Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, overflow: 'hidden' } });

/** The Mac pointer on a loop `length` ms long, gliding in and pressing at each tap's moment (x, y in the screen). */
export function PointerPath({ taps, length }: { taps: { x: number; y: number; at: number }[]; length: number }) {
  const { width: W, height: H } = useWindowDimensions();
  const motion = useMotionAllowed();
  const clock = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) return;
    const loop = Animated.loop(Animated.timing(clock, { toValue: length, duration: length, easing: Easing.linear, useNativeDriver: false }));
    loop.start(); return () => loop.stop();
  }, [motion, length, clock]);
  if (!motion || !taps.length) return null;
  const start = Math.max(0, taps[0].at - 1400), end = taps[taps.length - 1].at + 300;
  const points = [{ x: W * 0.86, y: H * 0.7, t: start }, ...taps.flatMap(tap => [{ x: tap.x, y: tap.y, t: tap.at - 160 }, { x: tap.x, y: tap.y, t: tap.at + 300 }])];
  const along = (pick: (p: { x: number; y: number }) => number) => clock.interpolate({ inputRange: points.map(p => p.t), outputRange: points.map(pick), extrapolate: 'clamp', easing: Easing.bezier(0.45, 0, 0.2, 1) });
  const press = clock.interpolate({ inputRange: taps.flatMap(tap => [tap.at - 60, tap.at + 40, tap.at + 180]), outputRange: taps.flatMap(() => [1, 0.84, 1]), extrapolate: 'clamp' });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, opacity: clock.interpolate({ inputRange: [start, start + 300, end + 400, end + 800], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
    transform: [{ translateX: along(p => p.x) }, { translateY: along(p => p.y) }, { scale: press }] }}>
    {createElement('svg', { width: 20, height: 26, viewBox: '0 0 17 22', style: { display: 'block', overflow: 'visible', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' } },
      createElement('path', { d: ARROW, fill: '#111', stroke: '#fff', strokeWidth: 1.3, strokeLinejoin: 'round' }))}
  </Animated.View>;
}
