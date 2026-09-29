// Listbox (design system: Components / Listbox) — FoundKeep's replacement for
// native <select>s: a search field, a check on what is chosen, headings and
// meta lines, and an optional create row. A Select (the trigger) opens it.
// One is open at a time, inside its host: under the trigger if it fits, over
// it if that fits better, otherwise covering the host with its options
// scrolling. Typing filters, ↑/↓ move, Enter picks, Esc closes (only the list).
import { icon } from './card-icons.js';

let current = null;
const text = value => { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; };

export function closeListbox({ focusTrigger = false } = {}) {
  if (!current) return;
  const { list, trigger, onClose } = current;
  current = null;
  list.remove();
  trigger.setAttribute('aria-expanded', 'false');
  if (focusTrigger) trigger.focus({ preventScroll: true });
  onClose?.();
}
export const listboxOpen = () => !!current;

/**
 * trigger: the Select that opens the list; host: the positioned container.
 * options(): the rows — { value, label, icon?, meta?, selected? } or { heading }.
 * onPick(option): true keeps the list open (e.g. picking several tags).
 * create: { label(query, exact) → text for the create row or '', run(query, input) } — optional.
 */
export function openListbox({ trigger, host, label, placeholder, options, onPick, create = null, onClose = null }) {
  closeListbox();
  const list = document.createElement('div');
  list.className = 'fk-listbox fk-listbox--popover';
  list.innerHTML = `<label class="fk-listbox__search">${icon('search', 14)}<input class="fk-listbox__input" type="text" autocomplete="off" spellcheck="false" placeholder="${text(placeholder)}" aria-label="${text(label)}"></label><div class="fk-listbox__options" role="listbox" aria-label="${text(label)}"></div>`;
  const input = list.querySelector('input'), box = list.querySelector('.fk-listbox__options');
  const draw = () => {
    const query = input.value.trim(), q = query.toLowerCase();
    const rows = options().filter(o => o.heading ? !q : !q || o.label.toLowerCase().includes(q));
    box.innerHTML = rows.map((o, i) => o.heading ? `<p class="fk-listbox__heading">${text(o.heading)}</p>`
      : `<button type="button" class="fk-listbox__option" role="option" data-index="${i}" data-value="${text(o.value ?? '')}" aria-selected="${!!o.selected}">`
        + `${o.icon ? icon(o.icon, 15) : ''}<span class="fk-listbox__label">${text(o.label)}${o.meta ? `<small class="fk-listbox__meta">${text(o.meta)}</small>` : ''}</span>${icon('check', 15, 'fk-listbox__check')}</button>`).join('');
    const exact = rows.some(o => !o.heading && o.label.toLowerCase() === q);
    const createText = create && create.label(query, exact);
    if (createText) box.insertAdjacentHTML('beforeend', `<div class="fk-listbox__separator"></div><button type="button" class="fk-listbox__option fk-listbox__option--create" role="option" aria-selected="false" data-create>${icon('plus', 15)}<span class="fk-listbox__label">${text(createText)}</span></button>`);
    box._rows = rows;
  };
  const pick = button => {
    if (!button) return;
    if (button.hasAttribute('data-create')) { const query = input.value.trim(); input.value = ''; create.run(query, input); draw(); return; }
    const keep = onPick(box._rows[Number(button.dataset.index)]);
    if (keep) { draw(); input.focus({ preventScroll: true }); } else closeListbox({ focusTrigger: true });
  };
  box.addEventListener('click', event => pick(event.target.closest('button')));
  input.addEventListener('input', draw);
  list.addEventListener('keydown', event => {
    const buttons = [...box.querySelectorAll('button')], at = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeListbox({ focusTrigger: true }); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); buttons[Math.min(at + 1, buttons.length - 1)]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); (at <= 0 ? input : buttons[at - 1]).focus(); }
    else if (event.key === 'Enter' && document.activeElement === input) {
      event.preventDefault();
      const q = input.value.trim().toLowerCase();
      pick(buttons.find(b => !b.hasAttribute('data-create') && b.querySelector('.fk-listbox__label').firstChild.textContent.trim().toLowerCase() === q) || (q && box.querySelector('[data-create]')) || buttons[0]);
    }
  });
  draw();
  host.append(list);
  trigger.setAttribute('aria-expanded', 'true');
  current = { list, trigger, onClose };
  place(list, trigger, host);
  input.focus({ preventScroll: true });
}

function place(list, trigger, host) {
  const h = host.getBoundingClientRect(), t = trigger.getBoundingClientRect();
  const width = list.offsetWidth, natural = list.scrollHeight;
  list.style.left = `${Math.max(8, Math.min(t.left - h.left, h.width - width - 8))}px`;
  const below = h.bottom - t.bottom - 14, above = t.top - h.top - 14;
  if (natural <= below) list.style.top = `${t.bottom - h.top + 6}px`;
  else if (natural <= above) list.style.top = `${t.top - h.top - natural - 6}px`;
  else { list.style.top = '8px'; list.style.maxHeight = `${h.height - 16}px`; list.classList.add('fk-listbox--covering'); }
}

document.addEventListener('pointerdown', event => {
  if (current && !current.list.contains(event.target) && !current.trigger.contains(event.target)) closeListbox();
}, true);
