// expo-backdrop is a native module (iOS and Android only). Its own types arrive with the
// package wherever the app's dependencies are installed (EAS, a Mac checkout); this stands
// in where they aren't — the design worktree shares node_modules and never installs into it.
declare module 'expo-backdrop' {
  import type { ComponentType } from 'react';
  import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
  export type ProgressiveBlurEdge = 'top' | 'bottom' | 'left' | 'right';
  export type ProgressiveBlurViewProps = {
    edge?: ProgressiveBlurEdge; intensity?: number; startOffset?: number; tint?: string;
    tintColor?: ColorValue; scrollFallback?: boolean; fallbackColor?: ColorValue; style?: StyleProp<ViewStyle>;
  };
  export const ProgressiveBlurView: ComponentType<ProgressiveBlurViewProps>;
}
