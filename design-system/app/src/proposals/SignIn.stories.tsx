import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FirstScreen as Screen } from '../../../../apps/mobile/src/proposals/sign-in/FirstScreen.tsx';

// Locked 2026-10-01: the Cumulus sky (blur 1), "Keep Every" in SF Pro with the
// word in Caveat, tilted, "All in one place, ready for your agent.", and the
// Apple and Google buttons, with GPT-6 Astra's objects (choices and movement:
// Proposals/Sign-in elements).
const meta: Meta = {
  title: 'Proposals/Sign in',
  parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} }, controls: { disable: true },
    docs: { description: { component: 'The first screen, locked: no logo, no email option; the words are the design. Press ↻ (Remount) to replay the entrance.' } } },
};
export default meta;
export const FirstScreen: StoryObj = { name: 'First screen', render: () => <Screen /> };
