import { checkbox } from '../../card.js';
import { matrix, PSEUDO } from '../../matrix.js';

export default {
  title: 'Extension/Card controls/Checkbox',
  render: args => checkbox(args),
  args: { label: 'Include the saved image', checked: false, disabled: false },
  parameters: { surface: 'card', docs: { description: { component: '"Include the saved image" when sharing to a collection: a native 15px checkbox tinted with `accent-color`.' } } },
};
export const Unchecked = {};
export const Checked = { args: { checked: true } };
export const Focus = { parameters: { pseudo: { focus: true, focusVisible: true } } };
export const Disabled = { args: { disabled: true } };
export const AllStates = {
  name: 'All states · light & dark',
  render: args => matrix([
    { label: 'Unchecked', make: () => checkbox(args) }, { label: 'Checked', make: () => checkbox({ ...args, checked: true }) },
    { label: 'Focus', state: 'focus', make: () => checkbox(args) }, { label: 'Disabled', make: () => checkbox({ ...args, disabled: true }) },
  ], { width: 230 }),
  parameters: { surface: false, pseudo: PSEUDO },
};
