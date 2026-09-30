import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FirstScreen } from '../../../../apps/mobile/src/proposals/sign-in/FirstScreen.tsx';

const meta: Meta = {
  title: 'Proposals/Sign in',
  parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} },
    docs: { description: { component: 'The first screen, after the reference Pritam saved (3D objects fly in around a centred headline; the sign-in buttons rise last). Three looks, one choreography. Press ↻ (Remount) in the toolbar to replay the entrance; the Motion switch shows it with reduced motion. Compare with Current / Sign-in / Sign in.' } } },
};
export default meta;
type Story = StoryObj;
export const Sky: Story = { name: 'A · Sky', render: () => <FirstScreen look="sky" /> };
export const Meadow: Story = { name: 'B · Meadow', render: () => <FirstScreen look="meadow" /> };
export const Paper: Story = { name: 'C · Paper (follows light and dark)', render: () => <FirstScreen look="paper" /> };
export const SkyEmail: Story = { name: 'A · Sky, continuing with email', render: () => <FirstScreen look="sky" emailOpen />, parameters: { keyboard: true } };
