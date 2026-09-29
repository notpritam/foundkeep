// Proposals: the draft line on the Add details card becomes one icon. It
// says the save has not reached the library, and clicking it does what is
// needed: Retry a failed sync, or open sign-in for a save made signed out.
// Five places for it, each in its three states, on a card with the Banner
// preview (Pritam's pick). Clicking plays the fix: retrying → synced.
import { banner } from './banner.js';

const ICONS = {
  waiting: '<path d="M18.5 9.5A7 7 0 0 0 6 7.4L4.8 8.7"/><path d="M4.6 4.9v3.9h3.9"/><path d="M5.5 14.5A7 7 0 0 0 18 16.6l1.2-1.3"/><path d="M19.4 19.1v-3.9h-3.9"/>',
  failed: '<path d="M7.5 17.5h9.2a3.8 3.8 0 0 0 .6-7.6 5.5 5.5 0 0 0-10.6-.9A4.3 4.3 0 0 0 7.5 17.5z"/><path d="M12 10v3"/><circle cx="12" cy="15.3" r=".9" fill="currentColor" stroke="none"/>',
  local: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>',
  synced: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};
export const DRAFT_STATES = {
  waiting: { label: 'Waiting to sync', short: 'Syncing…', tip: 'Waiting to sync — it goes to your library as soon as FoundKeep can reach it' },
  failed: { label: 'Didn’t sync', short: 'Retry sync', tip: 'Didn’t sync — click to retry' },
  local: { label: 'Only in this browser', short: 'Sign in to sync', tip: 'Saved while signed out — click to sign in and keep it' },
};
const svg = (name, size = 16) => `<svg class="fk-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

/** The status icon button; click plays the fix (retry / sign in → waiting → synced). */
function statusButton(state, { size = 'sm', label = false } = {}) {
  const b = el(`<button type="button" class="ds-status ds-status--${state}${label ? ' ds-status--label' : ''} fk-button fk-button--ghost fk-button--sm${label ? ' fk-button--pill' : ' fk-button--icon'}" data-tooltip="${DRAFT_STATES[state].tip}" aria-label="${DRAFT_STATES[state].tip}"></button>`);
  const paint = s => {
    b.className = b.className.replace(/ds-status--(waiting|failed|local|synced)/, `ds-status--${s}`);
    b.innerHTML = svg(s, 16) + (label ? `<span>${s === 'synced' ? 'Synced' : DRAFT_STATES[s].short}</span>` : '');
    if (DRAFT_STATES[s]) { b.dataset.tooltip = DRAFT_STATES[s].tip; b.setAttribute('aria-label', DRAFT_STATES[s].tip); } else { b.dataset.tooltip = 'Synced to your library'; }
  };
  paint(state);
  b.onclick = () => {
    if (b.matches('.ds-status--waiting, .ds-status--synced')) return;
    paint('waiting');
    setTimeout(() => { paint('synced'); setTimeout(() => b.classList.add('ds-status--gone'), 1400); }, 1400);
  };
  return b;
}

export const PLACES = {
  footer: { name: '1. Beside Save', about: 'In the footer, just left of Save: where you look before you finish.' },
  title: { name: '2. Beside Close', about: 'Top right, next to ×: the card\'s own status, out of the way of the fields.' },
  preview: { name: '3. On the preview', about: 'In the corner of the Banner preview: the status belongs to the saved thing.' },
  library: { name: '4. In the My library badge', about: 'My library becomes the status while the save is not there yet — it names the state and runs the fix.' },
  leading: { name: '5. Before the title', about: 'A small status mark leading the title, like an unsent message.' },
};

export function draftCard({ place = 'footer', state = 'failed', capture = 'region', treatment = 'framed' } = {}) {
  return banner({ treatment, capture, decorateMore: form => {
    if (place === 'footer') form.querySelector('.details__spacer').after(statusButton(state));
    if (place === 'title') form.querySelector('#detailsCancel').before(statusButton(state));
    if (place === 'preview') { const b = statusButton(state); b.classList.add('ds-status--overlay'); form.querySelector('.bn').append(b); }
    if (place === 'library') form.querySelector('#detailsLibrary').replaceWith(statusButton(state, { label: true }));
    if (place === 'leading') form.querySelector('#detailsTitle').before(statusButton(state));
  } });
}
