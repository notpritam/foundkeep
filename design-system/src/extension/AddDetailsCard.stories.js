import { card } from '../card.js';

export default {
  title: 'Extension/Add details card',
  render: args => card(args),
  args: { state: 'prefilled', fullHeight: true },
  argTypes: { state: { control: 'inline-radio', options: ['prefilled', 'empty', 'new-folder', 'sharing', 'loading', 'error'] } },
  parameters: { layout: 'padded', docs: { description: { component: 'The card that opens from the dock after a save ("Add details"): review.html with its states applied the way review.js applies them. It is live — type, pick, add tags. In the extension it is framed 380px wide next to the dock, at most 600px tall with the fields scrolling — turn off *fullHeight* to see that.' } } },
};
export const PreFilled = { name: 'Pre-filled' };
export const Empty = { args: { state: 'empty' } };
export const NewFolder = { name: 'New folder', args: { state: 'new-folder' } };
export const SharingToCollection = { name: 'Sharing to a collection', args: { state: 'sharing' } };
export const Loading = { args: { state: 'loading' } };
export const Error = { args: { state: 'error' } };
export const AsFramed = { name: 'As framed (600px)', args: { state: 'sharing', fullHeight: false } };
