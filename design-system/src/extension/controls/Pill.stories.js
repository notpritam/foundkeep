import { icon, onCard, node } from './shared.js';
import { matrix, PSEUDO } from '../../matrix.js';

const PILLS = {
  folder: () => `<button type="button" class="pill" aria-haspopup="listbox">${icon('folder', 15)}<span>Reading list</span>${icon('chevron', 14)}</button>`,
  'add-tag': () => `<button type="button" class="pill ghost" aria-haspopup="listbox">${icon('plus', 14)}<span>Tag</span></button>`,
  library: () => `<span class="pill static">${icon('library', 15)}<span>My library</span></span>`,
  share: () => `<button type="button" class="pill ghost" aria-haspopup="listbox">${icon('collection', 15)}<span>Share</span></button>`,
  shared: () => `<button type="button" class="pill" aria-haspopup="listbox">${icon('globe', 15)}<span>Design that works</span></button>`,
  unavailable: () => `<button type="button" class="pill unavailable" aria-haspopup="listbox">${icon('folder', 15)}<span>Unavailable folder</span>${icon('chevron', 14)}</button>`,
};
const pill = ({ kind = 'folder', disabled = false, open = false }) => {
  const el = node(PILLS[kind]());
  if (disabled && el.tagName === 'BUTTON') el.disabled = true;
  if (open) el.setAttribute('aria-expanded', 'true');
  return el;
};

export default {
  title: 'Extension/Card controls/Pill',
  render: args => onCard(pill(args)),
  args: { kind: 'folder', disabled: false, open: false },
  argTypes: { kind: { control: 'select', options: Object.keys(PILLS) } },
  parameters: { docs: { description: { component: 'The card\'s pills (review.css `.pill`): 30px, fully round, 12.5px/500. Solid for a value (the folder, a chosen collection), dashed for an action that is not used yet (+ Tag, Share), tinted for where the save lives (My library). They open the list picker; open, they take the hover fill.' } } },
};
export const Folder = {};
export const AddTag = { name: '+ Tag', args: { kind: 'add-tag' } };
export const MyLibrary = { name: 'My library', args: { kind: 'library' } };
export const Share = { args: { kind: 'share' } };
export const SharedToACollection = { name: 'Shared to a collection', args: { kind: 'shared' } };
export const UnavailableFolder = { name: 'Unavailable folder', args: { kind: 'unavailable' } };
export const AllKinds = {
  name: 'All kinds · light & dark',
  render: () => matrix(Object.keys(PILLS).map(kind => ({ label: kind.replace('-', ' '), make: () => pill({ kind }) })), { width: 240 }),
  parameters: { controls: { disable: true } },
};
export const AllStates = {
  name: 'All states · light & dark',
  render: () => matrix([
    { label: 'Default', make: () => pill({}) }, { label: 'Hover', state: 'hover', make: () => pill({}) },
    { label: 'Focus', state: 'focus', make: () => pill({}) }, { label: 'Open', make: () => pill({ open: true }) },
    { label: 'Disabled', make: () => pill({ disabled: true }) },
  ], { width: 220 }),
  parameters: { controls: { disable: true }, pseudo: PSEUDO },
};
