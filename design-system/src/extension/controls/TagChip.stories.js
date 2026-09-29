import { tagChip } from '../../card.js';
import { matrix, PSEUDO } from '../../matrix.js';

export default {
  title: 'Extension/Card controls/Tag chip',
  render: args => tagChip(args),
  args: { name: 'Read later', chosen: false },
  parameters: { surface: 'card', docs: { description: { component: 'Suggested tags (`+ name`) and chosen tags (`name ×`). review.css `.save-tag-chip`: 8px radius, 11px text, 6×9 padding; hover turns border and text `--accent`; chosen adds an `--accent-bg` fill. Focus is the generic button ring (2px `--accent`, 4px out), which reads large on an 11px chip.' } } },
};
export const Suggested = {};
export const SuggestedHover = { name: 'Suggested · hover', parameters: { pseudo: { hover: true } } };
export const Chosen = { args: { name: 'Memory', chosen: true } };
export const ChosenHover = { name: 'Chosen · hover', args: { name: 'Memory', chosen: true }, parameters: { pseudo: { hover: true } } };
export const Focus = { args: { name: 'Memory', chosen: true }, parameters: { pseudo: { focusVisible: true } } };
export const AllStates = {
  name: 'All states · light & dark',
  render: () => matrix([
    { label: 'Suggested', make: () => tagChip({}) }, { label: 'Suggested hover', state: 'hover', make: () => tagChip({}) },
    { label: 'Suggested focus', state: 'focus', make: () => tagChip({}) }, { label: 'Chosen', make: () => tagChip({ name: 'Memory', chosen: true }) },
    { label: 'Chosen hover', state: 'hover', make: () => tagChip({ name: 'Memory', chosen: true }) },
    { label: 'Chosen focus', state: 'focus', make: () => tagChip({ name: 'Memory', chosen: true }) },
  ], { width: 160 }),
  parameters: { surface: false, pseudo: PSEUDO },
};
