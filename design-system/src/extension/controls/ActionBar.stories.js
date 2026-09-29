import { actionBar } from '../../card.js';

export default {
  title: 'Extension/Card controls/Action bar',
  render: args => actionBar(args),
  args: { state: 'ready', saveLabel: 'Save details' },
  argTypes: {
    state: { control: 'inline-radio', options: ['ready', 'unchanged', 'saving', 'error'] },
    saveLabel: { control: 'select', options: ['Save details', 'Save and share', 'Save and submit for approval'] },
  },
  parameters: { docs: { description: { component: 'The card footer from review.html: a status line above Retry (when options failed), Cancel and Save details, which fills the rest of the row.' } } },
};
export const Ready = {};
export const NotChangedYet = { name: 'Not changed yet', args: { state: 'unchanged' } };
export const Saving = { args: { state: 'saving' } };
export const Error = { args: { state: 'error' } };
export const Sharing = { args: { saveLabel: 'Save and submit for approval' } };
