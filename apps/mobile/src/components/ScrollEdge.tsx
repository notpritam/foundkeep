import { ProgressiveBlurView } from 'expo-backdrop';
import { StyleSheet } from 'react-native';
import { wash, type ScrollEdgeProps } from './scrollEdgeWash.ts';

/** The scroll edge (2026-10-02, after iOS 26 and Pritam's reference): what scrolls under
 * the top bar — or under the dock at the bottom — blurs, strongest at the edge and fading
 * away from it, with a light wash of the page colour; it fades in only once something is
 * under it. Native: expo-backdrop's ProgressiveBlurView, which finds the scroll view behind
 * it (public UIKit and Android APIs). The web draws it with CSS (ScrollEdge.web.tsx). */
export function ScrollEdge({ edge, height, color, hold = 0 }: ScrollEdgeProps) {
  return <ProgressiveBlurView edge={edge} intensity={edge === 'top' ? 60 : 45} startOffset={hold} tintColor={wash(color)} fallbackColor={color}
    style={[styles.edge, edge === 'top' ? { top: 0 } : { bottom: 0 }, { height }]} />;
}
const styles = StyleSheet.create({ edge: { position: 'absolute', left: 0, right: 0, pointerEvents: 'none' } });
