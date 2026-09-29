import { icon, onCard, node } from './shared.js';
import { matrix, PSEUDO } from '../../matrix.js';
import { TITLE, NOTE } from '../../card.js';

const field = ({ kind = 'title', value, disabled = false }) => {
  if (kind === 'caption') {
    const line = node(`<div class="share-line"><span aria-hidden="true">${icon('globe', 15)}</span><textarea class="note" rows="1" placeholder="Add a caption for the collection" aria-label="Caption for the collection"></textarea></div>`);
    line.querySelector('textarea').value = value ?? ''; line.querySelector('textarea').disabled = disabled; return line;
  }
  const el = kind === 'title' ? node('<input class="title" placeholder="Add a title" aria-label="Title">') : node('<textarea class="note" rows="2" placeholder="Add a note" aria-label="Personal note"></textarea>');
  el.value = value ?? (kind === 'title' ? TITLE : NOTE); el.disabled = disabled;
  if (kind === 'title') { const row = node('<div class="title-row"></div>'); row.append(el); return row; }
  return el;
};
export default {
  title: 'Extension/Card controls/Title and note',
  render: args => onCard(field(args)),
  args: { kind: 'title', disabled: false },
  argTypes: { kind: { control: 'inline-radio', options: ['title', 'note', 'caption'] }, value: { control: 'text' } },
  parameters: { docs: { description: { component: 'Text edited in place: no box, a soft fill on hover and a 2px accent ring while typing. The title is 16px/600; the note is muted until you type and grows with its text; the caption line appears once a collection is chosen.' } } },
};
export const Title = {};
export const Note = { args: { kind: 'note' } };
export const EmptyNote = { name: 'Empty note', args: { kind: 'note', value: '' } };
export const CaptionLine = { name: 'Caption line', args: { kind: 'caption' } };
export const AllStates = {
  name: 'All states · light & dark',
  render: () => matrix([
    { label: 'Title', make: () => field({}) }, { label: 'Title hover', state: 'hover', make: () => field({}) }, { label: 'Title focus', state: 'focus', make: () => field({}) },
    { label: 'Note', make: () => field({ kind: 'note' }) }, { label: 'Note empty', make: () => field({ kind: 'note', value: '' }) }, { label: 'Note focus', state: 'focus', make: () => field({ kind: 'note' }) },
  ]),
  parameters: { controls: { disable: true }, pseudo: PSEUDO },
};
