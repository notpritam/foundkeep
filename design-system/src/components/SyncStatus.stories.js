import { specimens } from './lib.js';
import { renderSyncStatus } from '../../../apps/extension/src/save-preview.js';

const status = ({ state = 'failed' }) => renderSyncStatus(state);
export default {
  title: 'Components/Sync status',
  render: args => status(args),
  args: { state: 'failed' },
  argTypes: { state: { control: 'inline-radio', options: ['queued', 'failed', 'local', 'synced'] } },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-sync` (save-preview.js) — whether a save has reached the library, as one icon button. **queued** turns while it waits; **failed** is red and retries when clicked; **local** (saved signed out) opens sign-in when clicked; **synced** shows a check, then leaves. Its tooltip names the state. On the Add details card it sits in the Save preview\'s corner (`--overlay`), or beside Close when there is no preview.' } } },
};
export const Playground = {};
export const EveryState = { name: 'Every state', render: () => specimens(['queued', 'failed', 'local', 'synced'].map(state => [state, status({ state })])), parameters: { controls: { disable: true } } };
export const Hover = { name: 'Failed, on hover', args: { state: 'failed' }, parameters: { pseudo: { hover: true } } };
