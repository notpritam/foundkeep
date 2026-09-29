// The details card ("Add details"): review.html in edit mode. The dock frames
// it after a save; it reads and edits exactly the save the background granted
// it for this tab (capture-details.js) and never anything else.
import { $, message } from './ui.js';
import { normalizeSaveTags, STARTER_TAGS } from './save-details.js';
import { icon } from './card-icons.js';
import { openListbox, closeListbox, listboxOpen } from './listbox.js';

const tabId = Number(new URLSearchParams(location.search).get('tab'));
let details = null, initial = null, collections = [], folders = [], busy = false, creating = false, finished = false, epoch = 0;
// What the pills show; the form sends only what differs from `initial`.
let folderId = '', tags = [], collectionId = '', tagNames = [];

// C1 / R16: never window.parent.postMessage — the parent is the web page, and
// its own script would receive every message with event.source set to this
// card. Messages for the dock go through the extension instead: the
// background relays them only after checking this card's grant for `tabId`,
// and delivers them to that tab's top-frame content script (the dock) alone.
function post(data) { void chrome.runtime.sendMessage({ kind: 'details-frame', tabId, ...data }).catch(() => {}); }
// Cancel, Esc and a successful save can race; the dock sees one done.
function finish(saved) {
  if (finished) return;
  finished = true;
  post({ type: 'done', saved });
}
const request = async (kind, values = {}) => {
  const result = await chrome.runtime.sendMessage({ kind, tabId, ...values });
  if (!result?.ok) throw new Error(result?.error || 'FoundKeep could not load these details. Try again.');
  return result;
};
const api = async (operation, args = {}) => (await request('library-request', { operation, args, accountId: details?.accountId })).data;

// --- Rendering ------------------------------------------------------------------
const chosenCollection = () => collections.find(item => item.id === collectionId) || null;
const needsApproval = collection => !!collection?.requireApproval && !collection?.canModerate;
const visibilityIcon = collection => collection?.visibility === 'public' ? 'globe' : 'lock';
const html = (el, markup) => { el.innerHTML = markup; };
const esc = value => { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; };

function renderFolder() {
  const folder = folders.find(item => item.id === folderId);
  const label = !folderId ? 'No folder' : folder ? (folder.displayName || folder.name) : 'Unavailable folder';
  html($('detailsFolder'), `${icon('folder', 15)}<span class="fk-select__value">${esc(label)}</span>${icon('chevron', 14, 'fk-select__chevron')}`);
  $('detailsFolder').setAttribute('aria-invalid', String(!!folderId && !folder && folders.length > 0));
}
function renderTags() {
  $('detailsTags').replaceChildren(...tags.map(name => {
    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'fk-tag'; chip.dataset.tag = name;
    chip.setAttribute('aria-label', `Remove tag ${name}`);
    chip.innerHTML = `<span>${esc(name)}</span>${icon('close', 12, 'fk-tag__remove')}`;
    chip.disabled = $('detailsAddTag').disabled;
    return chip;
  }));
}
function renderShare() {
  const collection = chosenCollection();
  if (details?.shared) {
    // Already shared: the pill says where, and cannot be changed here.
    html($('detailsCollection'), `${icon('collection', 15)}<span class="fk-select__value">${esc(details.shared.title)}</span>`);
    $('detailsCollection').removeAttribute('data-empty');
    $('detailsCollection').dataset.tooltip = details.shared.status === 'pending' ? 'Waiting to sync or for approval' : 'Shared';
  } else {
    html($('detailsCollection'), `${icon(collection ? visibilityIcon(collection) : 'collection', 15)}<span class="fk-select__value">${esc(collection ? collection.title : 'Share')}</span>`);
    $('detailsCollection').toggleAttribute('data-empty', !collection);
    delete $('detailsCollection').dataset.tooltip;
  }
  $('detailsShare').hidden = !collection;
  if (collection) html($('detailsShareIcon'), icon(visibilityIcon(collection), 15));
}
function update() {
  const locked = busy || creating || !details;
  for (const id of ['detailsTitle', 'detailsNote', 'detailsFolder', 'detailsAddTag', 'sharedBody', 'detailsSave']) $(id).disabled = locked;
  $('detailsCollection').disabled = locked || !!details?.shared;
  for (const tag of $('detailsTags').children) tag.disabled = locked;
  $('detailsCancel').disabled = busy;
  $('detailsSave').textContent = creating ? 'Creating folder…' : busy ? 'Saving…' : chosenCollection() ? 'Save' : 'Save details';
  renderFolder(); renderShare();
}

// --- Loading ----------------------------------------------------------------------
async function loadOptions() {
  const revision = ++epoch;
  $('detailsReload').hidden = true;
  message($('detailsFeedback'), 'Loading folders and collections…');
  const results = await Promise.allSettled([api('organization'), details.shared ? Promise.resolve({ collections: [] }) : api('collections')]);
  if (revision !== epoch) return;
  if (results[0].status === 'fulfilled') {
    folders = results[0].value.folders || [];
    tagNames = [...(results[0].value.tags || []).map(tag => tag.name), ...(results[0].value.suggestedTags || [])];
  }
  if (results[1].status === 'fulfilled') {
    collections = (results[1].value.collections || []).filter(item => item.canSubmit);
    if (!chosenCollection()) collectionId = '';
  }
  update();
  const failed = results.some(result => result.status === 'rejected');
  message($('detailsFeedback'), failed ? 'Some folders or collections could not load. Retry, or save without them.' : '', failed ? 'error' : '');
  $('detailsReload').hidden = !failed;
}
// M4: keyboard users start on the first field — the note itself for a note.
function focusFirstField() {
  if (!details || (document.activeElement && document.activeElement !== document.body)) return;
  (details.type === 'note' ? $('detailsNote') : $('detailsTitle')).focus({ preventScroll: true });
}
async function load() {
  try {
    details = (await request('details-get')).details;
  } catch (error) {
    // Keep the card open with the real reason (the dock would otherwise
    // replace it with a generic "could not open" after 3 s). Only a card
    // that belongs to this tab can reach the dock at all.
    message($('detailsFeedback'), error.message, 'error');
    for (const el of document.querySelectorAll('.details__row, .details__foot > :not(#detailsReload), #detailsNote')) el.hidden = true;
    $('detailsTitle').placeholder = 'Details unavailable';
    post({ type: 'ready' });
    return;
  }
  const note = details.type === 'note';
  $('detailsTitle').value = details.title;
  $('detailsNote').value = details.note;
  $('detailsNote').placeholder = note ? 'Write your note' : 'Add a note';
  $('detailsNote').setAttribute('aria-label', note ? 'Note' : 'Personal note');
  folderId = details.folderId || '';
  tags = [...details.tags];
  // What the card showed; only fields that differ from it are sent, so an
  // untouched field never overwrites the server's copy.
  initial = { title: details.title, note: details.note, folderId, tags: [...details.tags] };
  $('detailsForm').dataset.ready = 'true';
  update(); renderTags(); focusFirstField(); post({ type: 'ready' });
  void loadOptions();
}

// --- Pickers ------------------------------------------------------------------------
const card = $('detailsForm');
$('detailsFolder').onclick = () => {
  if ($('detailsFolder').getAttribute('aria-expanded') === 'true') return closeListbox();
  openListbox({
    trigger: $('detailsFolder'), host: card, label: 'Folder', placeholder: 'Find a folder',
    options: () => [{ value: '', label: 'No folder', selected: !folderId }, ...folders.map(f => ({ value: f.id, label: f.displayName || f.name, selected: f.id === folderId }))],
    onPick: option => { folderId = option.value; update(); },
    create: {
      label: (query, exact) => query ? (exact ? '' : `New folder “${query}”`) : 'New folder',
      run: async (query, input) => {
        if (!query) { input.placeholder = 'Name the new folder'; input.focus(); return; }
        if (creating || !details) return;
        creating = true; update(); message($('detailsFeedback'), 'Creating folder…');
        try {
          const { folder } = await api('create-folder', { name: query });
          folders = [...folders.filter(item => item.id !== folder.id), folder]; folderId = folder.id;
          message($('detailsFeedback'), '');
          closeListbox({ focusTrigger: true });
        } catch (error) { message($('detailsFeedback'), error.message, 'error'); }
        finally { creating = false; update(); }
      },
    },
  });
};
function setTags(next) {
  try { tags = normalizeSaveTags(next); message($('detailsFeedback'), ''); renderTags(); return true; }
  catch (error) { message($('detailsFeedback'), error.message, 'error'); return false; }
}
$('detailsAddTag').onclick = () => {
  if ($('detailsAddTag').getAttribute('aria-expanded') === 'true') return closeListbox();
  openListbox({
    trigger: $('detailsAddTag'), host: card, label: 'Personal tags', placeholder: 'Find or create a tag',
    options: () => [...new Set([...tags, ...tagNames, ...STARTER_TAGS])].map(name => ({ value: name, label: name, selected: tags.includes(name) })),
    onPick: option => { setTags(tags.includes(option.value) ? tags.filter(t => t !== option.value) : [...tags, option.value]); return true; },
    create: { label: (query, exact) => query && !exact ? `Create “${query.replace(/^#/, '')}”` : '', run: query => { setTags([...tags, query]); } },
  });
};
$('detailsTags').onclick = event => {
  const chip = event.target.closest('.fk-tag');
  if (chip && !chip.disabled) setTags(tags.filter(t => t !== chip.dataset.tag));
};
$('detailsCollection').onclick = () => {
  if ($('detailsCollection').getAttribute('aria-expanded') === 'true') return closeListbox();
  openListbox({
    trigger: $('detailsCollection'), host: card, label: 'Share to a collection', placeholder: 'Find a collection',
    options: () => [{ value: '', label: 'Don’t share', selected: !collectionId },
      ...collections.map(c => ({ value: c.id, label: c.title, icon: visibilityIcon(c), selected: c.id === collectionId,
        meta: `${c.visibility === 'public' ? 'Public' : 'Private'}${needsApproval(c) ? ', needs approval' : ''}` }))],
    onPick: option => { collectionId = option.value; update(); if (collectionId) queueMicrotask(() => $('sharedBody').focus()); },
  });
};

// --- Actions --------------------------------------------------------------------------
html($('detailsCancel'), icon('close', 16));
html($('detailsAddTag'), `${icon('plus', 14)}<span>Tag</span>`);
html($('detailsLibrary'), `${icon('library', 15)}<span>My library</span>`);
$('detailsReload').onclick = () => void loadOptions();
$('detailsCancel').onclick = () => { if (!busy) finish(false); };
$('detailsForm').onsubmit = async event => {
  event.preventDefault();
  if (busy || creating || !details) return;
  closeListbox();
  const collection = chosenCollection();
  if (details.type === 'note' && !$('detailsNote').value.trim()) { message($('detailsFeedback'), 'A note needs some text.', 'error'); $('detailsNote').focus(); return; }
  const title = $('detailsTitle').value.trim() || details.title || '';
  if (collection && !title) { message($('detailsFeedback'), 'Add a title before sharing.', 'error'); $('detailsTitle').focus(); return; }
  const form = {};
  if ($('detailsTitle').value !== initial.title) form.title = $('detailsTitle').value;
  if ($('detailsNote').value !== initial.note) form.note = $('detailsNote').value;
  if (folderId !== initial.folderId) form.folderId = folderId || null;
  if (JSON.stringify(tags) !== JSON.stringify(initial.tags)) form.tags = tags;
  // The collection shows the save's title and link, and the caption — or,
  // with no caption, the saved excerpt (what the card used to pre-fill).
  if (collection) form.share = { collectionId: collection.id, title: title.slice(0, 200), url: details.sourceUrl,
    body: ($('sharedBody').value.trim() || details.excerpt || '').slice(0, 5000), tags: [], shareImage: false };
  if (!Object.keys(form).length) { finish(false); return; }
  busy = true; update(); message($('detailsFeedback'), 'Saving…');
  try {
    await request('details-save', { form });
    message($('detailsFeedback'), '');
    finish(true);
  } catch (error) { message($('detailsFeedback'), error.message, 'error'); }
  finally { busy = false; update(); }
};
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); if (listboxOpen()) closeListbox({ focusTrigger: true }); else if (!busy) finish(false); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...card.querySelectorAll('button, input, textarea, a[href]')].filter(el => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
// Report the card's natural height so the dock sizes the frame to fit it.
const reportSize = () => post({ type: 'resize', height: Math.ceil(card.getBoundingClientRect().height) });
new ResizeObserver(reportSize).observe(card);
window.addEventListener('focus', focusFirstField);
update();
void load();
