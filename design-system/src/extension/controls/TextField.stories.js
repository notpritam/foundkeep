import { textField, TITLE } from '../../card.js';
import { matrix, PSEUDO } from '../../matrix.js';

export default {
  title: 'Extension/Card controls/Text field',
  render: args => textField(args),
  args: { label: 'Title', value: TITLE, placeholder: 'Give this save a useful name', disabled: false },
  parameters: { surface: 'card', docs: { description: { component: 'The Title field of the Add details card (review.html). theme.css `.field input`: 1px `--line` border, 6px radius, `--bg` fill, 10×12 padding; focus is a 2px `--accent` outline 2px out. The label is the field\'s own 14px `--ink` text.' } } },
};
export const Empty = { args: { value: '' } };
export const Filled = {};
export const Hover = { parameters: { pseudo: { hover: true } } };
export const Focus = { parameters: { pseudo: { focus: true } } };
export const Disabled = { args: { disabled: true } };
export const AllStates = {
  name: 'All states · light & dark',
  render: args => matrix([
    { label: 'Empty', make: () => textField({ ...args, value: '' }) },
    { label: 'Filled', make: () => textField(args) },
    { label: 'Hover', state: 'hover', make: () => textField(args) },
    { label: 'Focus', state: 'focus', make: () => textField(args) },
    { label: 'Disabled', make: () => textField({ ...args, disabled: true }) },
  ]),
  parameters: { surface: false, layout: 'padded', pseudo: PSEUDO },
};
