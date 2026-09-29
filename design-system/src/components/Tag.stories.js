import { specimens, groups } from './lib.js';
import { tag } from './builders.js';
import { matrix, PSEUDO } from '../matrix.js';

export default {
  title: 'Components/Tag',
  render: args => tag(args),
  args: { label: 'Memory', variant: 'accent', size: 'md', removable: true, disabled: false },
  argTypes: { variant: { control: 'inline-radio', options: ['accent', 'neutral'] }, size: { control: 'inline-radio', options: ['md', 'sm'] } },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-tag` — a chosen label. **accent** (default) for what you chose, **neutral** for everything else; **md** (30px) or **sm** (24px). As a button it is removable: × on the right, the whole tag is the target. In the extension: your personal tags on the Add details card.' } } },
};
export const Playground = {};
export const Variants = {
  render: () => groups([
    ['Variants', specimens([['accent', tag({})], ['neutral', tag({ variant: 'neutral', label: 'Reading' })]])],
    ['Sizes', specimens([['md · 30px', tag({})], ['sm · 24px', tag({ size: 'sm' })]])],
    ['Removable or fixed', specimens([['removable', tag({})], ['fixed', tag({ removable: false })]])],
  ]),
  parameters: { controls: { disable: true } },
};
export const LongLabel = { name: 'Long label', args: { label: 'Spaced repetition research' } };
export const States = {
  name: 'States · light & dark',
  render: () => matrix([
    { label: 'Default', make: () => tag({}) }, { label: 'Hover', state: 'hover', make: () => tag({}) },
    { label: 'Focus', state: 'focus', make: () => tag({}) }, { label: 'Neutral', make: () => tag({ variant: 'neutral', label: 'Reading' }) },
  ], { width: 150 }),
  parameters: { layout: 'padded', controls: { disable: true }, pseudo: PSEUDO },
};
