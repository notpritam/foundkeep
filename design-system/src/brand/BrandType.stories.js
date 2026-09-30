// Brand type (2026-09-30). Pritam: the brand face is Apple's — SF Pro, the
// system font on his Mac and iPhone (-apple-system in tokens.json; Inter
// stands in elsewhere). Expressive faces are kept for moments like sign-in
// and onboarding: the "Keep every" styles of the app's first screen. The
// screens come from the App and Dashboard Storybooks, so they exist only in
// the full build.
import './brand.css';
import sky from '../../../apps/mobile/assets/images/sign-in-backgrounds/sky-cumulus-top-medium.webp';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A screen from the App or Dashboard Storybook, in its device frame. */
function screen(book, id, caption, wide = false) {
  const globals = book === 'dashboard' ? 'device:laptop' : 'device:iphone-17-pro';
  return `<figure${wide ? ' class="bt-wide"' : ''}>
    <iframe loading="lazy" title="${esc(caption)}" src="./${book}/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(globals)}"></iframe>
    <figcaption>${esc(caption)}</figcaption></figure>`;
}

function brand() {
  const el = document.createElement('div');
  el.className = 'bt';
  el.innerHTML = `
    <header class="bt-intro">
      <div><h1>SF Pro</h1><p>Apple’s own typeface is FoundKeep’s: the system font on Mac and iPhone, so the app, the extension and the site read like the devices they run on. Where SF isn’t installed (Windows, Android, Linux), Inter stands in.</p></div>
      <div class="bt-roles"><span>Everything: <strong>SF Pro</strong></span><span>Moments: <strong>see Keep every styles</strong></span></div>
    </header>
    <section class="bt-specimen" aria-label="Type specimen">
      <div class="bt-poster" style="background-image:url(${sky})">
        <h2>Found it? Keep it.</h2>
      </div>
      <div class="bt-text">
        <h3>A place for the things worth keeping.</h3>
        <p>Save a page from your browser, a photo from your phone, a line you highlighted. FoundKeep keeps them in one private collection and brings them back when you need them.</p>
        <div class="bt-ui"><button type="button">Continue with Google</button><button type="button">Add details</button><span>Reading list</span><span>Design</span></div>
        <div class="bt-meta">Saved from the web, 2 minutes ago. 1,284 finds in 36 folders.</div>
        <div class="bt-weights"><span style="font-weight:300">Light</span><span style="font-weight:400">Regular</span><span style="font-weight:500">Medium</span><span style="font-weight:600">Semibold</span><span style="font-weight:700">Bold</span><span style="font-weight:800">Heavy</span><span style="font-weight:900">Black</span></div>
      </div>
    </section>
    <h2 class="bt-part">In the app</h2>
    <p>iOS draws SF Pro on its own: the app sets no family.</p>
    <div class="bt-phones">
      ${screen('app', 'current-library--library', 'Library')}
      ${screen('app', 'current-save-detail--full-page', 'A saved page')}
      ${screen('app', 'current-you--you', 'You')}
    </div>
    <h2 class="bt-part">On the web</h2>
    <p>foundkeep.app and the dashboard, through <code>--fk-font-sans</code>.</p>
    <div class="bt-screens">
      ${screen('dashboard', 'current-landing--landing', 'foundkeep.app', true)}
      ${screen('dashboard', 'current-library--library', 'Dashboard library')}
      ${screen('dashboard', 'current-save-detail--page', 'A saved page')}
    </div>`;
  return el;
}

const KEEP = [
  ['keep-serif', 'SF Pro + Instrument Serif italic'],
  ['keep-hand', 'SF Pro + Caveat, tilted (chosen)'],
  ['keep-mono', 'SF Pro + Space Mono, in a field'],
  ['keep-soft', 'Instrument Serif + SF Pro Heavy'],
  ['keep-weight', 'SF Pro only, light over black'],
  ['keep-per-find', 'A style for each find'],
];
function keep() {
  const el = document.createElement('div');
  el.className = 'bt';
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Keep every styles</h1><p>The first screen’s headline is where FoundKeep gets to show off. “Keep every” stays in SF Pro; the word that changes (Reel, Short, Article, Tweet, Post, Thread: what you come across while browsing) takes a face and a frame of its own. The same styles can carry onboarding and the sign-in page on the web.</p></div></header>
    <div class="bt-phones bt-phones-six">${KEEP.map(([id, name]) => screen('app', `proposals-sign-in--${id}`, name)).join('')}</div>`;
  return el;
}

export default { title: 'Brand type', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const SFPro = { name: 'SF Pro', render: brand };
export const KeepEvery = { name: 'Keep every styles', render: keep };
