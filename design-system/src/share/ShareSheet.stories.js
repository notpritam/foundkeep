// Sharing into FoundKeep from another app (2026-10-03): today's sheet and three cleaner shapes, side
// by side and live. The buttons switch every phone to another kind of share or state (no reload),
// or to light or dark.
import '../brand/brand.css';

const PICKED = [
  ['open-share-sheet--card', 'One card, one button: the picture and title, your note, a folder chip, Save full width by the thumb'],
  ['open-share-sheet--composer', 'Composer: your note and Save as one bar at the bottom, as Ask Kit’s field is'],
  ['open-share-sheet--library', 'The Library’s card: the title on a frosted caption, as it will sit in your Library; folders one tap away'],
  ['open-share-sheet--bar', 'A bar on the keyboard: the note written on the sheet; Folder and Save in one bar along the bottom'],
];
const TYPING = [
  ['open-share-sheet--card-typing', 'Typing: the card folds to a row; Save rides on the keyboard'],
  ['open-share-sheet--composer-typing', 'Typing: the note and Save sit on the keyboard together'],
  ['open-share-sheet--library-typing', 'Typing: the card folds, folders stay one tap away, Save on the keyboard'],
  ['open-share-sheet--bar-typing', 'Typing: Folder and Save on the keyboard, the note above'],
];
const ASIDE = [
  ['in-the-app-today-share-sheet--share-sheet', 'Today: Cancel/Save, a big title, a status sentence, “↗ Bookmark” for a reel, a note box, Folder and Tags buttons'],
  ['open-share-sheet--instant', 'Saved the moment you share: a small card says so; a note and a folder if you want; Done'],
  ['open-share-sheet--note-first', 'Note first, the iPhone’s own pattern: Cancel and Save on top, a small preview, the note, the folder'],
];
const KINDS = [['reel', 'A reel (Instagram)'], ['youtube', 'A YouTube video'], ['post', 'A post on X'], ['page', 'A page from Safari'], ['photos', 'Three photos'], ['text', 'Highlighted words']];
const STATES = [['ready', 'Ready'], ['saving', 'Saving'], ['saved', 'Saved'], ['offline', 'Offline'], ['connect', 'Not signed in']];

function fourSheets() {
  const el = document.createElement('div');
  el.className = 'bt';
  const src = (id, theme, kind, state) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}&args=${encodeURIComponent(`kind:${kind};state:${state}`)}`;
  const phones = list => `<div class="bt-phones bt-phones-four">${list.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light', 'reel', 'ready')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  const group = (name, key, list, on) => `<div class="bt-states" role="group" aria-label="${name}">${list.map(([value, words]) => `<button type="button" data-${key}="${value}" aria-pressed="${value === on}">${words}</button>`).join('')}</div>`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Sharing into FoundKeep</h1><p>What you see when you share something into FoundKeep from another app — Instagram, YouTube, X, Safari, Photos. One card, one button is the direction: what you’re saving as it will look (its picture and title, read from the link as the iPhone does in Messages), your note — no icon — and Save. Three more like it, and each while you type a note: the keyboard up, the card folded to a row, Save in plain view on the keyboard. No tags anywhere. Tap Save to see it save; tap Folder for the folders.</p></div></header>
    ${group('Kind of share', 'kind', KINDS, 'reel')}
    ${group('State', 'state', STATES, 'ready')}
    <div class="bt-states" role="group" aria-label="Appearance"><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button></div>
    <h2 class="bt-part">One card, one button — and three more like it</h2>${phones(PICKED)}
    <h2 class="bt-part">While you type a note</h2>${phones(TYPING)}
    <h2 class="bt-part">Set aside</h2>${phones(ASIDE)}`;
  let theme = 'light', kind = 'reel', state = 'ready';
  el.querySelectorAll('.bt-states').forEach(row => row.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const key = button.dataset.kind ? 'kind' : button.dataset.state ? 'state' : 'theme';
    el.querySelectorAll(`.bt-states button[data-${key}]`).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    if (key === 'theme') { theme = button.dataset.theme; el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, theme, kind, state); }); return; }
    if (key === 'kind') kind = button.dataset.kind; else state = button.dataset.state;
    el.querySelectorAll('iframe[data-story]').forEach(frame => frame.contentWindow?.__STORYBOOK_ADDONS_CHANNEL__?.emit('updateStoryArgs', { storyId: frame.dataset.story, updatedArgs: { kind, state } }));
  }));
  return el;
}

export default { title: 'Open/Share sheet', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const FourSheets = { name: 'One card, one button — variants, and while typing', render: fourSheets };
