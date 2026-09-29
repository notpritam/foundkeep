// The design system components as DOM, for stories: each builder renders
// the component's markup from components.css with the product's icons.
import { icon, esc, el } from './lib.js';
import { openListbox } from '../../../apps/extension/src/listbox.js';

export const button = ({ label = 'Save details', variant = 'primary', size = 'md', shape = 'default', icon: ic = 'none', disabled = false }) => {
  const cls = ['fk-button', `fk-button--${variant}`, size === 'sm' && 'fk-button--sm', shape === 'pill' && 'fk-button--pill', shape === 'icon' && 'fk-button--icon'].filter(Boolean).join(' ');
  const b = el(`<button type="button" class="${cls}">${ic !== 'none' ? icon(ic, size === 'sm' ? 14 : 16) : ''}${shape === 'icon' ? '' : esc(label)}</button>`);
  if (shape === 'icon') b.setAttribute('aria-label', label);
  b.disabled = disabled;
  return b;
};

export const select = ({ value = 'Reading list', icon: ic = 'folder', variant = 'pill', chevron = true, empty = false, invalid = false, open = false, disabled = false }) => {
  const b = el(`<button type="button" class="fk-select${variant === 'field' ? ' fk-select--field' : ''}" aria-haspopup="listbox" aria-expanded="${open}" aria-invalid="${invalid}">${ic !== 'none' ? icon(ic, 15) : ''}<span class="fk-select__value">${esc(value)}</span>${chevron ? icon('chevron', 14, 'fk-select__chevron') : ''}</button>`);
  b.toggleAttribute('data-empty', empty); b.disabled = disabled;
  return b;
};
const FOLDERS = ['Reading list', 'Research', 'Essays'];
/** A Select with its Listbox open, live: pick to change the value. */
export function withListbox(args = {}) {
  const host = el('<div class="fk-card" style="width:340px;min-height:300px;align-items:flex-start"></div>');
  const trigger = select(args); host.append(trigger);
  let value = 'Reading list';
  const open = () => openListbox({
    trigger, host, label: 'Folder', placeholder: 'Find a folder',
    options: () => [{ value: '', label: 'No folder', selected: !value }, ...FOLDERS.map(f => ({ value: f, label: f, selected: f === value }))],
    onPick: o => { value = o.value; trigger.querySelector('.fk-select__value').textContent = value || 'No folder'; },
    create: { label: (q, exact) => q ? (exact ? '' : `New folder “${q}”`) : 'New folder', run: () => {} },
  });
  trigger.onclick = () => trigger.getAttribute('aria-expanded') === 'true' ? null : open();
  const go = () => host.isConnected ? open() : requestAnimationFrame(go); requestAnimationFrame(go);
  return host;
}

export const tag = ({ label = 'Memory', variant = 'accent', size = 'md', removable = true, disabled = false }) => {
  const cls = ['fk-tag', variant === 'neutral' && 'fk-tag--neutral', size === 'sm' && 'fk-tag--sm'].filter(Boolean).join(' ');
  const t = removable
    ? el(`<button type="button" class="${cls}" aria-label="Remove tag ${esc(label)}"><span>${esc(label)}</span>${icon('close', size === 'sm' ? 11 : 12, 'fk-tag__remove')}</button>`)
    : el(`<span class="${cls}">${esc(label)}</span>`);
  if (removable) t.disabled = disabled;
  return t;
};

export const badge = ({ label = 'My library', icon: ic = 'library', variant = 'neutral', size = 'md' }) =>
  el(`<span class="fk-badge${variant === 'accent' ? ' fk-badge--accent' : ''}${size === 'sm' ? ' fk-badge--sm' : ''}">${ic !== 'none' ? icon(ic, size === 'sm' ? 12 : 15) : ''}${esc(label)}</span>`);

export const field = ({ variant = 'boxed', size = 'body', multiline = false, muted = false, value = '', placeholder = 'Add a title', disabled = false }) => {
  const cls = ['fk-field', variant === 'inline' && 'fk-field--inline', size === 'title' && 'fk-field--title', muted && 'fk-field--muted'].filter(Boolean).join(' ');
  const f = el(multiline ? `<textarea class="${cls}" rows="2" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"></textarea>` : `<input class="${cls}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">`);
  f.value = value; f.disabled = disabled;
  return f;
};

export const card = ({ raised = false, children = [] } = {}) => {
  const c = el(`<div class="fk-card${raised ? ' fk-card--raised' : ''}"></div>`);
  c.append(...children);
  return c;
};

export const status = ({ text = 'Loading folders and collections…', tone = '' }) => {
  const p = el('<p class="fk-status" role="status"></p>');
  p.textContent = text; if (tone) p.dataset.tone = tone;
  return p;
};
