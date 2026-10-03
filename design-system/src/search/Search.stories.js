// Search, recent folders and tags, and Kit (2026-10-03): four ways side by side, live. The
// buttons switch every phone between the Library, searching and Kit answering (no reload), and
// light or dark.
import '../brand/brand.css';

function fourWays() {
  const el = document.createElement('div');
  el.className = 'bt';
  const looks = [
    ['proposals-search-and-kit--dock-search', 'Search beside + in the dock: a round button, opening the field at the top'],
    ['proposals-search-and-kit--ask-bar', '“Search or ask Kit”, always above the dock: the field opens at the bottom, by the thumb'],
    ['proposals-search-and-kit--search-tab', 'Search as a tab, between Gallery and You'],
    ['proposals-search-and-kit--search-first', 'The field heading the Library, recent searches right under it'],
  ];
  const src = (id, theme) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Search and Kit</h1><p>One field — “Search or ask Kit” — and no switch: searching is asking Kit. A word finds its matches; a question (“that ramen video I saved”) gets a line from Kit on top of the same results. The backend decides which; here a stand-in reads the library on the phone. The kind tabs give way to Jump back in — the folders your saves went into as cards with their last saves, then the tags (#Cooking), newest first; tap one to see just those. Locked, so it heads every one. Recent searches are big and easy to hit. Four places for the field, on today’s Library with its locked card; scroll any of them and the dock tucks in.</p></div></header>
    <div class="bt-states" role="group" aria-label="State">
      <button type="button" data-state="library" aria-pressed="true">The Library</button><button type="button" data-state="word" aria-pressed="false">A word</button><button type="button" data-state="question" aria-pressed="false">A question</button>
      <span class="bt-gap"></span><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button>
    </div>
    <div class="bt-phones bt-phones-four">${looks.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  let theme = 'light', state = 'library';
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const key = button.dataset.state ? 'state' : 'theme';
    el.querySelectorAll(`.bt-states button[data-${key}]`).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    if (key === 'theme') { theme = button.dataset.theme; el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = `${src(frame.dataset.story, theme)}&args=${encodeURIComponent(`state:${state}`)}`; }); return; }
    state = button.dataset.state;
    el.querySelectorAll('iframe[data-story]').forEach(frame => frame.contentWindow?.__STORYBOOK_ADDONS_CHANNEL__?.emit('updateStoryArgs', { storyId: frame.dataset.story, updatedArgs: { state } }));
  });
  return el;
}

export default { title: 'Search and Kit', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const FourWays = { name: 'Four ways', render: fourWays };
