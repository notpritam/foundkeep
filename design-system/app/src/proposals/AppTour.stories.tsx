import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { AppTour } from '../AppTour.tsx';
import type { KitLook } from '../../../../apps/mobile/src/proposals/kit/Kit.tsx';

// The app, start to finish, playing by itself (2026-10-03) — one tour per Kit design, for the video
// and the poll on X. Board: App tour / Four versions. Filmed with scripts/capture-story.mjs.
const meta: Meta = { title: 'Proposals/App tour', parameters: { simulator: true, layout: 'fullscreen', controls: { disable: true }, route: { pathname: '/sign-in', params: {} } } };
// Signed in throughout: the sign-in screen doesn't mind, and the Library needs it to load pictures.
export default meta;
type Story = StoryObj;
const tour = (look: KitLook): Story => ({ render: () => <AppTour look={look} /> });
export const Conversation: Story = { name: '1 · A conversation (as locked)', ...tour('locked') };
export const Grid: Story = { name: '2 · Answers laid out like the Library', ...tour('grid') };
export const Half: Story = { name: '3 · A half sheet; the Library is the answer', ...tour('half') };
export const Trail: Story = { name: '4 · What Kit understood, as chips', ...tour('trail') };
