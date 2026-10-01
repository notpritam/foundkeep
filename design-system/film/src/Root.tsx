import { Composition } from 'remotion';
import { DURATION, FPS, SignInFilm } from './SignInFilm.tsx';

// The sign-in window is 360 × 400 points; the film is three times that, for @3x screens.
export function Root() {
  return <Composition id="SignInFilm" component={SignInFilm} durationInFrames={DURATION} fps={FPS} width={1080} height={1200} />;
}
