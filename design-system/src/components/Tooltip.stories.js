import { el, icon } from './lib.js';

export default {
  title: 'Components/Tooltip',
  render: ({ text }) => el(`<button type="button" class="fk-button fk-button--ghost fk-button--icon" data-tooltip="${text}" aria-label="${text}">${icon('close', 16)}</button>`),
  args: { text: 'Close' },
  parameters: { layout: 'centered', docs: { description: { component: '`[data-tooltip]` on any control: a small dark label above it after a short delay (450ms), hidden while its list is open. Icon-only controls always have one. (The dock draws its own, in its shadow root, with the same look.)' } } },
};
export const OnHover = { name: 'On hover', parameters: { pseudo: { hover: true } } };
export const Resting = {};
