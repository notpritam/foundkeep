import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FirstScreen as Screen } from '../../../../apps/mobile/src/proposals/sign-in/FirstScreen.tsx';
import { FilmScreen } from '../../../../apps/mobile/src/proposals/sign-in/FilmScreen.tsx';

// Locked 2026-10-01: the Cumulus sky (blur 1), "Keep Every" in SF Pro with the
// word in Caveat, tilted, "All in one place, ready for your agent.", and the
// Apple and Google buttons, with floating cards (GPT-6 Astra). Movement is the
// last open choice: Proposals/Sign-in movement.
const meta: Meta = {
  title: 'Proposals/Sign in',
  parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} }, controls: { disable: true },
    docs: { description: { component: 'The first screen, locked: no logo, no email option; the words are the design. Press ↻ (Remount) to replay the entrance.' } } },
};
export default meta;
export const FirstScreen: StoryObj = { name: 'First screen', render: () => <Screen /> };
// A second version after Pritam's reference: a light page, and a window playing a film of FoundKeep at work (design-system/film).
export const WithFilm: StoryObj = { name: 'With a film', render: () => <FilmScreen /> };
// Version three: version one's sky behind the whole page, and the film with its own sky far more blurred.
export const WithFilmOnSky: StoryObj = { name: 'With a film, on the sky', render: () => <FilmScreen page="sky" /> };
// Variations of the film versions, side by side in the design system's Sign in / Film variations.
export const FilmWhiteSoft: StoryObj = { name: 'Film variation · white page, soft film', render: () => <FilmScreen page="light" film="soft" /> };
export const FilmSkyClear: StoryObj = { name: 'Film variation · sky page, clear film', render: () => <FilmScreen page="sky" film="clear" /> };
export const FilmSkyBlur6: StoryObj = { name: 'Film variation · sky page blurred 6, soft film', render: () => <FilmScreen page="sky" film="soft" pageBlur={6} /> };
export const FilmSkyBlur14: StoryObj = { name: 'Film variation · sky page blurred 14, soft film', render: () => <FilmScreen page="sky" film="soft" pageBlur={14} /> };
