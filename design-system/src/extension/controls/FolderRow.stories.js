import { folderRow } from '../../card.js';

export default {
  title: 'Extension/Card controls/Folder row',
  render: args => folderRow(args),
  args: { newFolder: false, status: '' },
  argTypes: { status: { control: 'select', options: ['', 'Creating folder…'] } },
  parameters: { surface: 'card', docs: { description: { component: 'The Folder label with its quiet "New folder" button, the folder dropdown, and the inline new-folder form (a `--panel` box with its own field, a secondary Create button and a status line).' } } },
};
export const Default = {};
export const NewFolderOpen = { name: 'New folder open', args: { newFolder: true } };
export const Creating = { args: { newFolder: true, status: 'Creating folder…' } };
