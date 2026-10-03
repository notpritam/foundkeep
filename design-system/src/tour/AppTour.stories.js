// The app, start to finish, in four versions side by side (2026-10-03): for choosing which go in
// the video and the poll on X. Each plays by itself — sign in, the Library, search, Kit.
import '../brand/brand.css';

function fourVersions() {
  const el = document.createElement('div');
  el.className = 'bt';
  const tours = [
    ['proposals-app-tour--conversation', '1 · A conversation, as locked: Kit’s one-line answers, the saves in a row of cards'],
    ['proposals-app-tour--grid', '2 · Answers laid out like the Library: each answer a grid of cards'],
    ['proposals-app-tour--half', '3 · A half sheet: the Library above becomes Kit’s answer'],
    ['proposals-app-tour--trail', '4 · What Kit understood, as chips you can take away'],
  ];
  const src = (id, theme) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>The app, start to finish</h1><p>Each phone plays the whole flow by itself, in about 24 seconds: sign in with Google, the cards gather while Google opens, the Library loads, a search for “ramen”, then Kit — “recent post I saved from twitter”, then “about cats”. The four differ in how Kit answers. Pick the ones for the video and the poll on X; the video comes later, rendered from these frame by frame (design-system/film/tour.mjs).</p></div></header>
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button><span class="bt-gap"></span><button type="button" data-restart>Play from the start</button></div>
    <div class="bt-phones bt-phones-four">${tours.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  let theme = 'light';
  const reload = () => el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, theme); });
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if ('restart' in button.dataset) { reload(); return; }
    el.querySelectorAll('.bt-states button[data-theme]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    theme = button.dataset.theme; reload();
  });
  return el;
}

export default { title: 'App tour', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const FourVersions = { name: 'Four versions', render: fourVersions };
