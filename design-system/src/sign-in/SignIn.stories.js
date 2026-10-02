// The sign-in page, side by side (2026-10-01). Pritam judges on the page, not
// from the parts: the two versions, and how the first one's floating cards keep
// moving — live, from the App Storybook (full build only).
import '../brand/brand.css';

const PAGES = [
  ['proposals-sign-in-movement--drift', 'Drift (in the app): a small float and turn'],
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
  const pages = [['current-sign-in--sign-in-screen', 'One: floating cards over the sky (in the app)'], ['proposals-sign-in--with-film', 'Two: a light page with a window playing a film of FoundKeep at work'], ['proposals-sign-in--with-film-on-sky', 'Three: the film on the sky, its own sky far softer']];
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Sign-in versions</h1><p>The sign-in screen in the app (version one, the poll’s pick); a second after Pritam’s reference, a light page with a window that plays an 11-second film of FoundKeep at work (share a reel, it lands in one place, find it again, your agent uses it); and a third with that film on version one’s sky. Two and three are kept for an A/B test. All live. The films: <a href="./downloads/sign-in-film.mp4" download>sign-in-film.mp4</a>, <a href="./downloads/sign-in-film-soft.mp4" download>sign-in-film-soft.mp4</a>; prompts for AI video tools: <a href="./downloads/sign-in-film-ai-prompts.md" download>sign-in-film-ai-prompts.md</a>.</p></div></header>
    <div class="bt-phones bt-phones-three">${pages.map(([id, name]) => `<figure>
      <iframe loading="lazy" title="${name}" src="./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent('device:iphone-17-pro')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  return el;
}

/** The film versions' variations, so they can be judged side by side on the page. */
function filmVariations() {
  const el = document.createElement('div');
  el.className = 'bt';
  const pages = [
    ['proposals-sign-in--with-film', 'White page, clear film (version two)'],
    ['proposals-sign-in--film-white-soft', 'White page, soft film'],
    ['proposals-sign-in--film-sky-clear', 'Sky page, clear film'],
    ['proposals-sign-in--with-film-on-sky', 'Sky page (blur 1), soft film (version three)'],
    ['proposals-sign-in--film-sky-blur-6', 'Sky page blurred 6, soft film'],
    ['proposals-sign-in--film-sky-blur-14', 'Sky page blurred 14, soft film'],
  ];
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Film variations</h1><p>The sign-in page with the film, six ways: a white page or version one’s sky; the film’s own sky lightly softened (clear) or far more blurred (soft); and the page’s sky at blur 1, 6 and 14. Two and three are kept for an A/B test. All live. The films: <a href="./downloads/sign-in-film.mp4" download>clear</a>, <a href="./downloads/sign-in-film-soft.mp4" download>soft</a>; prompts for AI video tools: <a href="./downloads/sign-in-film-ai-prompts.md" download>sign-in-film-ai-prompts.md</a>.</p></div></header>
    <div class="bt-phones bt-phones-three">${pages.map(([id, name]) => `<figure>
      <iframe loading="lazy" title="${name}" src="./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent('device:iphone-17-pro')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  return el;
}

/** After "Continue with Google" (2026-10-02): four ways to show the handoff,
 * side by side; the buttons above set every phone to one state at once, live
 * (the phones animate into it — no reload). */
function handoff() {
  const el = document.createElement('div');
  el.className = 'bt';
  const looks = [
    ['proposals-sign-in-handoff--on-screen', 'The buttons become a card: the sign-in screen stays, and the card says what is happening'],
    ['proposals-sign-in-handoff--sheet', 'A sheet over sign-in, like the system’s own sign-in sheets'],
    ['proposals-sign-in-handoff--gather', 'The cards gather into a slow ring round Google’s mark'],
    ['proposals-sign-in-handoff--quiet', 'A calm light page with Google’s mark, breathing while it waits'],
  ];
  const states = [['play', 'Play it through'], ['choose', 'Sign-in'], ['opening', 'Opening'], ['browser', 'Waiting'], ['finishing', 'Signing in'], ['failed', 'Didn’t finish'], ['link', 'Already have a collection']];
  el.innerHTML = `
    <header class="bt-intro"><div><h1>After “Continue with Google”</h1><p>The next screen in the flow: FoundKeep opens Google (or Apple) in the browser, waits, and signs you in when you come back — or says why it didn’t, or asks once for the password of a collection you already have. Four ways to show it, all live. Pick a state to see it on all four at once; inside a phone, the buttons work too.</p></div></header>
    <div class="bt-states" role="group" aria-label="State">${states.map(([phase, label]) => `<button type="button" data-phase="${phase}" aria-pressed="${phase === 'play'}">${label}</button>`).join('')}<span class="bt-gap"></span>${[['google', 'Google'], ['apple', 'Apple']].map(([provider, label]) => `<button type="button" data-provider="${provider}" aria-pressed="${provider === 'google'}">${label}</button>`).join('')}</div>
    <div class="bt-phones bt-phones-four">${looks.map(([id, name]) => `<figure>
      <iframe loading="lazy" data-story="${id}" title="${name}" src="./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent('device:iphone-17-pro')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  const chosen = { phase: 'play', provider: 'google' };
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const key = button.dataset.phase ? 'phase' : 'provider';
    chosen[key] = button.dataset[key];
    el.querySelectorAll(`.bt-states button[data-${key}]`).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    // Straight into each phone's story: its frame passes the change on to the screen inside.
    el.querySelectorAll('iframe[data-story]').forEach(frame => frame.contentWindow?.__STORYBOOK_ADDONS_CHANNEL__?.emit('updateStoryArgs', { storyId: frame.dataset.story, updatedArgs: { ...chosen } }));
  });
  return el;
}

/** The three Pritam shortlisted (2026-10-01), as numbered in the poll video. */
function pickOne() {
  const el = document.createElement('div');
  el.className = 'bt';
  const pages = [
    ['current-sign-in--sign-in-screen', '1 · Elements flying in (in the app)'],
    ['proposals-sign-in--with-film', '2 · White page, clear film'],
    ['proposals-sign-in--with-film-on-sky', '3 · Sky page, soft film'],
  ];
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Pick one</h1><p>The shortlist: the floating elements over the sky, the film on a white page, and the soft film on the sky. All live, playing the films in 4K. To share, the three side by side on a moving gradient, no words: wide <a href="./downloads/sign-in-poll-1080p.mp4" download>1080p</a> · <a href="./downloads/sign-in-poll-4k.mp4" download>4K</a>; tall, for Reels, <a href="./downloads/sign-in-reel-1080x1920.mp4" download>1080 × 1920</a> · <a href="./downloads/sign-in-reel-4k.mp4" download>4K</a>.</p></div></header>
    <div class="bt-phones bt-phones-three">${pages.map(([id, name]) => `<figure>
      <iframe loading="lazy" title="${name}" src="./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent('device:iphone-17-pro')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  return el;
}

export default { title: 'Sign in', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const Handoff = { name: 'After Continue with Google', render: handoff };
export const PickOne = { name: 'Pick one', render: pickOne };
export const FilmVariations = { name: 'Film variations', render: filmVariations };
export const TwoVersions = { name: 'Versions', render: versions };
export const Movement = { name: 'Movement on the page', render: movement };
