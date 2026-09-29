import { icon, onCard, node } from './shared.js';
import { matrix, PSEUDO } from '../../matrix.js';

const chip = ({ name = 'Memory', disabled = false }) => {
  const el = node(`<button type="button" class="chip" aria-label="Remove tag ${name}"><span>${name}</span>${icon('close', 12)}</button>`);
  el.disabled = disabled; return el;
};
export default {
  title: 'Extension/Card controls/Tag chip',
  render: args => onCard(chip(args)),
  args: { name: 'Memory', disabled: false },
  parameters: { docs: { description: { component: 'A chosen tag (review.css `.chip`): the accent tint, fully round, with × to remove it. Tags are added from the + Tag pill\'s list.' } } },
};
export const Default = {};
export const LongName = { name: 'Long name', args: { name: 'Spaced repetition research' } };
export const AllStates = {
  name: 'All states · light & dark',
  render: () => matrix([
    { label: 'Default', make: () => chip({}) }, { label: 'Hover', state: 'hover', make: () => chip({}) },
    { label: 'Focus', state: 'focus', make: () => chip({}) }, { label: 'Disabled', make: () => chip({ disabled: true }) },
  ], { width: 180 }),
  parameters: { controls: { disable: true }, pseudo: PSEUDO },
};
