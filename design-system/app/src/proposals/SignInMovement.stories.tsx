import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FirstScreen as Screen } from '../../../../apps/mobile/src/proposals/sign-in/FirstScreen.tsx';

// How the floating cards keep moving on the locked first screen (2026-10-01):
// the last open choice on it. Side by side: Sign in / Movement on the page.
const meta: Meta = { title: 'Proposals/Sign-in movement', parameters: { controls: { disable: true }, simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} } } };
export default meta;
type Story = StoryObj;
export const Drift: Story = { name: 'Drift (today)', render: () => <Screen movement="drift" /> };
export const Spotlight: Story = { name: 'Spotlight on the word', render: () => <Screen movement="spotlight" /> };
export const Orbit: Story = { name: 'Orbit', render: () => <Screen movement="orbit" /> };
export const Bob: Story = { name: 'Bob and sway', render: () => <Screen movement="bob" /> };
export const Rise: Story = { name: 'Rise like bubbles', render: () => <Screen movement="rise" /> };
