// Proposals: the Banner preview (Pritam's pick for showing what was saved),
// in five treatments, each shown with every kind of save. Rendered into the
// real Add details card through card({ decorate }).
import { card } from '../card.js';
import { CAPTURES } from './captures.js';

const P = {
  screenshot: '<path d="M4 8.5V7a3 3 0 0 1 3-3h1.5M15.5 4H17a3 3 0 0 1 3 3v1.5M20 15.5V17a3 3 0 0 1-3 3h-1.5M8.5 20H7a3 3 0 0 1-3-3v-1.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="2.2"/>',
  quote: '<path d="M9.5 7.5c-2.6.6-4 2.5-4 5.3V16a1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 10.5 16v-2A1.5 1.5 0 0 0 9 12.5H7.6M18 7.5c-2.6.6-4 2.5-4 5.3V16a1.5 1.5 0 0 0 1.5 1.5h2A1.5 1.5 0 0 0 19 16v-2a1.5 1.5 0 0 0-1.5-1.5h-1.4"/>',
  post: '<path d="M5 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4.5L8 19.2V16a3 3 0 0 1-3-3z"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4.5a1.5 1.5 0 0 1 2.1 0L19 19.5"/>',
  page: '<path d="M8 3.5h5.5L18.5 8.5V18A2.5 2.5 0 0 1 16 20.5H8A2.5 2.5 0 0 1 5.5 18V6A2.5 2.5 0 0 1 8 3.5z"/><path d="M13 3.8V7a1.5 1.5 0 0 0 1.5 1.5h3.7M9 13h6M9 16.5h4"/>',
};
const svg = (name, size = 13) => `<svg class="fk-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const size = c => c.width ? ` · ${c.width}×${c.height}` : c.minutes ? ` · ${c.minutes} min read` : '';
const chip = (c, where = 'bl') => `<span class="bn-chip bn-chip--${where}">${svg(c.icon)}${esc(c.kind)}${size(c)}</span>`;
const media = c => c.icon === 'screenshot' || c.icon === 'image';

// The content of each kind, drawn for a banner: an image, a post, an article, or words.
const post = (c, withMedia = true) => `<div class="bn-post"><div class="bn-post-head"><span class="bn-avatar">${esc(c.author[0])}</span><strong>${esc(c.author)}</strong><span>${esc(c.handle)}</span></div><p>${esc(c.text)}</p>${withMedia && c.image ? `<img src="${c.image}" alt="">` : ''}</div>`;
const article = c => `<div class="bn-article"><span class="bn-site"><span class="bn-fav">${esc(c.site[0].toUpperCase())}</span>${esc(c.site)}${size(c)}</span><strong>${esc(c.title)}</strong><p>${esc(c.text)}</p></div>`;
const quote = c => `<blockquote class="bn-quote"><p>${esc(c.text)}</p><cite>${esc(c.site)}</cite></blockquote>`;

export const TREATMENTS = {
  framed: {
    name: 'A. Framed',
    about: 'Inside the card\'s padding with its own rounded frame; a small label says what it is. Images and screenshots are cropped from the top; a full page fades out.',
    html: c => media(c)
      ? `<figure class="bn bn--framed${c.tall ? ' is-tall' : ''}"><img src="${c.image}" alt="${esc(c.title)}">${chip(c)}</figure>`
      : c.icon === 'post' ? `<div class="bn bn--framed bn--text">${post(c)}</div>`
      : c.icon === 'page' ? `<figure class="bn bn--framed bn--page"><img src="${c.image}" alt="">${chip(c)}</figure>`
      : `<div class="bn bn--framed bn--text">${quote(c)}</div>`,
  },
  bleed: {
    name: 'B. Edge to edge',
    about: 'The preview runs to the card\'s edges at the top, like a cover. Text kinds get a tinted cover with the words set large.',
    html: c => media(c) || c.icon === 'page'
      ? `<figure class="bn bn--bleed${c.tall ? ' is-tall' : ''}"><img src="${c.image}" alt="${esc(c.title)}">${chip(c)}</figure>`
      : c.icon === 'post' ? `<div class="bn bn--bleed bn--tint">${post(c, false)}${c.image ? `<img class="bn-post-media" src="${c.image}" alt="">` : ''}</div>`
      : `<div class="bn bn--bleed bn--tint">${quote(c)}</div>`,
  },
  fade: {
    name: 'C. Tall with fade',
    about: 'A taller preview that fades into the card, with the title set over the fade — the saved thing and its name read as one.',
    html: c => media(c) || c.icon === 'page'
      ? `<figure class="bn bn--fade${c.tall ? ' is-tall' : ''}"><img src="${c.image}" alt="${esc(c.title)}">${chip(c, 'tl')}</figure>`
      : c.icon === 'post' ? `<div class="bn bn--fade bn--text">${post(c)}</div>`
      : `<div class="bn bn--fade bn--text">${quote(c)}</div>`,
  },
  strip: {
    name: 'D. Compact strip',
    about: 'A short strip — enough to recognise it — so the card stays close to its current height. The label sits top right.',
    html: c => media(c) || c.icon === 'page'
      ? `<figure class="bn bn--strip${c.tall ? ' is-tall' : ''}"><img src="${c.image}" alt="${esc(c.title)}">${chip(c, 'tr')}</figure>`
      : c.icon === 'post' ? `<div class="bn bn--strip bn--text">${post(c, false)}</div>`
      : `<div class="bn bn--strip bn--text">${quote(c)}</div>`,
  },
  browser: {
    name: 'E. In a frame of its source',
    about: 'Each kind in the frame it came from: a page or screenshot in a small browser window with its address, a post as a post, an image on its own, words as a quote.',
    html: c => c.icon === 'screenshot' || c.icon === 'page'
      ? `<div class="bn bn--browser"><div class="bn-bar"><i></i><i></i><i></i><span><span class="bn-fav">${esc(c.site[0].toUpperCase())}</span>${esc(c.site)}</span></div><figure class="${c.tall ? 'is-tall' : ''}"><img src="${c.image}" alt="${esc(c.title)}">${chip(c)}</figure></div>`
      : c.icon === 'image' ? `<figure class="bn bn--framed bn--photo"><img src="${c.image}" alt="${esc(c.title)}">${chip(c)}</figure>`
      : c.icon === 'post' ? `<div class="bn bn--browser bn--text">${post(c)}</div>`
      : `<div class="bn bn--browser bn--text">${quote(c)}</div>`,
  },
};

export const BANNER_KINDS = ['region', 'fullpage', 'post', 'page', 'highlight', 'image'];

export function banner({ treatment = 'framed', capture = 'region', decorateMore = null } = {}) {
  const c = CAPTURES[capture], t = TREATMENTS[treatment];
  return card({ decorate: form => {
    form.querySelector('#detailsTitle').value = c.title;
    form.classList.add('bn-card', `bn-card--${treatment}`);
    form.prepend(el(t.html(c)));
    decorateMore?.(form, c);
  } });
}
