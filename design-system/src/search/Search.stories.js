// Search, recent folders and tags, and Kit (2026-10-03): four ways side by side, live. The
// buttons switch every phone between the Library, searching and Kit answering (no reload), and
// light or dark.
import '../brand/brand.css';

function fourWays() {
  const el = document.createElement('div');
  el.className = 'bt';
  const looks = [
    ['proposals-search-and-kit--dock-search', 'Search beside + in the dock: a round search button, opening search over the Library'],
    ['proposals-search-and-kit--ask-bar', 'An ask bar: “Search or ask Kit”, always there above the dock, within the thumb’s reach'],
    ['proposals-search-and-kit--kit-in-dock', 'Kit in the dock: between Gallery and You; asking is a conversation, typing still searches'],
    ['proposals-search-and-kit--search-first', 'Search first: a big field heading the Library, recent searches right under it'],
  ];
  const src = (id, theme) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Search and Kit</h1><p>The kind tabs (links, images, notes, documents) give way to the folders and tags your saves actually went into — worked out from the library, newest first; tap one to see just those. Recent searches are big and easy to hit. Search gets a place of its own, and Kit — your agent — a proper way in: ask in your own words (“that ramen video I saved”), or type a word to search. Four ways, on today’s Library with its locked card. Kit here reads the library on the phone; the real one answers through FoundKeep’s agent.</p></div></header>
    <div class="bt-states" role="group" aria-label="State">
      <button type="button" data-state="library" aria-pressed="true">The Library</button><button type="button" data-state="search" aria-pressed="false">Searching</button><button type="button" data-state="kit" aria-pressed="false">Kit answering</button>
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
