// The extension's "Add details" card, built from its own source: the markup
// is cloned from review.html, the styles are theme.css + components.css +
// review.css, the icons come from card-icons.js and every list is the real
// Listbox (listbox.js). The
// card's behaviour (loading, saving, sharing rules) lives in review.js, which
// needs the extension's runtime; this mirrors only what it renders, so the
// stories stay live — pick a folder, add and remove tags, share — without it.
import reviewHtml from '../../apps/extension/src/review.html?raw';
import { icon } from '../../apps/extension/src/card-icons.js';
import { openListbox, closeListbox } from '../../apps/extension/src/listbox.js';
import { normalizeSaveTags, STARTER_TAGS } from '../../apps/extension/src/save-details.js';

const template = new DOMParser().parseFromString(reviewHtml, 'text/html').querySelector('#detailsForm');

export const TITLE = 'The half-life of a good idea';
export const NOTE = 'Worth rereading before the Q4 planning doc: the part about spacing reviews.';
export const FOLDERS = [{ id: 'f-reading', name: 'Reading list' }, { id: 'f-research', name: 'Research' }, { id: 'f-essays', name: 'Essays' }];
export const COLLECTIONS = [
  { id: 'col-design', title: 'Design that works', visibility: 'public', requireApproval: true, canModerate: false },
  { id: 'col-team', title: 'Team research', visibility: 'private', requireApproval: false },
];
const LIBRARY_TAGS = ['Memory', 'Reading', 'Learning'];
const esc = value => { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; };
const visibilityIcon = c => c?.visibility === 'public' ? 'globe' : 'lock';

/**
 * state: 'ready' | 'loading' | 'error' | 'saving' | 'unavailable' (details could not load)
 * type: 'save' | 'note'; shared: an existing share ({ title, status }) or null
 * open: 'folder' | 'tags' | 'collection' — a list open on first render
 */
export function card({ state = 'ready', type = 'save', title = TITLE, note = NOTE, folderId = 'f-reading', tags = ['Memory'], collectionId = '', caption = '', shared = null, open = null } = {}) {
  const form = template.cloneNode(true);
  const $ = id => form.querySelector('#' + id);
  const s = { folderId, tags: [...tags], collectionId };
  const loaded = state !== 'loading' && state !== 'unavailable';
  const folders = loaded ? FOLDERS : [];
  const collections = loaded && !shared ? COLLECTIONS : [];

  $('detailsTitle').value = title;
  $('detailsNote').value = note;
  $('detailsNote').placeholder = type === 'note' ? 'Write your note' : 'Add a note';
  $('sharedBody').value = caption;
  $('detailsCancel').innerHTML = icon('close', 16);
  $('detailsAddTag').innerHTML = `${icon('plus', 14)}<span>Tag</span>`;
  $('detailsLibrary').innerHTML = `${icon('library', 15)}<span>My library</span>`;
  form.dataset.ready = String(state !== 'loading');

  const chosen = () => collections.find(c => c.id === s.collectionId) || null;
  const render = () => {
    const folder = folders.find(f => f.id === s.folderId);
    const folderLabel = !s.folderId ? 'No folder' : folder ? folder.name : 'Unavailable folder';
    $('detailsFolder').innerHTML = `${icon('folder', 15)}<span class="fk-select__value">${esc(folderLabel)}</span>${icon('chevron', 14, 'fk-select__chevron')}`;
    $('detailsFolder').setAttribute('aria-invalid', String(!!s.folderId && !folder && folders.length > 0));
    $('detailsTags').innerHTML = s.tags.map(t => `<button type="button" class="fk-tag" data-tag="${esc(t)}" aria-label="Remove tag ${esc(t)}"><span>${esc(t)}</span>${icon('close', 12, 'fk-tag__remove')}</button>`).join('');
    const c = chosen();
    if (shared) {
      $('detailsCollection').innerHTML = `${icon('collection', 15)}<span class="fk-select__value">${esc(shared.title)}</span>`;
      $('detailsCollection').removeAttribute('data-empty');
      $('detailsCollection').dataset.tooltip = shared.status === 'pending' ? 'Waiting to sync or for approval' : 'Shared';
    } else {
      $('detailsCollection').innerHTML = `${icon(c ? visibilityIcon(c) : 'collection', 15)}<span class="fk-select__value">${esc(c ? c.title : 'Share')}</span>`;
      $('detailsCollection').toggleAttribute('data-empty', !c);
    }
    $('detailsShare').hidden = !c;
    if (c) $('detailsShareIcon').innerHTML = icon(visibilityIcon(c), 15);
    const locked = state === 'loading' || state === 'saving';
    for (const id of ['detailsTitle', 'detailsNote', 'detailsFolder', 'detailsAddTag', 'sharedBody', 'detailsSave']) $(id).disabled = locked;
    $('detailsCollection').disabled = locked || !!shared;
    $('detailsSave').textContent = state === 'saving' ? 'Saving…' : c ? 'Save' : 'Save details';
  };

  const feedback = { loading: ['Loading folders and collections…', ''], error: ['Some folders or collections could not load. Retry, or save without them.', 'error'], saving: ['Saving…', ''], unavailable: ['This save is no longer available.', 'error'] }[state];
  if (feedback) { $('detailsFeedback').textContent = feedback[0]; $('detailsFeedback').dataset.tone = feedback[1]; }
  $('detailsReload').hidden = state !== 'error';
  if (state === 'unavailable') for (const el of form.querySelectorAll('.details__row, .details__foot > :not(#detailsReload), #detailsNote')) el.hidden = true;

  const lists = {
    folder: () => openListbox({
      trigger: $('detailsFolder'), host: form, label: 'Folder', placeholder: 'Find a folder',
      options: () => [{ value: '', label: 'No folder', selected: !s.folderId }, ...folders.map(f => ({ value: f.id, label: f.name, selected: f.id === s.folderId }))],
      onPick: o => { s.folderId = o.value; render(); },
      create: { label: (q, exact) => q ? (exact ? '' : `New folder “${q}”`) : 'New folder', run: (q, input) => { if (!q) { input.placeholder = 'Name the new folder'; return; } const id = `f-${Date.now()}`; folders.push({ id, name: q }); s.folderId = id; closeListbox({ focusTrigger: true }); render(); } },
    }),
    tags: () => openListbox({
      trigger: $('detailsAddTag'), host: form, label: 'Personal tags', placeholder: 'Find or create a tag',
      options: () => [...new Set([...s.tags, ...LIBRARY_TAGS, ...STARTER_TAGS])].map(t => ({ value: t, label: t, selected: s.tags.includes(t) })),
      onPick: o => { s.tags = normalizeSaveTags(s.tags.includes(o.value) ? s.tags.filter(t => t !== o.value) : [...s.tags, o.value]); render(); return true; },
      create: { label: (q, exact) => q && !exact ? `Create “${q.replace(/^#/, '')}”` : '', run: q => { s.tags = normalizeSaveTags([...s.tags, q]); render(); } },
    }),
    collection: () => openListbox({
      trigger: $('detailsCollection'), host: form, label: 'Share to a collection', placeholder: 'Find a collection',
      options: () => [{ value: '', label: 'Don’t share', selected: !s.collectionId }, ...collections.map(c => ({ value: c.id, label: c.title, icon: visibilityIcon(c), selected: c.id === s.collectionId, meta: `${c.visibility === 'public' ? 'Public' : 'Private'}${c.requireApproval && !c.canModerate ? ', needs approval' : ''}` }))],
      onPick: o => { s.collectionId = o.value; render(); },
    }),
  };
  $('detailsFolder').onclick = () => $('detailsFolder').getAttribute('aria-expanded') === 'true' ? closeListbox() : lists.folder();
  $('detailsAddTag').onclick = () => $('detailsAddTag').getAttribute('aria-expanded') === 'true' ? closeListbox() : lists.tags();
  $('detailsCollection').onclick = () => $('detailsCollection').getAttribute('aria-expanded') === 'true' ? closeListbox() : lists.collection();
  $('detailsTags').onclick = event => { const chip = event.target.closest('.fk-tag'); if (chip) { s.tags = s.tags.filter(t => t !== chip.dataset.tag); render(); } };
  form.onsubmit = event => event.preventDefault();
  render();

  // The extension frames the card 380px wide.
  const frame = document.createElement('div');
  frame.style.cssText = 'width:380px;max-width:100%';
  frame.append(form);
  if (open) { const go = () => form.isConnected ? lists[open]() : requestAnimationFrame(go); requestAnimationFrame(go); }
  return frame;
}
