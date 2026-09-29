import { disclosure } from '../../card.js';

export default {
  title: 'Extension/Card controls/Disclosure',
  render: args => disclosure(args),
  args: { open: false },
  parameters: { surface: 'card', docs: { description: { component: '"View saved content": a native `<details>` with an 11px `--muted` summary, opening an excerpt capped at 100px.' } } },
};
export const Closed = {};
export const Open = { args: { open: true } };
