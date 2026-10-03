// A save, opened — locked 2026-10-03: With Kit, cleaned, then the four shapes it was picked from,
// side by side and live. The buttons switch every phone to another kind of save (no reload) —
// including three shaped like real saves from the audit — or to light or dark.
import '../brand/brand.css';

const KINDS = [
  ['article', 'An article'], ['post', 'A post on X'], ['sharedPost', 'A post shared from the iPhone'], ['postNotKept', 'A post whose words weren’t kept'],
  ['sharedLink', 'A link shared as text'], ['sharedVideo', 'A YouTube video, named'], ['sharedReddit', 'A Reddit post, named'], ['photoPost', 'A post with a photo'], ['reel', 'A reel'], ['recipe', 'A recipe'], ['video', 'A video'], ['photo', 'A photo'],
  ['screenshot', 'A screenshot'], ['fullPage', 'A full page'], ['note', 'A note'], ['highlight', 'A highlight'], ['pdf', 'A PDF'], ['voiceMemo', 'A voice memo'],
  ['preparing', 'Still being read'], ['failed', 'Couldn’t be read'],
];
const FINAL = ['final-6-save-detail--article', 'Final: With Kit, cleaned — the mark, who and when open the original; the post’s words lead; your note as yours; tags and the rest quietly at the bottom; Kit by the thumb'];
const TRIED = [
  ['tried-save-detail--with-kit', 'With Kit, as first shown (picked)'],
  ['tried-save-detail--picture-first', 'Picture first, actions by the thumb'],
  ['tried-save-detail--reader', 'Reader: the words first'],
  ['tried-save-detail--sheet', 'A sheet over the Library'],
];

function finalAndShapes() {
  const el = document.createElement('div');
  el.className = 'bt';
  const src = (id, theme, kind) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}&args=${encodeURIComponent(`kind:${kind}`)}`;
  const phones = list => `<div class="bt-phones bt-phones-four">${list.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light', 'article')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>A save, opened</h1><p>Locked: With Kit, cleaned. Where it came from and opening it are one line (the platform’s mark, who, when, ↗). A post’s own words lead it — from the copy kept on the server when the save has none — and your note sits under them as yours, never as the title. A summary leads only when it says something new. Tags, the date, how it was saved and the folder are one quiet block at the bottom. Kit stays by the thumb: Sum it up, More like it, Where is it from?, or your own question. Beside it, the four shapes it was picked from. Pick a kind of save to switch every phone.</p></div></header>
    <div class="bt-states" role="group" aria-label="Kind of save">${KINDS.map(([kind, name], index) => `<button type="button" data-kind="${kind}" aria-pressed="${index === 0}">${name}</button>`).join('')}</div>
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button></div>
    <h2 class="bt-part">Final</h2>${phones([FINAL])}
    <h2 class="bt-part">The shapes it was picked from</h2>${phones(TRIED)}`;
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

export default { title: 'Decided/Save detail', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const FinalAndShapes = { name: 'Final, and the shapes it was picked from', render: finalAndShapes };
