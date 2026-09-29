import { icon, onCard, node } from './shared.js';
import { matrix, PSEUDO } from '../../matrix.js';

const KINDS = {
  primary: label => `<button type="button" class="primary">${label}</button>`,
  retry: () => '<button type="button" class="text-button">Retry</button>',
  close: () => `<button type="button" class="icon-button" aria-label="Close without saving">${icon('close', 16)}</button>`,
};
const button = ({ kind = 'primary', label = 'Save details', disabled = false }) => { const el = node(KINDS[kind](label)); el.disabled = disabled; return el; };
export default {
  title: 'Extension/Card controls/Buttons',
  render: args => onCard(button(args)),
  args: { kind: 'primary', label: 'Save details', disabled: false },
  argTypes: { kind: { control: 'inline-radio', options: Object.keys(KINDS) }, label: { control: 'select', options: ['Save details', 'Save', 'Saving…', 'Creating folder…'] } },
  parameters: { docs: { description: { component: 'The card\'s buttons: the primary action (`.primary`, 36px, 10px radius; Save details, or Save once shared), Retry when folders could not load (`.text-button`), and Close (`.icon-button`, the card\'s only way out besides Esc).' } } },
};
export const SaveDetails = { name: 'Save details' };
export const SaveWhenShared = { name: 'Save (shared)', args: { label: 'Save' } };
export const Saving = { args: { label: 'Saving…', disabled: true } };
export const Retry = { args: { kind: 'retry' } };
export const Close = { args: { kind: 'close' } };
export const AllStates = {
  name: 'All states · light & dark',
  render: () => matrix([
    { label: 'Default', make: () => button({}) }, { label: 'Hover', state: 'hover', make: () => button({}) },
    { label: 'Focus', state: 'focus', make: () => button({}) }, { label: 'Pressed', state: 'pressed', make: () => button({}) },
    { label: 'Disabled', make: () => button({ disabled: true }) }, { label: 'Close hover', state: 'hover', make: () => button({ kind: 'close' }) },
  ], { width: 180 }),
  parameters: { controls: { disable: true }, pseudo: PSEUDO },
};
