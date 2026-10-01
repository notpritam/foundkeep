import { Composition } from 'remotion';
import { DURATION, FPS, SignInFilm, type FilmProps } from './SignInFilm.tsx';

// The sign-in window is 360 × 400 points; the films are three times that, for @3x screens.
// SignInFilm: the sky behind the phone lightly softened (version two, the light page).
// SignInFilmSoft: the sky much more blurred (version three, on the sky page).
export function Root() {
  return <>
    <Composition id="SignInFilm" component={SignInFilm} durationInFrames={DURATION} fps={FPS} width={1080} height={1200} defaultProps={{ skyBlur: 1.2 } satisfies FilmProps} />
    <Composition id="SignInFilmSoft" component={SignInFilm} durationInFrames={DURATION} fps={FPS} width={1080} height={1200} defaultProps={{ skyBlur: 14 } satisfies FilmProps} />
  </>;
}
