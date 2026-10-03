// The app, start to finish, playing by itself (2026-10-03, for a video and a poll on X):
// sign in with Google → the cards gather while Google opens → the Library loads → search
// "ramen" → ask Kit "recent post I saved from twitter", then "about cats". The Mac pointer taps
// through it; the words are typed. One tour per Kit design (look), so each version can be judged
// on the whole flow. Frame-exact under a frozen clock, so scripts/capture-story.mjs can film it.
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DockProvider } from '../../../apps/mobile/src/components/FloatingDock.tsx';
import { useMotionAllowed } from '../../../apps/mobile/src/components/motion.tsx';
import { FirstScreen } from '../../../apps/mobile/src/sign-in/FirstScreen.tsx';
import { HandoffView } from '../../../apps/mobile/src/sign-in/Handoff.tsx';
import { KitProposal, type KitLook, type KitScript } from '../../../apps/mobile/src/proposals/kit/Kit.tsx';
import { PointerPath } from './Playthrough.tsx';

const Q1 = 'recent post I saved from twitter', Q2 = 'about cats';
/** The tour, in ms. */
export const TOUR = {
  tapGoogle: 2500, handoff: 2800, browser: 3500, finishing: 5100, loading: 6300, library: 7500,
  tapSearch: 9000, search: 9150, typeSearch: [9700, 10600], tapClose: 12100, closeSearch: 12250,
  tapKit: 13100, kit: 13250, tapField: 13800, type1: [14000, 16200], send1: 16450,
  tapField2: 18300, type2: [18500, 19300], send2: 19550, length: 23500,
};
const typed = (t: number, [from, to]: number[], words: string) => words.slice(0, Math.max(0, Math.min(words.length, Math.round(((t - from) / (to - from)) * words.length))));

export function AppTour({ look }: { look: KitLook }) {
  return <DockProvider><Tour look={look} /></DockProvider>;
}
function Tour({ look }: { look: KitLook }) {
  const motion = useMotionAllowed();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [t, setT] = useState(motion ? 0 : TOUR.length - 1);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!motion) { setT(TOUR.length - 1); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setT(elapsed % TOUR.length);
      setRound(Math.floor(elapsed / TOUR.length));
    }, 40);
    return () => clearInterval(timer);
  }, [motion]);

  // Where the pointer taps, on this screen size.
  const dockY = H - Math.max(insets.bottom, 12) - 30;
  const room = W - 32 - 2 * 70, tab = Math.min(118, (room - 12) / 2), tabs = tab * 2 + 12, row = tabs + 140;
  const kitX = 16 + (W - 32 - row) / 2 + tabs + 10 + 30;
  const fieldY = H - insets.bottom - 10 - 27, sendX = W - 39;
  const taps = [
    { x: W / 2 + 40, y: H - insets.bottom - 112, at: TOUR.tapGoogle },
    { x: W - 90, y: insets.top + 34, at: TOUR.tapSearch },
    { x: 32, y: insets.top + 26, at: TOUR.tapClose },
    { x: kitX, y: dockY, at: TOUR.tapKit },
    { x: W / 2, y: fieldY, at: TOUR.tapField },
    { x: sendX, y: fieldY, at: TOUR.send1 - 120 },
    { x: W / 2, y: fieldY, at: TOUR.tapField2 },
    { x: sendX, y: fieldY, at: TOUR.send2 - 120 },
  ];

  const script: KitScript = {
    loading: t < TOUR.library,
    searching: t >= TOUR.search && t < TOUR.closeSearch,
    query: typed(t, TOUR.typeSearch, 'ramen'),
    asking: t >= TOUR.kit,
    questions: t >= TOUR.send2 ? [Q1, Q2] : t >= TOUR.send1 ? [Q1] : [],
    draft: t < TOUR.send1 ? typed(t, TOUR.type1, Q1) : t < TOUR.send2 ? typed(t, TOUR.type2, Q2) : '',
  };
  return <View style={{ flex: 1, overflow: 'hidden' }}>
    {t < TOUR.handoff ? <FirstScreen key={`sign-in-${round}`} />
      : t < TOUR.loading ? <HandoffView key={`handoff-${round}`} enter phase={t < TOUR.browser ? 'opening' : t < TOUR.finishing ? 'browser' : 'finishing'} provider="google" on={() => {}} />
      : <KitProposal key={`app-${round}`} look={look} script={script} />}
    {motion ? <PointerPath key={round} taps={taps} length={TOUR.length} /> : null}
  </View>;
}
