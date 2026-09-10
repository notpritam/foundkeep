import type { Animated } from 'react-native';

export const dockSpring = { stiffness: 330, damping: 34, mass: 1, overshootClamping: true, useNativeDriver: false };

export function createDockMotion(progress: Animated.Value, expandedWidth: number) {
  return {
    // Springs emit an overshooting frame before settling. Negative widths can
    // make Yoga lay out the full label again, so clamp the geometry as well.
    tabWidth: progress.interpolate({ inputRange: [0, 1], outputRange: [expandedWidth, 56], extrapolate: 'clamp' }),
    labelWidth: progress.interpolate({ inputRange: [0, 1], outputRange: [expandedWidth - 44, 0], extrapolate: 'clamp' }),
    // Hide text before the clip reaches zero; only the labels fade, never glass.
    labelOpacity: progress.interpolate({ inputRange: [0, .65, 1], outputRange: [1, 0, 0], extrapolate: 'clamp' }),
  };
}
