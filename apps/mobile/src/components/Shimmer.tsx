import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AdaptiveText as Text } from './AdaptiveText.tsx';
import { useFocusEffect } from 'expo-router';
import { colors, palettes } from '../theme.ts';
import { useMotionAllowed } from './motion.tsx';
import { useAppearance, useThemedStyles } from '../appearance/AppearanceProvider.tsx';

/** Transform-only light sweep; stops when hidden, backgrounded or Reduce Motion is on. */
export function Shimmer({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(baseStyles);
  const allowed = useMotionAllowed();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const phase = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    phase.setValue(0);
    if (!allowed || !focused || !width) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(phase, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.delay(350),
    ]));
    animation.start();
    return () => animation.stop();
  }, [allowed, focused, phase, width]);
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.base, style]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {children}
    {allowed && focused && width > 0 ? <Animated.View pointerEvents="none" style={[styles.sweep, { width: width * .55, transform: [{ translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [-width * .6, width * 1.6] }) }, { skewX: '-14deg' }] }]}>
      {[.02, .05, .1, .16, .1, .05, .02].map((opacity, index) => <View key={index} style={{ flex: 1, backgroundColor: '#FFFFFF', opacity }} />)}
    </Animated.View> : null}
  </View>;
}
/** Words with a soft light sweeping along them, like “Thinking…” — for a save whose details
 * are being prepared (Pritam, 2026-10-02). Narrow windows onto a brighter copy of the words
 * travel across them, each a little nearer the base colour towards its edges — solid colours,
 * never faded text, so the words keep their contrast throughout; no mask needed, so it reads the
 * same on the phone and the web. Stops when hidden, backgrounded or Reduce Motion is on. */
export function ShimmerText({ children, style, color, highlight }: { children: string; style?: StyleProp<TextStyle>; color: string; highlight: string }) {
  const allowed = useMotionAllowed();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const phase = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    phase.setValue(0);
    if (!allowed || !focused || !width) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(phase, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.delay(250),
    ]));
    animation.start();
    return () => animation.stop();
  }, [allowed, focused, phase, width]);
  const slice = Math.max(6, width * 0.07);
  const travel = phase.interpolate({ inputRange: [0, 1], outputRange: [-slice * 5, width + slice * 5] });
  return <View accessible accessibilityLabel={children} style={baseStyles.words} onLayout={event => setWidth(Math.ceil(event.nativeEvent.layout.width))}>
    <Text numberOfLines={1} style={[style, { color }]}>{children}</Text>
    {allowed && focused && width > 0 ? [.25, .55, .85, 1, .85, .55, .25].map((amount, index) => {
      const at = Animated.add(travel, (index - 3) * slice);
      return <Animated.View key={index} pointerEvents="none" style={[baseStyles.slice, { width: slice, transform: [{ translateX: at }] }]}>
        <Animated.View style={{ width, transform: [{ translateX: Animated.multiply(at, -1) }] }}><Text numberOfLines={1} style={[style, { color: mix(color, highlight, amount) }]}>{children}</Text></Animated.View>
      </Animated.View>;
    }) : null}
  </View>;
}
/** `from` moved `amount` of the way to `to` (#rrggbb colours; anything else gives `to`). */
export function mix(from: string, to: string, amount: number) {
  const hex = /^#([0-9a-f]{6})$/i;
  const a = hex.exec(from)?.[1], b = hex.exec(to)?.[1];
  if (!a || !b) return to;
  const channel = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}
export function GallerySkeleton({ columns, viewportHeight }: { columns: number; viewportHeight: number }) {
  const styles = useThemedStyles(baseStyles);
  const palette = palettes[useAppearance().scheme];
  const { width } = useWindowDimensions();
  const cardHeight = ((width - 36) / columns - 6) / 1.25 + 87;
  const rows = Math.max(1, Math.ceil(viewportHeight / cardHeight));
  return <View accessibilityLabel="Loading your collection" accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.grid}>
    {Array.from({ length: columns * rows }, (_, index) => <View key={index} style={{ width: columns === 1 ? '100%' : '48%' }}>
      <Shimmer style={styles.card}>
        <View style={{ aspectRatio: 1.25, backgroundColor: palette.line }} />
        <View style={styles.copy}><View style={[styles.line, { width: '48%', height: 9 }]} /><View style={styles.line} /><View style={[styles.line, { width: '72%' }]} /></View>
      </Shimmer>
    </View>)}
  </View>;
}
const baseStyles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: colors.accentSoft }, sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  card: { borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  copy: { padding: 14, gap: 12 }, line: { height: 14, width: '90%', borderRadius: 3, backgroundColor: colors.line },
  words: { alignSelf: 'flex-start', overflow: 'hidden' }, slice: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
});
