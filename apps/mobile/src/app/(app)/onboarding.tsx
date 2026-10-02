import { router } from 'expo-router';
import { useEffect } from 'react';
import { firstRun } from '../../first-run/deviceFlags.ts';
import { WatchItHappen } from '../../first-run/WatchItHappen.tsx';

// First run, and the guide to saving from other apps (Settings, the empty
// library): "Save from any app", shown by watching it happen. Provisional
// until Pritam's recording of the real flow — see first-run/WatchItHappen.tsx.
export default function SaveFromAnyApp() {
  useEffect(() => { void firstRun.seen(); }, []);
  return <WatchItHappen onDone={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/collection'))} />;
}
