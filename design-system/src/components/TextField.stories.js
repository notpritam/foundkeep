import { specimens, groups, frame } from './lib.js';
import { field } from './builders.js';
import { matrix, PSEUDO } from '../matrix.js';

const TITLE = 'The half-life of a good idea';
const NOTE = 'Worth rereading before the Q4 planning doc: the part about spacing reviews.';
export default {
  title: 'Components/Text field',
  render: args => frame(field(args)),
  args: { variant: 'boxed', size: 'body', multiline: false, muted: false, value: '', placeholder: 'Add a title', disabled: false },
  argTypes: { variant: { control: 'inline-radio', options: ['boxed', 'inline'] }, size: { control: 'inline-radio', options: ['body', 'title'] } },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-field` — an input or a textarea. **boxed** (default) is a bordered field; **inline** is text edited in place, with no box until you point at it and a 2px accent ring while typing. **title** size is 16px/600; **muted** stays quiet until you type. Textareas grow with their text. In the extension: the card\'s title and note (inline) and the collection caption.' } } },
};
export const Playground = {};
export const Variants = {
  render: () => groups([
    ['Boxed', frame(field({ value: TITLE }))],
    ['Boxed, multiline', frame(field({ multiline: true, value: NOTE, placeholder: 'Add a note' }))],
    ['Inline title', frame(field({ variant: 'inline', size: 'title', value: TITLE }))],
    ['Inline note (muted)', frame(field({ variant: 'inline', multiline: true, muted: true, value: NOTE, placeholder: 'Add a note' }))],
  ]),
  parameters: { controls: { disable: true } },
};
export const InlineTitle = { name: 'Inline title', args: { variant: 'inline', size: 'title', value: TITLE } };
export const InlineNote = { name: 'Inline note', args: { variant: 'inline', multiline: true, muted: true, value: NOTE, placeholder: 'Add a note' } };
export const States = {
  name: 'States · light & dark',
  render: () => groups([
    ['Boxed', matrix([
      { label: 'Empty', make: () => field({}) }, { label: 'Filled', make: () => field({ value: TITLE }) }, { label: 'Hover', state: 'hover', make: () => field({ value: TITLE }) },
      { label: 'Focus', state: 'focus', make: () => field({ value: TITLE }) }, { label: 'Disabled', make: () => field({ value: TITLE, disabled: true }) },
    ], { width: 260 })],
    ['Inline', matrix([
      { label: 'Resting', make: () => field({ variant: 'inline', size: 'title', value: TITLE }) }, { label: 'Hover', state: 'hover', make: () => field({ variant: 'inline', size: 'title', value: TITLE }) },
      { label: 'Focus', state: 'focus', make: () => field({ variant: 'inline', size: 'title', value: TITLE }) },
    ], { width: 300 })],
  ]),
  parameters: { layout: 'padded', controls: { disable: true }, pseudo: PSEUDO },
};
