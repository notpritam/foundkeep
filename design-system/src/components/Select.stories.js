import { ICON_NAMES, specimens, groups, frame } from './lib.js';
import { select, withListbox } from './builders.js';
import { matrix, PSEUDO } from '../matrix.js';

export default {
  title: 'Components/Select',
  render: args => args.variant === 'field' ? frame(select(args)) : select(args),
  args: { value: 'Reading list', icon: 'folder', variant: 'pill', chevron: true, empty: false, invalid: false, open: false, disabled: false },
  argTypes: { variant: { control: 'inline-radio', options: ['pill', 'field'] }, icon: { control: 'select', options: ICON_NAMES } },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-select` — the trigger that opens a **Listbox**. It shows the chosen value; with nothing chosen (`data-empty`) it reads as an invitation, dashed and muted. **pill** sits inline with other pills (the folder, Share); **field** is full width like a text field. `aria-invalid` marks a value that is no longer valid (an unavailable folder).' } } },
};

export const Playground = {};
export const Variants = {
  render: () => groups([
    ['Pill', specimens([['a value', select({})], ['nothing chosen', select({ value: 'Share', icon: 'collection', chevron: false, empty: true })], ['invalid', select({ value: 'Unavailable folder', invalid: true })]])],
    ['Field', frame(select({ variant: 'field' }))],
  ]),
  parameters: { controls: { disable: true } },
};
export const InTheExtension = {
  name: 'In the extension',
  render: () => specimens([
    ['Folder', select({})], ['Share, nothing chosen', select({ value: 'Share', icon: 'collection', chevron: false, empty: true })],
    ['Shared to a collection', select({ value: 'Design that works', icon: 'globe', chevron: false })],
    ['Unavailable folder', select({ value: 'Unavailable folder', invalid: true })],
  ]),
  parameters: { controls: { disable: true } },
};
export const Open = { name: 'Open, with its Listbox', render: () => withListbox({}), parameters: { layout: 'padded', controls: { disable: true } } };
export const States = {
  name: 'States · light & dark',
  render: () => matrix([
    { label: 'Default', make: () => select({}) }, { label: 'Hover', state: 'hover', make: () => select({}) },
    { label: 'Focus', state: 'focus', make: () => select({}) }, { label: 'Open', make: () => select({ open: true }) },
    { label: 'Nothing chosen', make: () => select({ value: 'Share', icon: 'collection', chevron: false, empty: true }) },
    { label: 'Invalid', make: () => select({ value: 'Unavailable folder', invalid: true }) },
  ], { width: 200 }),
  parameters: { layout: 'padded', controls: { disable: true }, pseudo: PSEUDO },
};
