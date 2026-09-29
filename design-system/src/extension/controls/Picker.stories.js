import { card } from '../../card.js';

// The picker is shown inside the real card (review.css positions it there),
// opened from the pill that owns it.
export default {
  title: 'Extension/Card controls/List picker',
  render: args => card({ open: args.list, folderId: args.list === 'folder' ? 'f-reading' : '' }),
  args: { list: 'folder' },
  argTypes: { list: { control: 'inline-radio', options: ['folder', 'tags', 'collection'] } },
  parameters: { docs: { story: { inline: false, iframeHeight: 420 }, description: { component: 'FoundKeep\'s replacement for native dropdowns (picker.js): a search field, a check on what is chosen, headings and meta lines where they help, and a create row (New folder, Create “tag”). Under its pill when it fits, over it when that fits better, otherwise covering the card with the options scrolling. Typing filters, ↑/↓ move, Enter picks, Esc closes just the list.' } } },
};
export const Folders = {};
export const Tags = { args: { list: 'tags' } };
export const Collections = { args: { list: 'collection' } };
