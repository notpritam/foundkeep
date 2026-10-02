import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDock } from './FloatingDock.tsx';

/** Where a screen's scroll edges sit (after Pritam's reference, 2026-10-02): at the top, full
 * strength over the status bar and the top bar, clearing in a short strip just below it; at the bottom,
 * starting at the dock's middle — what's above the dock stays sharp — and strongest at the
 * bottom edge. bar: the height of the screen's top bar, below the status bar. */
export function useScrollEdges(bar: number) {
  const insets = useSafeAreaInsets();
  const { bottomSpace, height } = useDock();
  const dockBottom = bottomSpace - height - 24;
  const top = insets.top + bar + 14, bottom = dockBottom + height / 2 + 10;
  return {
    top: { height: top, hold: (insets.top + bar - 2) / top },
    bottom: { height: bottom, hold: dockBottom / bottom },
  };
}
