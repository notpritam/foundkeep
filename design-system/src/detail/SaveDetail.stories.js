// A save, opened (2026-10-03): four shapes for the detail screen, side by side and live. The
// buttons switch every phone to another kind of save (no reload), or to light or dark.
import '../brand/brand.css';

const LOOKS = [
  ['open-save-detail--picture-first', 'Picture first: the picture, then the words; the save’s one action by the thumb (“Open on X”, “Open the PDF”), Kit’s orb, and more'],
  ['open-save-detail--reader', 'Reader: the words first, set for reading, a smaller picture; the actions on top'],
  ['open-save-detail--sheet', 'A sheet over the Library: rises from the card you tapped, the Library stays behind; tap any card behind it'],
  ['open-save-detail--with-kit', 'With Kit, always there: ready prompts and “Ask Kit about this save” by the thumb, the answers on the page'],
];
const KINDS = [
  ['article', 'An article'], ['recipe', 'A recipe'], ['post', 'A post on X'], ['photoPost', 'A post with a photo'], ['reel', 'A reel'], ['video', 'A video'],
  ['photo', 'A photo'], ['screenshot', 'A screenshot'], ['fullPage', 'A full page'], ['note', 'A note'], ['highlight', 'A highlight'], ['pdf', 'A PDF'],
  ['voiceMemo', 'A voice memo'], ['preparing', 'Still being read'], ['failed', 'Couldn’t be read'],
];

function fourShapes() {
  const el = document.createElement('div');
  el.className = 'bt';
  const src = (id, theme, kind) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}&args=${encodeURIComponent(`kind:${kind}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>A save, opened</h1><p>Today’s screen crops a page’s picture at the sides, puts each part in its own frosted panel under uppercase labels, folds where it came from into “Original source”, and has four small icons on top and no Kit. Four shapes in the locked language — the platform’s mark and short lines in icons, the scroll edge, actions by the thumb, Kit’s orb. Pick a kind of save to switch every phone; tap the picture, the tags, a related save, Kit’s orb or ••• in any of them.</p></div></header>
    <div class="bt-states" role="group" aria-label="Kind of save">${KINDS.map(([kind, name], index) => `<button type="button" data-kind="${kind}" aria-pressed="${index === 0}">${name}</button>`).join('')}</div>
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button></div>
    <div class="bt-phones bt-phones-four">${LOOKS.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light', 'article')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  let theme = 'light', kind = 'article';
  el.querySelectorAll('.bt-states').forEach(group => group.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const key = button.dataset.kind ? 'kind' : 'theme';
    el.querySelectorAll(`.bt-states button[data-${key}]`).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    if (key === 'theme') { theme = button.dataset.theme; el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, theme, kind); }); return; }
    kind = button.dataset.kind;
    el.querySelectorAll('iframe[data-story]').forEach(frame => frame.contentWindow?.__STORYBOOK_ADDONS_CHANNEL__?.emit('updateStoryArgs', { storyId: frame.dataset.story, updatedArgs: { kind } }));
  }));
  return el;
}

export default { title: 'Open/Save detail', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const FourShapes = { name: 'Four shapes, every kind of save', render: fourShapes };
