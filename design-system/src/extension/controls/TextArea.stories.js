import { textArea, NOTE } from '../../card.js';
import { matrix, PSEUDO } from '../../matrix.js';

export default {
  title: 'Extension/Card controls/Text area',
  render: args => textArea(args),
  args: { label: 'Personal note', value: NOTE, placeholder: 'Why are you saving this?', rows: 3, disabled: false },
  argTypes: { rows: { control: { type: 'range', min: 2, max: 8 } } },
  parameters: { surface: 'card', docs: { description: { component: 'Personal note (and Note, for a saved note). The same `.field` styles as Title, 3 rows, resizable vertically.' } } },
};
export const Empty = { args: { value: '' } };
export const Filled = {};
export const Hover = { parameters: { pseudo: { hover: true } } };
export const Focus = { parameters: { pseudo: { focus: true } } };
export const Disabled = { args: { disabled: true } };
export const AllStates = {
  name: 'All states · light & dark',
  render: args => matrix([
    { label: 'Empty', make: () => textArea({ ...args, value: '' }) },
    { label: 'Filled', make: () => textArea(args) },
    { label: 'Hover', state: 'hover', make: () => textArea(args) },
    { label: 'Focus', state: 'focus', make: () => textArea(args) },
    { label: 'Disabled', make: () => textArea({ ...args, disabled: true }) },
  ]),
  parameters: { surface: false, pseudo: PSEUDO },
};
