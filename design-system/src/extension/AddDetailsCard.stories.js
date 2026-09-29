import { card, COLLECTIONS } from '../card.js';

export default {
  title: 'Extension/Add details card',
  render: args => card(args),
  args: { state: 'ready', type: 'save', folderId: 'f-reading', tags: ['Memory'], collectionId: '' },
  argTypes: {
    state: { control: 'inline-radio', options: ['ready', 'loading', 'error', 'saving', 'unavailable'] },
    type: { control: 'inline-radio', options: ['save', 'note'] },
    folderId: { control: 'select', options: ['', 'f-reading', 'f-research', 'f-gone'] },
    tags: { control: 'object' },
    collectionId: { control: 'select', options: ['', ...COLLECTIONS.map(c => c.id)] },
    title: { control: 'text' }, note: { control: 'text' }, caption: { control: 'text' },
    shared: { table: { disable: true } }, open: { table: { disable: true } },
  },
  parameters: { layout: 'padded', docs: { description: { component: 'The card that opens from the dock after a save ("Add details") — the approved design. The title and note are edited in place, the folder and tags are pills, and My library, Share and Save details share the last line; nothing sits above the title. Every choice opens FoundKeep\'s list picker (picker.js), never a native dropdown. Once shared, the Share pill names the collection, one caption line appears and the button is just Save. Live: pick, add, remove, share.' } } },
};

export const Ready = {};
export const EmptyNote = { name: 'No note yet', args: { note: '', tags: [], folderId: '' } };
export const PickingAFolder = { name: 'Picking a folder', args: { open: 'folder' } };
export const AddingATag = { name: 'Adding a tag', args: { open: 'tags' } };
export const PickingACollection = { name: 'Picking a collection', args: { open: 'collection' } };
export const Sharing = { args: { collectionId: 'col-design', caption: 'The clearest case for spaced review I have read.' } };
export const AlreadyShared = { name: 'Already shared', args: { shared: { title: 'Design that works', status: 'pending' } } };
export const Note = { name: 'A saved note', args: { type: 'note', title: 'Call notes', note: 'Ask Lena about the follow-up piece on forgetting curves.', folderId: '' } };
export const Loading = { args: { state: 'loading' } };
export const CouldNotLoadLists = { name: 'Folders could not load', args: { state: 'error' } };
export const Saving = { args: { state: 'saving' } };
export const UnavailableFolder = { name: 'Unavailable folder', args: { folderId: 'f-gone' } };
export const Unavailable = { name: 'Save unavailable', args: { state: 'unavailable', title: '' } };
