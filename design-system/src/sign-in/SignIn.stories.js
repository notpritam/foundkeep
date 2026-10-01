// The sign-in page with each element style, side by side (2026-10-01). Pritam
// can't judge a style from the objects alone, so every candidate is shown on
// the locked first screen itself, live, from the App Storybook (full build only).
import '../brand/brand.css';

const PAGES = [
  ['proposals-sign-in--first-screen', 'Porcelain (today)'],
  ['proposals-sign-in-elements--style-glass', 'Glass'],
  ['proposals-sign-in-elements--style-glass-depth', 'Glass, with depth'],
  ['proposals-sign-in-elements--style-cards', 'Cards'],
  ['proposals-sign-in-elements--style-cards-depth', 'Cards, with depth'],
  ['proposals-sign-in-elements--style-paper', 'Paper'],
  ['proposals-sign-in-elements--style-cloud', 'Cloud'],
  ['proposals-sign-in-elements--style-photo', 'Photo'],
  ['proposals-sign-in-elements--style-clay', 'Clay'],
];

function styles() {
  const el = document.createElement('div');
  el.className = 'bt';
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Element styles on the sign-in page</h1><p>The locked first screen with each style of floating elements, live. Depth keeps the words in focus: the nearest objects go a little soft and the farthest fade into the sky.</p></div></header>
    <div class="bt-phones bt-phones-six">${PAGES.map(([id, name]) => `<figure>
      <iframe loading="lazy" title="Sign-in page, ${name}" src="./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent('device:iphone-17-pro')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  return el;
}

export default { title: 'Sign in', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const ElementStyles = { name: 'Element styles on the page', render: styles };
