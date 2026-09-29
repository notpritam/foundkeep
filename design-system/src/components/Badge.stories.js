import { ICON_NAMES, specimens, groups } from './lib.js';
import { badge } from './builders.js';
import { matrix } from '../matrix.js';

export default {
  title: 'Components/Badge',
  render: args => badge(args),
  args: { label: 'My library', icon: 'library', variant: 'neutral', size: 'md' },
  argTypes: { variant: { control: 'inline-radio', options: ['neutral', 'accent'] }, size: { control: 'inline-radio', options: ['md', 'sm'] }, icon: { control: 'select', options: ICON_NAMES } },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-badge` — a fixed label that says where or what something is; it is not a control. **neutral** (default, its icon in the accent colour) or **accent**; **md** (30px) or **sm** (20px). In the extension: My library on the Add details card.' } } },
};
export const Playground = {};
export const Variants = {
  render: () => groups([
    ['Variants', specimens([['neutral', badge({})], ['accent', badge({ variant: 'accent', label: 'Public', icon: 'globe' })]])],
    ['Sizes', specimens([['md · 30px', badge({})], ['sm · 20px', badge({ size: 'sm', label: 'Needs approval', icon: 'none' })]])],
  ]),
  parameters: { controls: { disable: true } },
};
export const LightAndDark = {
  name: 'Light & dark',
  render: () => matrix([{ label: 'Neutral', make: () => badge({}) }, { label: 'Accent', make: () => badge({ variant: 'accent', label: 'Public', icon: 'globe' }) }, { label: 'Small', make: () => badge({ size: 'sm', label: 'Needs approval', icon: 'none' }) }], { width: 170 }),
  parameters: { layout: 'padded', controls: { disable: true } },
};
