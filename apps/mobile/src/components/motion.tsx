import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

const MotionContext = createContext(false);
export function MotionProvider({ children }: { children: ReactNode }) {
  // Start still until the device preference is known.
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); }).catch(() => {});
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const state = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => { live = false; preference.remove(); state.remove(); };
  }, []);
  return <MotionContext.Provider value={!reduced && active}>{children}</MotionContext.Provider>;
}
export const useMotionAllowed = () => useContext(MotionContext);

/** A non-visible list item must not keep an animation running. */
export function MotionBoundary({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const parent = useMotionAllowed();
  return <MotionContext.Provider value={parent && enabled}>{children}</MotionContext.Provider>;
}
