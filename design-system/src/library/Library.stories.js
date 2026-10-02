// The Library (2026-10-02): four layouts proposed for where first run hands
// you, side by side and live, beside today's. Light or dark switches every
// phone at once.
import '../brand/brand.css';

function fourWays() {
  const el = document.createElement('div');
  el.className = 'bt';
  const looks = [
    ['current-library--before-scroll-edge', 'Today, as it was: “The collection.”, search, kind tabs, a masonry of mixed cards'],
    ['current-library--with-scroll-edge', 'Picked · Today, with the scroll edge: the list runs under a see-through top bar and the dock, blurring as it passes'],
    ['proposals-library--cards', 'Cards: the sign-in screen’s cards — a picture, the title, nothing above it — in two columns'],
    ['proposals-library--grid', 'Grid, like Photos: three across, edge to edge, by day; a small mark for videos, posts and links'],
    ['proposals-library--shelves', 'Shelves by kind: just saved, videos, to read, posts, photos, notes — each scrolling sideways'],
    ['proposals-library--list', 'List: dense and quiet — picture, title, where it came from — by day'],
  ];
  const src = (id, theme) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Library</h1><p>Where first run hands you, and where you come back to find what you kept. Today’s, today’s with the scroll edge (scroll it: what passes under the top bar and the dock blurs, as in Pritam’s reference), then four layouts — each a real screen on the sample library (now with reels, posts, recipes and places), opening a save when it’s tapped. All live; scroll inside any phone.</p></div></header>
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button></div>
    <div class="bt-phones bt-phones-three">${looks.map(([id, name]) => `<figure>
      <iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    el.querySelectorAll('.bt-states button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, button.dataset.theme); });
  });
  return el;
}

/** The cards (2026-10-02): every kind of save as today's card and three clean ones, side by
 * side, then each inside today's Library. Light or dark switches it all. */
function cards() {
  const el = document.createElement('div');
  el.className = 'bt';
  const phones = [
    ['current-library--with-scroll-edge', 'Today’s cards'],
    ['proposals-cards--in-library-quiet', 'Quiet: picture, title, where it came from and when'],
    ['proposals-cards--in-library-pills', 'With pills: the same, with the folder and first tags'],
    ['proposals-cards--in-library-marked', 'Marked: the platform’s mark on the picture; when and the folder below'],
  ];
  const src = (id, theme, phone = true) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`${phone ? 'device:iphone-17-pro;' : ''}theme:${theme}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Cards for every kind of save</h1><p>Clearing the Library’s cards out: the picture first, the title with nothing above it, and one line. Three ways — quiet, with pills, marked — for every kind of save, beside today’s card; then each inside today’s Library, with the scroll edge. The kind of save shows in the picture itself: a play mark (tall for a reel or a short), a page for a PDF, a quote, a note’s tint, a sound wave, a stack.</p></div></header>
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button></div>
    <div class="bt-phones bt-phones-four">${phones.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>
    <iframe class="bt-matrix" data-story="proposals-cards--every-kind" data-wide title="Every kind of save, four ways" src="${src('proposals-cards--every-kind', 'light', false)}" style="height:1200px"></iframe>`;
  // The matrix grows to its full height, so the page scrolls rather than the frame.
  const matrix = el.querySelector('.bt-matrix');
  const fit = () => { try { const h = matrix.contentDocument?.querySelector('#storybook-root')?.scrollHeight; if (h > 400) matrix.style.height = `${h + 40}px`; } catch {} };
  matrix.addEventListener('load', () => { setTimeout(fit, 1500); setTimeout(fit, 4000); });
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    el.querySelectorAll('.bt-states button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, button.dataset.theme, !('wide' in frame.dataset)); });
  });
  return el;
}

export default { title: 'Library', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const Cards = { name: 'Cards for every kind of save', render: cards };
export const FourWays = { name: 'Four ways', render: fourWays };
