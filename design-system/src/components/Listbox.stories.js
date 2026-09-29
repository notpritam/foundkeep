import { el, icon } from './lib.js';
import { select } from './builders.js';
import { openListbox } from '../../../apps/extension/src/listbox.js';

// Each story opens the real Listbox (listbox.js) from a Select, in a card.
function story({ kind = 'folders', height = 320, query = '' }) {
  const host = el(`<div class="fk-card" style="width:340px;min-height:${height}px;height:${height}px;align-items:flex-start"></div>`);
  const trigger = kind === 'collections' ? select({ value: 'Share', icon: 'collection', chevron: false, empty: true }) : kind === 'tags' ? el(`<button type="button" class="fk-button fk-button--dashed fk-button--sm fk-button--pill">${icon('plus', 14)}Tag</button>`) : select({});
  host.append(trigger);
  const tags = new Set(['Memory']);
  const configs = {
    folders: { label: 'Folder', placeholder: 'Find a folder', options: () => [{ value: '', label: 'No folder' }, ...['Reading list', 'Research', 'Essays'].map(f => ({ value: f, label: f, selected: f === 'Reading list' }))], onPick: () => false, create: { label: (q, exact) => q ? (exact ? '' : `New folder “${q}”`) : 'New folder', run: () => {} } },
    tags: { label: 'Personal tags', placeholder: 'Find or create a tag', options: () => ['Memory', 'Reading', 'Learning', 'Read later', 'Work'].map(t => ({ value: t, label: t, selected: tags.has(t) })), onPick: o => { tags.has(o.value) ? tags.delete(o.value) : tags.add(o.value); return true; }, create: { label: (q, exact) => q && !exact ? `Create “${q}”` : '', run: q => tags.add(q) } },
    collections: { label: 'Share to a collection', placeholder: 'Find a collection', options: () => [{ value: '', label: 'Don’t share', selected: true }, { heading: 'Your collections' }, { value: 'd', label: 'Design that works', icon: 'globe', meta: 'Public, needs approval' }, { value: 't', label: 'Team research', icon: 'lock', meta: 'Private' }], onPick: () => false },
  };
  const open = () => { openListbox({ trigger, host, ...configs[kind] }); if (query) { const input = host.querySelector('.fk-listbox__input'); input.value = query; input.dispatchEvent(new Event('input')); } };
  trigger.onclick = () => trigger.getAttribute('aria-expanded') === 'true' ? null : open();
  const go = () => host.isConnected ? open() : requestAnimationFrame(go); requestAnimationFrame(go);
  return host;
}

export default {
  title: 'Components/Listbox',
  render: args => story(args),
  args: { kind: 'folders', height: 320, query: '' },
  argTypes: { kind: { control: 'inline-radio', options: ['folders', 'tags', 'collections'] }, height: { control: { type: 'range', min: 180, max: 420, step: 10 } }, query: { control: 'text' } },
  parameters: { layout: 'centered', docs: { story: { inline: false, iframeHeight: 380 }, description: { component: '`.fk-listbox` (listbox.js) — FoundKeep\'s replacement for native dropdowns, opened by a **Select**: a search field, options with an optional icon and meta line, a check on what is chosen, headings, a separator and a create row. It opens under its trigger when it fits, over it when that fits better, otherwise covers its card with the options scrolling. Typing filters, ↑/↓ move, Enter picks, Esc closes only the list.' } } },
};
export const Folders = {};
export const TagsWithCreate = { name: 'Tags, creating one', args: { kind: 'tags', query: 'Deep work' } };
export const Collections = { args: { kind: 'collections' } };
export const CoveringASmallCard = { name: 'Covering a small card', args: { height: 200 } };
