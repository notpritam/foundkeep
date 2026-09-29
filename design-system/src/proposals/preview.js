// Proposals: a preview of what was saved, inside the Add details card.
// Five layouts (style) × every kind of save (captures.js). Each renders into
// the real card through card({ decorate }).
import { card } from '../card.js';
import { CAPTURES } from './captures.js';

// Icons for kinds of save, in the dock's rounded family (dock.js).
const P = {
  screenshot: '<path d="M4 8.5V7a3 3 0 0 1 3-3h1.5M15.5 4H17a3 3 0 0 1 3 3v1.5M20 15.5V17a3 3 0 0 1-3 3h-1.5M8.5 20H7a3 3 0 0 1-3-3v-1.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="2.2"/>',
  quote: '<path d="M9.5 7.5c-2.6.6-4 2.5-4 5.3V16a1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 10.5 16v-2A1.5 1.5 0 0 0 9 12.5H7.6M18 7.5c-2.6.6-4 2.5-4 5.3V16a1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 19 16v-2a1.5 1.5 0 0 0-1.5-1.5h-1.4"/>',
  post: '<path d="M5 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4.5L8 19.2V16a3 3 0 0 1-3-3z"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4.5a1.5 1.5 0 0 1 2.1 0L19 19.5"/>',
  page: '<path d="M8 3.5h5.5L18.5 8.5V18A2.5 2.5 0 0 1 16 20.5H8A2.5 2.5 0 0 1 5.5 18V6A2.5 2.5 0 0 1 8 3.5z"/><path d="M13 3.8V7a1.5 1.5 0 0 0 1.5 1.5h3.7M9 13h6M9 16.5h4"/>',
  note: '<path d="M11.5 4.5H7.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-4"/><path d="M17.3 4.2a2 2 0 0 1 2.8 2.8l-6.1 6.1a2 2 0 0 1-.93.52l-2.2.55a.5.5 0 0 1-.6-.6l.55-2.2a2 2 0 0 1 .52-.93z"/>',
  expand: '<path d="m7.5 10 4.5 4.5 4.5-4.5"/>',
};
const svg = (name, size = 16) => `<svg class="fk-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const hasImage = c => !!c.image && c.icon !== 'page' && c.icon !== 'post';
const meta = c => [c.kind, c.width ? `${c.width}×${c.height}` : c.minutes ? `${c.minutes} min read` : '', c.site].filter(Boolean).join(' · ');

/** The full-width preview: media for images, a quote, a post, or a page. */
function wide(c, height) {
  if (c.icon === 'note') return null;
  if (hasImage(c)) {
    return el(`<figure class="pv-media${c.tall ? ' tall' : ''}" style="height:${height}px"><img src="${c.image}" alt="${esc(c.title)}"><figcaption>${svg(c.icon, 13)}${esc(c.kind)}${c.width ? ` · ${c.width}×${c.height}` : ''}</figcaption></figure>`);
  }
  if (c.icon === 'quote') return el(`<blockquote class="pv-quote"><p>${esc(c.text)}</p><cite>${esc(c.site)}</cite></blockquote>`);
  if (c.icon === 'post') return el(`<div class="pv-post"><div class="pv-post-head"><span class="pv-avatar">${esc(c.author[0])}</span><strong>${esc(c.author)}</strong><span>${esc(c.handle)}</span></div><p>${esc(c.text)}</p>${c.image ? `<img src="${c.image}" alt="">` : ''}</div>`);
  return el(`<div class="pv-page">${c.image ? `<img src="${c.image}" alt="">` : ''}<div><span class="pv-site"><span class="pv-fav">${esc(c.site[0].toUpperCase())}</span>${esc(c.site)}${c.minutes ? ` · ${c.minutes} min read` : ''}</span><p>${esc(c.text)}</p></div></div>`);
}
/** A small square: the image, or a tile with the kind's icon (the avatar for a post). */
function thumb(c, size) {
  if (hasImage(c)) return el(`<span class="pv-thumb" style="width:${size}px;height:${size}px"><img src="${c.image}" alt=""></span>`);
  if (c.icon === 'post') return el(`<span class="pv-thumb pv-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size / 2.6)}px">${esc(c.author[0])}</span>`);
  if (c.icon === 'page' && c.image) return el(`<span class="pv-thumb" style="width:${size}px;height:${size}px"><img src="${c.image}" alt=""></span>`);
  return el(`<span class="pv-thumb pv-tile" style="width:${size}px;height:${size}px">${svg(c.icon, Math.round(size / 2.4))}</span>`);
}
const secondLine = c => c.icon === 'quote' || c.icon === 'post' ? `“${c.text}”` : meta(c).replace(`${c.kind} · `, '');

export const STYLES = {
  banner: { name: '1. Banner', about: 'What you saved leads the card, full width: the screenshot or image, the highlighted words, the post, or the page. Then the title and your note.' },
  row: { name: '2. Thumbnail row', about: 'A small thumbnail under the title with one line saying what it is — the kind, size and site, or the first words of a highlight. Compact, and the card stays text-first.' },
  inline: { name: '3. Inline', about: 'Title and note first, then the saved content full width above the folder and tags — the card reads top to bottom as "what you called it, why, what it is".' },
  peek: { name: '4. Peek', about: 'One quiet line — kind, size, site — that opens into the full preview when you want it. The card stays as short as it is today.' },
  side: { name: '5. Side thumbnail', about: 'A square thumbnail beside your note, under the title — like an attachment in a message.' },
};

export function decorate(style, c) {
  return form => {
    const titleRow = form.querySelector('.details__title-row'), note = form.querySelector('#detailsNote');
    form.querySelector('#detailsTitle').value = c.title;
    if (c.icon === 'note') { note.value = 'Ask Lena about the follow-up piece on forgetting curves.'; return; }
    if (style === 'banner') { const w = wide(c, 132); if (w) { w.classList.add('pv-banner'); form.prepend(w); } }
    if (style === 'inline') { const w = wide(c, 120); if (w) note.after(w); }
    if (style === 'row') {
      titleRow.after(el(`<div class="pv-row"></div>`));
      const row = titleRow.nextElementSibling;
      row.append(thumb(c, 44), el(`<div class="pv-row-text"><strong>${svg(c.icon, 13)}${esc(c.kind)}</strong><span>${esc(secondLine(c))}</span></div>`));
    }
    if (style === 'peek') {
      const peek = el(`<div class="pv-peek"><button type="button" class="pv-peek-line" aria-expanded="false">${svg(c.icon, 15)}<span>${esc(meta(c))}</span>${svg('expand', 14)}</button></div>`);
      const w = wide(c, 120); if (w) { w.hidden = true; peek.append(w); }
      peek.firstElementChild.onclick = () => { const open = w.hidden; w.hidden = !open; peek.firstElementChild.setAttribute('aria-expanded', String(open)); };
      note.after(peek);
    }
    if (style === 'side') {
      // The note and the thumbnail side by side; the title row keeps Close at the far right.
      const side = el('<div class="pv-side"></div>');
      note.before(side);
      side.append(note, thumb(c, 64));
    }
  };
}

export const preview = ({ style = 'row', capture = 'region', state = 'ready' } = {}) =>
  card({ state, decorate: decorate(style, CAPTURES[capture]), note: capture === 'note' ? '' : undefined });
