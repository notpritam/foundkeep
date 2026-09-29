import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DEVICES } from '../../simulator/devices.ts';
import { LiveDashboard } from '../../simulator/Live.tsx';

// Tagged live: it needs the demo services (deploy/demo), so the render check
// skips it and deploy/demo/smoke.mjs covers it.
const meta: Meta = { title: 'Live', tags: ['live'], parameters: { layout: 'fullscreen' } };
export default meta;
export const Dashboard: StoryObj = { name: 'Live dashboard', render: (_, { globals }) => <LiveDashboard device={DEVICES[globals.device] || DEVICES.desktop} dark={globals.theme === 'dark'} /> };
