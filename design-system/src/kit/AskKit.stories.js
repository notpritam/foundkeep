// Ask Kit (2026-10-03): the conversation, four ways, side by side and live. The buttons switch
// every phone between just opened, one question and a follow-up (no reload), and light or dark.
import '../brand/brand.css';

function fourConversations() {
  const el = document.createElement('div');
  el.className = 'bt';
  const looks = [
    ['proposals-ask-kit--chat', 'Picked · A conversation: your questions and Kit’s answers, the saves it found in a row of cards'],
    ['proposals-ask-kit--grid', 'Answers laid out like the Library; earlier turns fold to one line'],
    ['proposals-ask-kit--half', 'A half sheet: the Library above becomes Kit’s answer, the conversation stays below'],
    ['proposals-ask-kit--trail', 'No bubbles: what Kit understood, as chips you can take away; the saves as a list'],
  ];
  const src = (id, theme, state, entry) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}&args=${encodeURIComponent(`state:${state};entry:${entry}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Ask Kit</h1><p>Two ways in. Search: the magnifier on top opens a plain search — recent searches and Jump back in, then the saves that match, with “Ask Kit about …” to hand the words to Kit. Kit: beside + in the dock — its logo, or a pill that says “Ask Kit” — opening a conversation at the bottom, by the thumb: “recent post I saved from Twitter”, then “about cats”, and Kit keeps up. Four ways to hold the conversation. Type or tap in any phone. Kit here is a stand-in reading the sample library; the real one answers on the backend.</p></div></header>
    <div class="bt-states" role="group" aria-label="State">
      <button type="button" data-state="library" aria-pressed="false">The Library</button><button type="button" data-state="search" aria-pressed="false">Searching</button><button type="button" data-state="open" aria-pressed="false">Kit just opened</button><button type="button" data-state="first" aria-pressed="false">One question</button><button type="button" data-state="followup" aria-pressed="true">A follow-up</button>
      <span class="bt-gap"></span><button type="button" data-entry="orb" aria-pressed="true">Kit’s logo</button><button type="button" data-entry="pill" aria-pressed="false">“Ask Kit”</button>
      <span class="bt-gap"></span><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button>
    </div>
    <div class="bt-phones bt-phones-four">${looks.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light', 'followup', 'orb')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  let theme = 'light', state = 'followup', entry = 'orb';
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const key = button.dataset.state ? 'state' : button.dataset.entry ? 'entry' : 'theme';
    el.querySelectorAll(`.bt-states button[data-${key}]`).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    if (key === 'theme') { theme = button.dataset.theme; el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, theme, state, entry); }); return; }
    if (key === 'entry') entry = button.dataset.entry; else state = button.dataset.state;
    el.querySelectorAll('iframe[data-story]').forEach(frame => frame.contentWindow?.__STORYBOOK_ADDONS_CHANNEL__?.emit('updateStoryArgs', { storyId: frame.dataset.story, updatedArgs: { state, entry } }));
  });
  return el;
}

/** As locked (2026-10-03): every state of Search and Ask Kit, live. */
function locked() {
  const el = document.createElement('div');
  el.className = 'bt';
  const states = [
    ['current-search-and-ask-kit--library', 'The Library: the magnifier on top for Search; Kit’s orb beside + for Ask Kit'],
    ['current-search-and-ask-kit--search', 'Search, just opened: Jump back in and recent searches; the field at the bottom'],
    ['current-search-and-ask-kit--search-word', 'Search for a word: the saves that match, and “Ask Kit about …”'],
    ['current-search-and-ask-kit--kit', 'Ask Kit, just opened: what to ask, the field at the bottom'],
    ['current-search-and-ask-kit--question', 'One question: Kit’s one-line answer, the saves in a row of cards'],
    ['current-search-and-ask-kit--follow-up', 'A follow-up: “about cats” narrows the posts from X'],
  ];
  const src = (id, theme) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Search and Ask Kit, as locked</h1><p>The magnifier on top opens Search — its field at the bottom, by the thumb. Kit’s orb (the logo only) beside + opens Ask Kit: a conversation, each answer one short line, a touch larger, with the saves it found in a row of the Library’s cards. Every state, live; type and tap in any phone. Not in the app’s Library yet.</p></div></header>
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button></div>
    <div class="bt-phones bt-phones-three">${states.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    el.querySelectorAll('.bt-states button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, button.dataset.theme); });
  });
  return el;
}

/** Closed (2026-10-03): the final home and Ask Kit, then variations of each, live. */
function finalAndVariations() {
  const el = document.createElement('div');
  el.className = 'bt';
  const home = [
    ['proposals-home-and-ask-kit--home-final', 'Final: “The collection.”, Jump back in, the cards; the magnifier on top, Kit’s orb beside +'],
    ['proposals-home-and-ask-kit--home-greeting', 'A greeting: “Good evening, Lena” and your counts, in place of “The collection.”'],
    ['proposals-home-and-ask-kit--home-compact', 'Compact: no big title — Jump back in right under the top bar, more saves in view'],
    ['proposals-home-and-ask-kit--home-nudge', 'A nudge: a small card under Jump back in that asks Kit an example question'],
  ];
  const kit = [
    ['proposals-home-and-ask-kit--kit-final', 'Final: one short line per answer, the saves in a row of cards'],
    ['proposals-home-and-ask-kit--kit-list', 'The saves as a list under each answer: quicker to scan'],
    ['proposals-home-and-ask-kit--kit-lead', 'The best match large, the rest in a row'],
    ['proposals-home-and-ask-kit--kit-thinking', 'A thinking moment: “Looking through your saves…” before each answer'],
  ];
  const src = (id, theme) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}`;
  const row = list => `<div class="bt-phones bt-phones-four">${list.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Home and Ask Kit: final, and variations</h1><p>Both closed. The first phone in each row is the final — the home screen as locked, and Ask Kit as a conversation with one short line per answer. Beside each, variations of it. Every phone is live: tap the magnifier, tap Kit’s orb, type a follow-up.</p></div></header>
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button><span class="bt-gap"></span><button type="button" data-restart>Play again</button></div>
    <h2 class="bt-part">Home</h2>${row(home)}
    <h2 class="bt-part">Ask Kit</h2>${row(kit)}`;
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

export default { title: 'Ask Kit', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const FinalAndVariations = { name: 'Home and Ask Kit: final, and variations', render: finalAndVariations };
export const Locked = { name: 'Search and Ask Kit, as locked', render: locked };
export const FourConversations = { name: 'Four conversations', render: fourConversations };
