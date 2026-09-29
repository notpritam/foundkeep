// Planned for the website (launch tracker P5.19): the banner above the
// library for saves still in the extension — Pritam's pick from the drafts
// proposals (2026-09-29). A mock of the dashboard on the design system's
// tokens until the site adopts them; "Sync now" will ask the extension to
// retry, which needs the site to read the extension's unsynced saves.
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const DRAFTS = [{ image: 'samples/region.jpg' }, { image: 'samples/image.jpg' }, { image: null }];
const SAVED = [
  { kind: 'Bookmark', when: 'Sep 13', title: 'What would a more learnable programming environment look like?', text: 'Bret Victor on how a programming environment can help people understand what their code is doing.', tags: ['reading', 'design'], site: 'worrydream.com' },
  { kind: 'Note', when: 'Sep 13', title: 'A moment before the next tab', text: 'Leave a little room between finding something and deciding what it means.', tags: ['reading'], site: 'FoundKeep' },
];
const tile = d => d.image ? `<img class="dr-thumb" src="${d.image}" alt="">` : '<span class="dr-thumb dr-thumb--text">“</span>';
const libraryCard = c => el(`<article class="db-card"><div class="db-kind"><span>${c.kind}</span><span>${c.when}</span></div><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p><div class="db-tags">${c.tags.map(t => `<span class="fk-tag fk-tag--neutral fk-tag--sm">${t}</span>`).join('')}</div><strong class="db-site">${c.site}</strong></article>`);
export function draftsBanner({ count = 3, failed = 1, signedOut = 1 } = {}) {
  const page = el('<div class="db-page"><header class="db-head"><h2>Your library.</h2><span>Recently saved</span></header></div>');
  const why = [failed ? `${failed === 1 ? 'One' : failed} couldn’t sync` : '', signedOut ? `${signedOut === 1 ? 'one was' : `${signedOut} were`} saved while signed out` : ''].filter(Boolean).join(', and ');
  page.append(el(`<section class="dr-banner"><div class="dr-thumbs">${DRAFTS.slice(0, Math.min(3, count)).map(tile).join('')}</div><div class="dr-banner-text"><strong>${count} ${count === 1 ? 'save is' : 'saves are'} still in your extension</strong><span>They appear here once they sync.${why ? ` ${why[0].toUpperCase()}${why.slice(1)}.` : ''}</span></div><button type="button" class="fk-button fk-button--secondary fk-button--sm">Sync now</button></section>`));
  const grid = el('<div class="db-grid"></div>'); grid.append(...SAVED.map(libraryCard)); page.append(grid);
  return page;
}
