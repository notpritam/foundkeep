import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { screenReaderOn } from './screenReader.ts';

/** Whether a screen reader is on, kept up to date (off on the web: see screenReaderOn). */
export function useScreenReader() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    void screenReaderOn(Platform.OS, () => AccessibilityInfo.isScreenReaderEnabled()).then(value => { if (live) setOn(value); });
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => { live = false; listener.remove(); };
  }, []);
  return on;
}
