// The app, start to finish, as decided (2026-10-03): every final screen in the order a person
// meets it, live, on one page. What's still to design is marked; the Flow map in the App
// section has every state.
import '../brand/brand.css';

function startToFinish() {
  const el = document.createElement('div');
  el.className = 'bt';
  const screens = [
    ['final-1-sign-in--sign-in-screen', '1 · Sign in: the cards drift in over the sky; Google or Apple'],
    ['final-1-sign-in--handoff', '2 · After Continue with Google: the cards gather while it opens'],
    ['final-2-first-run--save-from-anywhere', '3 · First run: save from any app (to be remade from a recording)'],
    ['final-3-home-search-and-ask-kit--library', '4 · Home: a greeting, Jump back in, the cards'],
    ['final-3-home-search-and-ask-kit--search-word', '5 · Search: from the magnifier, the field at the bottom'],
    ['final-3-home-search-and-ask-kit--follow-up', '6 · Ask Kit: a conversation, one short line per answer'],
    ['final-6-save-detail--shared-post', '7 · A save, opened: the post’s words, your note, Kit by the thumb'],
    ['in-the-app-today-you--you', '8 · You — not designed yet (today’s screen)'],
  ];
  const src = (id, theme) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>The app, start to finish</h1><p>Every screen as decided, in the order a person meets it — all live: sign in, the cards gathering while Google opens, first run, home, search, Ask Kit, a save opened. The last is the app as it is today, next in line. Each step’s other states are in the App section’s Flow map; how each was chosen is in the Design log.</p></div></header>
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button><span class="bt-gap"></span><a href="./app/?path=/story/flow-map--app" target="_top">The Flow map, every state →</a></div>
    <div class="bt-phones bt-phones-four">${screens.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    el.querySelectorAll('.bt-states button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, button.dataset.theme); });
  });
  return el;
}

export default { title: 'The app', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const StartToFinish = { name: 'Start to finish', render: startToFinish };
