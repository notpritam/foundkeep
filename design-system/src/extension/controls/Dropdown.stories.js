import { dropdown, FOLDERS, COLLECTIONS } from '../../card.js';
import { matrix, PSEUDO } from '../../matrix.js';

export default {
  title: 'Extension/Card controls/Dropdown',
  render: args => dropdown(args),
  args: { kind: 'folder', value: '', disabled: false, unavailable: false },
  argTypes: {
    kind: { control: 'inline-radio', options: ['folder', 'collection'] },
    value: { control: 'select', options: ['', ...FOLDERS, ...COLLECTIONS.map(c => c.title)] },
  },
  parameters: { surface: 'card', docs: { description: { component: 'Folder and "Share to a collection" are native `<select>`s with **no FoundKeep styling**: `.field` only styles `input` and `textarea`, so the border, radius, height and arrow are the browser\'s, and the open list is the operating system\'s menu (click one here to see it). Matching the design system means replacing it with our own listbox.' } } },
};
export const Default = {};
export const Selected = { args: { value: 'Reading list' } };
export const Hover = { parameters: { pseudo: { hover: true } } };
export const Focus = { parameters: { pseudo: { focus: true } } };
export const Disabled = { args: { disabled: true } };
export const UnavailableFolder = { name: 'Unavailable folder', args: { unavailable: true } };
export const Collection = { args: { kind: 'collection' } };
export const AllStates = {
  name: 'All states · light & dark',
  render: args => matrix([
    { label: 'Default', make: () => dropdown(args) },
    { label: 'Selected', make: () => dropdown({ ...args, value: 'Reading list' }) },
    { label: 'Hover', state: 'hover', make: () => dropdown(args) },
    { label: 'Focus', state: 'focus', make: () => dropdown(args) },
    { label: 'Disabled', make: () => dropdown({ ...args, disabled: true }) },
    { label: 'Collection', make: () => dropdown({ kind: 'collection' }) },
  ]),
  parameters: { surface: false, pseudo: PSEUDO },
};
