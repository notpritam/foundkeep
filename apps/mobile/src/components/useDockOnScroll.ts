import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { createScrollChrome } from '../collection/scrollChrome.ts';
import { useDock } from './FloatingDock.tsx';

/** For a scrolling screen: the dock tucks into its icons once you've scrolled `reach` down, and
 * opens again as you scroll back up (the Library's own rule, from collection/scrollChrome) —
 * for screens that don't hide a header of their own. Opens again when the screen goes. */
export function useDockOnScroll(reach = 120) {
  const { setCollapsed } = useDock();
  const chrome = useRef(createScrollChrome(reach)).current;
  const collapsed = useRef(false);
  // The reach can change (a header measured taller): the tracker must hide as far as it.
  useEffect(() => { chrome.resize(reach); }, [chrome, reach]);
  useEffect(() => () => setCollapsed(false), [setCollapsed]);
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const next = chrome.scroll(contentOffset.y, contentSize.height - layoutMeasurement.height) >= reach - 1;
    if (next !== collapsed.current) { collapsed.current = next; setCollapsed(next); }
  }, [chrome, reach, setCollapsed]);
}
