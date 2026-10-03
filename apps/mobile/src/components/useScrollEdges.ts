import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDock } from './FloatingDock.tsx';

/** Where a screen's scroll edges sit (after Pritam's reference, 2026-10-02): at the top, full
 * strength over the status bar and the top bar, clearing in a short strip just below it (EDGE_FADE —
 * screens leave that strip clear when at rest, so nothing sits blurred until it scrolls); at the bottom,
 * starting at the dock's middle — what's above the dock stays sharp — and strongest at the
 * bottom edge. bar: the height of the screen's top bar, below the status bar. */
export const EDGE_FADE = 8;
export function useScrollEdges(bar: number) {
  const insets = useSafeAreaInsets();
  const { bottomSpace, height } = useDock();
  const dockBottom = bottomSpace - height - 24;
  const top = insets.top + bar + EDGE_FADE, bottom = dockBottom + height / 2 + 10;
  return {
    top: { height: top, hold: (insets.top + bar) / top },
    bottom: { height: bottom, hold: dockBottom / bottom },
  };
}
