// The details card's list picker — its replacement for native <select>s, so
// every choice looks like FoundKeep: a search field, a check on what is
// chosen, an optional create row. One list is open at a time, inside the
// card: under its trigger if it fits, over it if that fits better, otherwise
// covering the card with its options scrolling. Typing filters, ↑/↓ move,
// Enter picks, Esc closes (and only closes the list, not the card).
import { icon } from './card-icons.js';

let current = null;
const text = value => { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; };

export function closePicker({ focusTrigger = false } = {}) {
  if (!current) return;
  const { list, trigger, onClose } = current;
  current = null;
  list.remove();
  trigger.setAttribute('aria-expanded', 'false');
  if (focusTrigger) trigger.focus({ preventScroll: true });
  onClose?.();
}
export const pickerOpen = () => !!current;

/**
 * trigger: the button that opens the list; host: the positioned card.
 * options(): the rows — { value, label, icon?, meta?, selected? } or { heading }.
 * onPick(option): true keeps the list open (e.g. picking several tags).
 * create: { label(query) → text for the create row, run(query) } — optional.
 */
export function openPicker({ trigger, host, label, placeholder, options, onPick, create = null, onClose = null }) {
  closePicker();
  const list = document.createElement('div');
  list.className = 'picker';
  list.innerHTML = `<label class="picker-search">${icon('search', 14)}<input type="text" autocomplete="off" spellcheck="false" placeholder="${text(placeholder)}" aria-label="${text(label)}"></label><div class="picker-options" role="listbox" aria-label="${text(label)}"></div>`;
  const input = list.querySelector('input'), box = list.querySelector('.picker-options');
  const draw = () => {
    const query = input.value.trim(), q = query.toLowerCase();
    const rows = options().filter(o => o.heading ? !q : !q || o.label.toLowerCase().includes(q));
    box.innerHTML = rows.map((o, i) => o.heading ? `<p class="picker-heading">${text(o.heading)}</p>`
      : `<button type="button" class="picker-option" role="option" data-index="${i}" data-value="${text(o.value ?? '')}" aria-selected="${!!o.selected}">`
        + `${o.icon ? icon(o.icon, 15) : ''}<span class="picker-label">${text(o.label)}${o.meta ? `<small>${text(o.meta)}</small>` : ''}</span>${icon('check', 15)}</button>`).join('');
    const exact = rows.some(o => !o.heading && o.label.toLowerCase() === q);
    const createText = create && create.label(query, exact);
    if (createText) box.insertAdjacentHTML('beforeend', `<div class="picker-sep"></div><button type="button" class="picker-option create" data-create>${icon('plus', 15)}<span class="picker-label">${text(createText)}</span></button>`);
    box._rows = rows;
  };
  const pick = button => {
    if (!button) return;
    if (button.hasAttribute('data-create')) { const query = input.value.trim(); input.value = ''; create.run(query, input); draw(); return; }
    const keep = onPick(box._rows[Number(button.dataset.index)]);
    if (keep) { draw(); input.focus({ preventScroll: true }); } else closePicker({ focusTrigger: true });
  };
  box.addEventListener('click', event => pick(event.target.closest('button')));
  input.addEventListener('input', draw);
  list.addEventListener('keydown', event => {
    const buttons = [...box.querySelectorAll('button')], at = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePicker({ focusTrigger: true }); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); buttons[Math.min(at + 1, buttons.length - 1)]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); (at <= 0 ? input : buttons[at - 1]).focus(); }
    else if (event.key === 'Enter' && document.activeElement === input) {
      event.preventDefault();
      const q = input.value.trim().toLowerCase();
      pick(buttons.find(b => !b.hasAttribute('data-create') && b.textContent.trim().toLowerCase() === q) || (q && box.querySelector('[data-create]')) || buttons[0]);
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
  else { list.style.top = '8px'; list.style.maxHeight = `${h.height - 16}px`; list.classList.add('covering'); }
}

document.addEventListener('pointerdown', event => {
  if (current && !current.list.contains(event.target) && !current.trigger.contains(event.target)) closePicker();
}, true);
