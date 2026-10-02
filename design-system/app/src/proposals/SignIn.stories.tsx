import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FilmScreen } from '../../../../apps/mobile/src/proposals/sign-in/FilmScreen.tsx';

// Version one (floating cards) won the X poll and is the app's sign-in screen
// now (Current/Sign-in). These are versions two and three — a film of
// FoundKeep at work in a window — kept for an A/B test later.
const meta: Meta = {
  title: 'Proposals/Sign in',
  parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} }, controls: { disable: true },
    docs: { description: { component: 'Versions two and three of the sign-in screen, kept for an A/B test against the one in the app. Press ↻ (Remount) to replay the entrance.' } } },
};
export default meta;
// Version two, after Pritam's reference: a light page, and a window playing a film of FoundKeep at work (design-system/film).
export const WithFilm: StoryObj = { name: 'With a film', render: () => <FilmScreen /> };
// Version three: version one's sky behind the whole page, and the film with its own sky far more blurred.
export const WithFilmOnSky: StoryObj = { name: 'With a film, on the sky', render: () => <FilmScreen page="sky" /> };
// Variations of the film versions, side by side in the design system's Sign in / Film variations.
export const FilmWhiteSoft: StoryObj = { name: 'Film variation · white page, soft film', render: () => <FilmScreen page="light" film="soft" /> };
export const FilmSkyClear: StoryObj = { name: 'Film variation · sky page, clear film', render: () => <FilmScreen page="sky" film="clear" /> };
export const FilmSkyBlur6: StoryObj = { name: 'Film variation · sky page blurred 6, soft film', render: () => <FilmScreen page="sky" film="soft" pageBlur={6} /> };
export const FilmSkyBlur14: StoryObj = { name: 'Film variation · sky page blurred 14, soft film', render: () => <FilmScreen page="sky" film="soft" pageBlur={14} /> };
