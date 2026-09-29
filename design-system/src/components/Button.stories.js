import { ICON_NAMES, specimens, groups } from './lib.js';
import { button } from './builders.js';
import { matrix, PSEUDO } from '../matrix.js';

const VARIANTS = ['primary', 'secondary', 'ghost', 'dashed', 'link'];

export default {
  title: 'Components/Button',
  render: args => button(args),
  args: { label: 'Save details', variant: 'primary', size: 'md', shape: 'default', icon: 'none', disabled: false },
  argTypes: {
    variant: { control: 'inline-radio', options: VARIANTS },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
    shape: { control: 'inline-radio', options: ['default', 'pill', 'icon'] },
    icon: { control: 'select', options: ICON_NAMES },
  },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-button` — **primary** for the one main action, **secondary** outlined, **ghost** quiet, **dashed** for an action not used yet, **link** in the accent colour. Sizes **md** (36px) and **sm** (30px); shapes default (10px corners), **pill** and **icon** (square). In the extension: Save details (primary), + Tag (dashed sm pill), Close (ghost icon), Retry (link sm).' } } },
};

export const Playground = {};
export const Variants = {
  render: () => specimens(VARIANTS.map(variant => [variant, button({ variant, label: variant === 'primary' ? 'Save details' : variant === 'dashed' ? 'Add tag' : variant === 'link' ? 'Retry' : variant === 'ghost' ? 'Cancel' : 'Create' })])),
  parameters: { controls: { disable: true } },
};
export const SizesAndShapes = {
  name: 'Sizes and shapes',
  render: () => groups([
    ['Sizes', specimens([['md · 36px', button({})], ['sm · 30px', button({ size: 'sm' })]])],
    ['Shapes', specimens([['default', button({ variant: 'secondary', label: 'Create' })], ['pill', button({ variant: 'dashed', size: 'sm', shape: 'pill', icon: 'plus', label: 'Tag' })], ['icon', button({ variant: 'ghost', shape: 'icon', icon: 'close', label: 'Close' })]])],
  ]),
  parameters: { controls: { disable: true } },
};
export const InTheExtension = {
  name: 'In the extension',
  render: () => specimens([
    ['Save details', button({})], ['Save (shared)', button({ label: 'Save' })],
    ['+ Tag', button({ variant: 'dashed', size: 'sm', shape: 'pill', icon: 'plus', label: 'Tag' })],
    ['Close', button({ variant: 'ghost', shape: 'icon', icon: 'close', label: 'Close' })],
    ['Retry', button({ variant: 'link', size: 'sm', label: 'Retry' })],
  ]),
  parameters: { controls: { disable: true } },
};
export const States = {
  name: 'States · light & dark',
  render: () => groups(['primary', 'secondary', 'ghost', 'dashed'].map(variant => [variant, matrix([
    { label: 'Default', make: () => button({ variant }) }, { label: 'Hover', state: 'hover', make: () => button({ variant }) },
    { label: 'Focus', state: 'focus', make: () => button({ variant }) }, { label: 'Pressed', state: 'pressed', make: () => button({ variant }) },
    { label: 'Disabled', make: () => button({ variant, disabled: true }) },
  ], { width: 150 })])),
  parameters: { layout: 'padded', controls: { disable: true }, pseudo: PSEUDO },
};
