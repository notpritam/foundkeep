// Brand type (proposal, 2026-09-30): each candidate pairing set as FoundKeep —
// a type specimen on the Cumulus sky, then the real app and dashboard screens
// in that pairing (the App and Dashboard Storybooks, through their Type
// toolbar). The pairings and their fonts are simulator/brand-type.ts and
// simulator/brand-fonts.css; the screens only exist in the full build.
import '../../simulator/brand-fonts.css';
import './brand.css';
import { PAIRINGS } from '../../simulator/brand-type.ts';
import sky from '../../../apps/mobile/assets/images/sign-in-backgrounds/sky-cumulus-top-medium.webp';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const faceName = f => f.family.match(/'([^']+)'/)[1];
const weightName = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extrabold' };

/** The pairing as CSS variables; --scale evens out how large each display face looks at one size. */
function vars(p) {
  return [['--display', p.display.family], ['--display-weight', p.display.weight], ['--display-tracking', `${p.display.tracking}em`],
    ['--word', p.word.family], ['--word-weight', p.word.weight], ['--word-tracking', `${p.word.tracking}em`], ['--word-style', p.word.italic ? 'italic' : 'normal'],
    ['--text', p.text.family], ['--scale', (p.lead[0] / 38).toFixed(3)]].map(([k, v]) => `${k}:${v}`).join(';');
}

/** A screen from the App or Dashboard Storybook, framed, in this pairing. */
function screen(book, id, caption, p, extra = '') {
  const globals = [`brand:${p.id}`, book === 'dashboard' ? 'device:laptop' : 'device:iphone-17-pro', extra].filter(Boolean).join(';');
  return `<figure${book === 'dashboard' && id === 'current-landing--landing' ? ' class="bt-wide"' : ''}>
    <iframe loading="lazy" title="${esc(caption)} in ${esc(p.name)}" src="./${book}/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(globals)}"></iframe>
    <figcaption>${esc(caption)}</figcaption></figure>`;
}

function board(id) {
  const p = PAIRINGS[id];
  const el = document.createElement('div');
  el.className = 'bt'; el.style.cssText = vars(p);
  el.innerHTML = `
    <header class="bt-intro">
      <div><h1 class="bt-display">${esc(p.name)}</h1><p>${esc(p.mood)} ${esc(p.source)}.</p></div>
      <div class="bt-roles"><span>Display: <strong>${esc(faceName(p.display))} ${weightName[p.display.weight]}</strong></span><span>Text: <strong>${esc(faceName(p.text))}</strong></span></div>
    </header>
    <section class="bt-specimen" aria-label="Type specimen">
      <div class="bt-poster" style="background-image:url(${sky})">
        <h2 class="bt-display">Keep every <span class="bt-word">highlight.</span></h2>
        <p>One private place for everything you find.</p>
      </div>
      <div class="bt-text">
        <h3 class="bt-display">Found it? Keep it.</h3>
        <p>Save a page from your browser, a photo from your phone, a line you highlighted. FoundKeep keeps them in one private collection and brings them back when you need them.</p>
        <div class="bt-ui"><button type="button">Continue with Google</button><button type="button">Add details</button><span>Reading list</span><span>Design</span></div>
        <div class="bt-meta">Saved from the web, 2 minutes ago. 1,284 finds in 36 folders.</div>
        <div class="bt-glyphs bt-display">Aa Gg Qq &amp; 0123456789</div>
      </div>
    </section>
    <h2 class="bt-part bt-display">In the app</h2>
    <p>The first screen on the Cumulus sky, the library and a saved page, with the headline and titles in ${esc(faceName(p.display))}.</p>
    <div class="bt-phones">
      ${screen('app', 'proposals-sign-in--cumulus-top-medium', 'First screen', p)}
      ${screen('app', 'current-library--library', 'Library', p)}
      ${screen('app', 'current-save-detail--full-page', 'A saved page', p)}
    </div>
    <h2 class="bt-part bt-display">On the web</h2>
    <p>foundkeep.app, the scenic sign-in and the dashboard library.</p>
    <div class="bt-screens">
      ${screen('dashboard', 'current-landing--landing', 'foundkeep.app', p)}
      ${screen('dashboard', 'current-sign-in--log-in', 'Log in', p)}
      ${screen('dashboard', 'current-library--library', 'Dashboard library', p)}
    </div>`;
  return el;
}

function compare() {
  const el = document.createElement('div');
  el.className = 'bt';
  el.innerHTML = `<header class="bt-intro"><div><h1>Brand type</h1><p>Seven ways FoundKeep could sound. Each pairing opens as a board: a specimen on the Cumulus sky, then the app and the dashboard set in it. The Type toolbar in the App and Dashboard Storybooks tries any pairing on any screen.</p></div></header>
    <div class="bt-compare">${Object.values(PAIRINGS).map(p => `
      <a class="bt-row" style="${vars(p)}" href="./?path=/story/brand-type--${p.id}" target="_top">
        <div><div class="bt-row-name">${esc(p.name)}</div><div class="bt-row-note">${esc(p.source)}. ${esc(p.mood)}</div></div>
        <div class="bt-row-sample"><div class="bt-display">Found it? Keep it.</div><p>Save a page from your browser, a photo from your phone, a line you highlighted. Find it again whenever you need it.</p></div>
      </a>`).join('')}</div>`;
  return el;
}

export default { title: 'Brand type', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const Compare = { name: 'All pairings', render: compare };
export const MonoJakarta = { name: 'Space Mono + Plus Jakarta Sans', render: () => board('mono-jakarta') };
export const Instrument = { name: 'Instrument Serif + Instrument Sans', render: () => board('instrument') };
export const YoungInstrument = { name: 'Young Serif + Instrument Sans', render: () => board('young-instrument') };
export const SyneInter = { name: 'Syne + Inter', render: () => board('syne-inter') };
export const RethinkSpectral = { name: 'Rethink Sans + Spectral', render: () => board('rethink-spectral') };
export const InstrumentGeist = { name: 'Instrument Sans + Geist', render: () => board('instrument-geist') };
export const Today = { name: 'As designed (Inter)', render: () => board('today') };
