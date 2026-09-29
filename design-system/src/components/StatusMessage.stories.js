import { frame } from './lib.js';
import { status } from './builders.js';

export default {
  title: 'Components/Status message',
  render: args => frame(status(args)),
  args: { text: 'Loading folders and collections…', tone: '' },
  argTypes: { tone: { control: 'inline-radio', options: ['', 'success', 'error'] } },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-status` — one line of feedback, hidden when empty. Default (muted), **success** and **error**. Errors say what went wrong and what to do next.' } } },
};
export const Neutral = {};
export const Success = { args: { text: 'Details saved', tone: 'success' } };
export const Error = { args: { text: 'Some folders or collections could not load. Retry, or save without them.', tone: 'error' } };
