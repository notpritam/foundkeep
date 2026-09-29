import { card, COLLECTIONS, PREVIEWS } from '../card.js';

export default {
  title: 'Extension/Add details card',
  render: args => card(args),
  args: { state: 'ready', type: 'save', folderId: 'f-reading', tags: ['Memory'], collectionId: '', preview: 'page', sync: 'synced' },
  argTypes: {
    state: { control: 'inline-radio', options: ['ready', 'loading', 'error', 'saving', 'unavailable'] },
    preview: { control: 'select', options: Object.keys(PREVIEWS) },
    sync: { control: 'inline-radio', options: ['synced', 'queued', 'failed', 'local'] },
    type: { control: 'inline-radio', options: ['save', 'note'] },
    folderId: { control: 'select', options: ['', 'f-reading', 'f-research', 'f-gone'] },
    tags: { control: 'object' },
    collectionId: { control: 'select', options: ['', ...COLLECTIONS.map(c => c.id)] },
    title: { control: 'text' }, note: { control: 'text' }, caption: { control: 'text' },
    shared: { table: { disable: true } }, open: { table: { disable: true } },
  },
  parameters: { layout: 'padded', docs: { description: { component: 'The card that opens from the dock after a save ("Add details") — the approved design. A Save preview of what you saved leads the card, with its Sync status in the corner when the save has not reached the library yet (click to retry or sign in). The title and note are edited in place, the folder and tags are pills, and My library, Share and Save details share the last line. Every choice opens a Listbox (listbox.js), never a native dropdown. Once shared, the Share pill names the collection, one caption line appears and the button is just Save. Live: pick, add, remove, share.' } } },
};

export const Ready = { name: 'Ready (a saved page)' };
export const Screenshot = { name: 'A region screenshot', args: { preview: 'region', title: 'The half-life of a good idea' } };
export const FullPage = { name: 'A full-page screenshot', args: { preview: 'fullpage' } };
export const PostOnX = { name: 'A post on X', args: { preview: 'post', title: 'Ada Kowalski (@adak) on X' } };
export const Highlight = { name: 'A highlight', args: { preview: 'highlight' } };
export const ImageSave = { name: 'An image', args: { preview: 'image', title: 'Forgetting curve with reviews' } };
export const PageWithoutCover = { name: 'A page without a cover', args: { preview: 'page-text' } };
export const WaitingToSync = { name: 'Waiting to sync', args: { preview: 'region', sync: 'queued' } };
export const DidNotSync = { name: 'Didn’t sync (click to retry)', args: { preview: 'region', sync: 'failed' } };
export const SignedOut = { name: 'Saved signed out (click to sign in)', args: { preview: 'post', sync: 'local' } };
export const NoteNotSynced = { name: 'A note that didn’t sync', args: { type: 'note', preview: 'note', sync: 'failed', title: 'Call notes', note: 'Ask Lena about the follow-up piece on forgetting curves.', folderId: '' } };
export const EmptyNote = { name: 'No note yet', args: { note: '', tags: [], folderId: '' } };
export const PickingAFolder = { name: 'Picking a folder', args: { open: 'folder' } };
export const AddingATag = { name: 'Adding a tag', args: { open: 'tags' } };
export const PickingACollection = { name: 'Picking a collection', args: { open: 'collection' } };
export const Sharing = { args: { collectionId: 'col-design', caption: 'The clearest case for spaced review I have read.' } };
export const AlreadyShared = { name: 'Already shared', args: { shared: { title: 'Design that works', status: 'pending' } } };
export const Note = { name: 'A saved note', args: { type: 'note', preview: 'note', title: 'Call notes', note: 'Ask Lena about the follow-up piece on forgetting curves.', folderId: '' } };
export const Loading = { args: { state: 'loading' } };
export const CouldNotLoadLists = { name: 'Folders could not load', args: { state: 'error' } };
export const Saving = { args: { state: 'saving' } };
export const UnavailableFolder = { name: 'Unavailable folder', args: { folderId: 'f-gone' } };
export const Unavailable = { name: 'Save unavailable', args: { state: 'unavailable', title: '' } };
