import { Composition } from 'remotion';
import { DURATION, FPS, SignInFilm, type FilmProps } from './SignInFilm.tsx';
import { POLL, PollFilm, type PollProps } from './PollFilm.tsx';

// The sign-in window is 360 × 400 points. Each film comes at three times that
// for the app (1080 × 1200) and as a 4K master (3456 × 3840) to download;
// render.mjs makes the app's copies by downsampling the 4K masters, which keeps
// small text sharper than rendering small. SignInFilm: the sky lightly
// softened (the light page). SignInFilmSoft: the sky far more blurred (the sky page).
const films = [['SignInFilm', 1.2], ['SignInFilmSoft', 14]] as const;
export function Root() {
  return <>
    {/* The three shortlisted sign-in screens side by side on a moving gradient, no words (render with --public-dir pointing at the captures). */}
    <Composition id="SignInPoll" component={PollFilm} durationInFrames={POLL.frames} fps={POLL.fps} width={1920} height={1080} defaultProps={{ shape: 'wide', scale: 1 } satisfies PollProps} />
    <Composition id="SignInPoll4K" component={PollFilm} durationInFrames={POLL.frames} fps={POLL.fps} width={3840} height={2160} defaultProps={{ shape: 'wide', scale: 2 } satisfies PollProps} />
    {/* The same, tall, for Reels. */}
    <Composition id="SignInReel" component={PollFilm} durationInFrames={POLL.frames} fps={POLL.fps} width={1080} height={1920} defaultProps={{ shape: 'tall', scale: 1 } satisfies PollProps} />
    <Composition id="SignInReel4K" component={PollFilm} durationInFrames={POLL.frames} fps={POLL.fps} width={2160} height={3840} defaultProps={{ shape: 'tall', scale: 2 } satisfies PollProps} />
    {films.flatMap(([id, skyBlur]) => [
    <Composition key={id} id={id} component={SignInFilm} durationInFrames={DURATION} fps={FPS} width={1080} height={1200} defaultProps={{ skyBlur, scale: 3 } satisfies FilmProps} />,
    <Composition key={`${id}4K`} id={`${id}4K`} component={SignInFilm} durationInFrames={DURATION} fps={FPS} width={3456} height={3840} defaultProps={{ skyBlur, scale: 9.6 } satisfies FilmProps} />,
  ])}
  </>;
}
