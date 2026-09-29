// Proposals: drafts — saves that exist only in the extension because they
// have not synced yet (cloudStatus 'queued'), failed to sync ('failed'), or
// were made signed out ('local'). Where and how to show them: on the Add
// details card, on the dock, and on the web dashboard.
import { card } from '../card.js';
import { icon } from '../../../apps/extension/src/card-icons.js';
import { DOCK_CSS, dockIcon } from '../dock-source.js';

const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export const STATES = {
  queued: { label: 'Waiting to sync', line: 'Saved in this browser. It syncs as soon as FoundKeep can reach your library.', action: null },
  failed: { label: 'Didn’t sync', line: 'This save couldn’t sync to your library.', action: 'Retry' },
  local: { label: 'Only in this browser', line: 'Saved while signed out. Sign in to keep it in your library.', action: 'Sign in' },
};
const DRAFTS = [
  { title: 'The half-life of a good idea', kind: 'Region screenshot', site: 'themargin.example', image: 'samples/region.jpg', state: 'queued', when: '2 min ago' },
  { title: 'Forgetting curve with reviews', kind: 'Image', site: 'themargin.example', image: 'samples/image.jpg', state: 'failed', when: '1 h ago' },
  { title: 'Memory is built to discard…', kind: 'Highlight', site: 'themargin.example', image: null, state: 'local', when: 'Yesterday' },
];

// --- A · On the Add details card ------------------------------------------------------
/** The card with a draft line under the note: a Draft badge, why, and the fix. */
export function cardDraft(state = 'queued') {
  const s = STATES[state];
  return card({ decorate: form => {
    const line = el(`<div class="dr-line"><span class="fk-badge fk-badge--sm dr-badge">Draft</span><span class="dr-text">${esc(s.line)}</span>${s.action ? `<button type="button" class="fk-button fk-button--link fk-button--sm">${esc(s.action)}</button>` : ''}</div>`);
    form.querySelector('#detailsNote').after(line);
  } });
}

// --- B · On the dock --------------------------------------------------------------------
/** The dock's real stylesheet, with a count on Library and its tooltip. */
export function dockDraft({ count = 2, tooltip = true } = {}) {
  const host = el('<div class="dr-dock-host"></div>');
  const root = host.attachShadow({ mode: 'open' });
  const tool = (name, extra = '') => `<button type="button" data-action="${name}" ${extra}>${dockIcon(name, 18)}</button>`;
  root.innerHTML = `<style>${DOCK_CSS}
    .dock{position:relative!important;left:auto!important;top:auto!important}
    .count{position:absolute;top:3px;right:3px;min-width:15px;height:15px;padding:0 4px;box-sizing:border-box;border-radius:999px;background:#4cc38a;color:#05130d;font:700 10px/15px system-ui,sans-serif;text-align:center}
    [data-action="library"]{position:relative}
    .tip{position:absolute;left:auto;right:4px;bottom:52px;top:auto}</style>
    <div class="dock" role="toolbar" data-mode="expanded"><div class="actions">${tool('savepage')}${tool('highlight')}${tool('screenshot')}${tool('note')}<button type="button" data-action="library">${dockIcon('library', 18)}<span class="count">${count}</span></button>${tool('more')}</div></div>
    ${tooltip ? `<div class="tip">Open your library · ${count} saves waiting to sync</div>` : ''}`;
  return host;
}

// --- The web dashboard (a mock on the same tokens) ------------------------------------
const tile = d => d.image ? `<img class="dr-thumb" src="${d.image}" alt="">` : `<span class="dr-thumb dr-thumb--text">“</span>`;
const libraryCard = ({ kind, when, title, text, tags, site }) => el(`<article class="db-card"><div class="db-kind"><span>${kind}</span><span>${when}</span></div><h4>${esc(title)}</h4><p>${esc(text)}</p><div class="db-tags">${tags.map(t => `<span class="fk-tag fk-tag--neutral fk-tag--sm">${t}</span>`).join('')}</div><strong class="db-site">${site}</strong></article>`);
const SAVED = [
  { kind: 'Bookmark', when: 'Sep 13', title: 'What would a more learnable programming environment look like?', text: 'Bret Victor on how a programming environment can help people understand what their code is doing.', tags: ['reading', 'design'], site: 'worrydream.com' },
  { kind: 'Note', when: 'Sep 13', title: 'A moment before the next tab', text: 'Leave a little room between finding something and deciding what it means.', tags: ['reading'], site: 'FoundKeep' },
];
function libraryPage(top, cards) {
  const page = el(`<div class="db-page"><header class="db-head"><h2>Your library.</h2><span>Recently saved</span></header></div>`);
  if (top) page.append(top);
  const grid = el('<div class="db-grid"></div>');
  grid.append(...cards);
  page.append(grid);
  return page;
}

/** C · A banner above the library. */
export function dashboardBanner() {
  const banner = el(`<section class="dr-banner"><div class="dr-thumbs">${DRAFTS.map(tile).join('')}</div><div class="dr-banner-text"><strong>3 saves are still in your extension</strong><span>They appear here once they sync. One couldn’t sync, and one was saved while signed out.</span></div><button type="button" class="fk-button fk-button--secondary fk-button--sm">Sync now</button></section>`);
  return libraryPage(banner, SAVED.map(libraryCard));
}

/** D · Drafts as cards in the grid, marked and dashed. */
export function dashboardCards() {
  const drafts = DRAFTS.slice(0, 2).map(d => el(`<article class="db-card db-card--draft">${d.image ? `<img class="db-media" src="${d.image}" alt="">` : ''}<div class="db-kind"><span class="fk-badge fk-badge--sm dr-badge">In your extension</span><span>${d.when}</span></div><h4>${esc(d.title)}</h4><p class="dr-state dr-state--${d.state}">${STATES[d.state].label}${STATES[d.state].action ? ` · <button type="button" class="dr-inline-action">${STATES[d.state].action}</button>` : ''}</p><strong class="db-site">${d.site}</strong></article>`));
  return libraryPage(null, [...drafts, ...SAVED.map(libraryCard)]);
}

/** E · An "In your extension" section: one row per draft, with its status. */
export function dashboardSection() {
  const section = el(`<section class="dr-section"><div class="dr-section-head"><strong>In your extension</strong><span>3 saves haven’t reached your library yet</span><button type="button" class="fk-button fk-button--ghost fk-button--sm">Sync all</button></div></section>`);
  for (const d of DRAFTS) {
    const s = STATES[d.state];
    section.append(el(`<div class="dr-row">${tile(d)}<div class="dr-row-text"><strong>${esc(d.title)}</strong><span>${d.kind} · ${d.site} · ${d.when}</span></div><span class="dr-state dr-state--${d.state}">${s.label}</span>${s.action ? `<button type="button" class="fk-button fk-button--link fk-button--sm">${s.action}</button>` : '<span class="dr-spinner" aria-hidden="true"></span>'}</div>`));
  }
  return libraryPage(section, SAVED.map(libraryCard));
}
