import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DEVICES } from '../../simulator/devices.ts';
import { LiveApp } from '../../simulator/Live.tsx';

// Tagged live: it needs the demo services (deploy/demo), so the render check
// skips it and deploy/demo/smoke.mjs covers it.
const meta: Meta = { title: 'Live', tags: ['live'], parameters: { layout: 'fullscreen' } };
export default meta;
export const App: StoryObj = { name: 'Live app', render: (_, { globals }) => <LiveApp device={DEVICES[globals.device] || DEVICES['iphone-17-pro']} dark={globals.theme === 'dark'} /> };
