// The sign-in page, side by side (2026-10-01). Pritam judges on the page, not
// from the parts: the two versions, and how the first one's floating cards keep
// moving — live, from the App Storybook (full build only).
import '../brand/brand.css';

const PAGES = [
  ['proposals-sign-in-movement--drift', 'Drift (today): a small float and turn'],
  ['proposals-sign-in-movement--spotlight', 'Spotlight: the card for the word lifts forward'],
  ['proposals-sign-in-movement--orbit', 'Orbit: a slow loop round each card’s place'],
  ['proposals-sign-in-movement--bob', 'Bob and sway: floating on water'],
  ['proposals-sign-in-movement--rise', 'Rise: drifting up, fading at the top, back from below'],
];

function movement() {
  const el = document.createElement('div');
  el.className = 'bt';
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Movement on the sign-in page</h1><p>The locked first screen with the floating cards, live, in each way they could keep moving once they have arrived. The entrance is the same in all five.</p></div></header>
    <div class="bt-phones bt-phones-six">${PAGES.map(([id, name]) => `<figure>
      <iframe loading="lazy" title="Sign-in page, ${name}" src="./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent('device:iphone-17-pro')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  return el;
}

function versions() {
  const el = document.createElement('div');
  el.className = 'bt';
  const pages = [['proposals-sign-in--first-screen', 'One: floating cards over the sky (locked)'], ['proposals-sign-in--with-film', 'Two: a light page with a window playing a film of FoundKeep at work'], ['proposals-sign-in--with-film-on-sky', 'Three: the film on the sky, its own sky far softer']];
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Sign-in versions</h1><p>The locked first screen; a second after Pritam’s reference, a light page with a window that plays an 11-second film of FoundKeep at work (share a reel, it lands in one place, find it again, your agent uses it); and a third with that film on version one’s sky. All live. The films: <a href="./downloads/sign-in-film.mp4" download>sign-in-film.mp4</a>, <a href="./downloads/sign-in-film-soft.mp4" download>sign-in-film-soft.mp4</a>; prompts for AI video tools: <a href="./downloads/sign-in-film-ai-prompts.md" download>sign-in-film-ai-prompts.md</a>.</p></div></header>
    <div class="bt-phones bt-phones-three">${pages.map(([id, name]) => `<figure>
      <iframe loading="lazy" title="${name}" src="./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent('device:iphone-17-pro')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  return el;
}

export default { title: 'Sign in', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const TwoVersions = { name: 'Versions', render: versions };
export const Movement = { name: 'Movement on the page', render: movement };
