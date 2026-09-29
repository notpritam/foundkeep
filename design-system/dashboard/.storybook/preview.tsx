import type { Preview } from '@storybook/nextjs-vite';
import '../../../apps/site/app/global.css';
import '../../../apps/site/app/appearance.css';
import '../../../apps/site/app/interface.css';
import '../../../apps/site/app/customer.css';

const preview: Preview = {
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  decorators: [(Story, { globals }) => { document.documentElement.dataset.theme = globals.theme === 'dark' ? 'dark' : 'light'; return <Story />; }],
  initialGlobals: { theme: 'light' },
};
export default preview;
