// The details card ("Add details"): review.html in edit mode. The dock frames
// it after a save; it reads and edits exactly the save the background granted
// it for this tab (capture-details.js) and never anything else.
import { $, message } from './ui.js';
import { bindSaveTags } from './save-details.js';

const tabId = Number(new URLSearchParams(location.search).get('tab'));
let details = null, collections = [], folders = [], busy = false, creating = false, finished = false, epoch = 0, sharedTouched = false;

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
const tags = bindSaveTags($('detailsTags'), () => {});
const sharedTags = bindSaveTags($('sharedTags'), () => {}, { maxTags: 10 });

const chosenCollection = () => collections.find(item => item.id === $('detailsCollection').value) || null;
function update() {
  const collection = chosenCollection();
  $('detailsFields').disabled = busy || creating || !details;
  $('detailsSave').disabled = busy || creating || !details;
  $('detailsCancel').disabled = busy;
  $('detailsShare').hidden = !collection;
  $('sharedTitle').required = !!collection;
  $('shareImageLabel').hidden = !collection || !details?.canShareImage;
  const approval = collection?.requireApproval && !collection?.canModerate;
  $('detailsRules').textContent = collection
    ? `${collection.visibility === 'public' ? 'Public collection: anyone can read approved entries.' : 'Private collection: accepted members can read.'} ${approval ? 'Your submission needs approval.' : 'Your entry appears immediately.'}${collection.rules ? ' Rules: ' + collection.rules : ''}`
    : '';
  $('detailsSave').textContent = creating ? 'Creating folder…' : busy ? 'Saving…' : collection ? (approval ? 'Save and submit for approval' : 'Save and share') : 'Save details';
}
function renderFolders(selected = $('detailsFolder').value) {
  $('detailsFolder').replaceChildren(new Option('No folder', ''));
  for (const folder of folders) $('detailsFolder').add(new Option(folder.displayName || folder.name, folder.id));
  if (selected && !folders.some(folder => folder.id === selected)) $('detailsFolder').add(new Option('Unavailable folder — choose another', selected));
  $('detailsFolder').value = selected;
}
function renderCollections() {
  const selected = $('detailsCollection').value;
  $('detailsCollection').replaceChildren(new Option('Don’t share', ''));
  for (const collection of collections) $('detailsCollection').add(new Option(`${collection.title} · ${collection.visibility === 'public' ? 'Public' : 'Private'}`, collection.id));
  $('detailsCollection').value = collections.some(item => item.id === selected) ? selected : '';
}
async function loadOptions() {
  const revision = ++epoch;
  $('detailsReload').hidden = true;
  message($('detailsFeedback'), 'Loading folders and collections…');
  const results = await Promise.allSettled([api('organization'), details.shared ? Promise.resolve({ collections: [] }) : api('collections')]);
  if (revision !== epoch) return;
  if (results[0].status === 'fulfilled') {
    folders = results[0].value.folders || []; renderFolders();
    const names = [...(results[0].value.tags || []).map(tag => tag.name), ...(results[0].value.suggestedTags || [])];
    tags.suggest(names); sharedTags.suggest(names);
  }
  if (results[1].status === 'fulfilled') { collections = (results[1].value.collections || []).filter(item => item.canSubmit); renderCollections(); }
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
  } catch (error) { message($('detailsFeedback'), error.message, 'error'); return; }
  const note = details.type === 'note';
  $('detailsHeading').textContent = details.title || (note ? 'Your note' : 'Your save');
  $('detailsTitle').value = details.title;
  $('detailsNote').value = details.note;
  $('detailsNote').required = note;
  $('detailsNoteLabel').textContent = note ? 'Note' : 'Personal note';
  $('detailsOriginal').hidden = !details.excerpt;
  $('detailsExcerpt').textContent = details.excerpt;
  tags.set(details.tags);
  renderFolders(details.folderId);
  $('detailsCollectionLabel').hidden = !!details.shared;
  $('detailsShared').hidden = !details.shared;
  if (details.shared) $('detailsShared').textContent = `Shared with ${details.shared.title}${details.shared.status === 'pending' ? ' (waiting to sync or for approval)' : ''}.`;
  $('sharedUrl').value = details.sourceUrl;
  $('sharedBody').value = details.excerpt.slice(0, 5000);
  $('detailsForm').dataset.ready = 'true';
  update(); focusFirstField(); post({ type: 'ready' });
  void loadOptions();
}

$('detailsCollection').onchange = () => {
  if (chosenCollection() && !sharedTouched) $('sharedTitle').value = ($('detailsTitle').value || details?.title || '').slice(0, 200);
  update();
};
$('sharedTitle').addEventListener('input', () => { sharedTouched = true; });
$('detailsReload').onclick = () => void loadOptions();
$('detailsNewFolderToggle').onclick = () => {
  const open = $('detailsNewFolder').hidden; $('detailsNewFolder').hidden = !open;
  $('detailsNewFolderToggle').setAttribute('aria-expanded', String(open)); if (open) $('detailsFolderName').focus();
};
$('detailsFolderName').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); $('detailsCreateFolder').click(); } };
$('detailsCreateFolder').onclick = async () => {
  const name = $('detailsFolderName').value.trim();
  if (!name || !details || busy || creating) return;
  creating = true; update(); message($('detailsFolderFeedback'), 'Creating folder…');
  try {
    const { folder } = await api('create-folder', { name });
    folders = [...folders.filter(item => item.id !== folder.id), folder]; renderFolders(folder.id);
    $('detailsFolderName').value = ''; $('detailsNewFolder').hidden = true; $('detailsNewFolderToggle').setAttribute('aria-expanded', 'false');
    message($('detailsFolderFeedback'), '');
  } catch (error) { message($('detailsFolderFeedback'), error.message, 'error'); }
  finally { creating = false; update(); }
};
$('detailsCancel').onclick = () => { if (!busy) finish(false); };
$('detailsForm').onsubmit = async event => {
  event.preventDefault();
  if (busy || creating || !details) return;
  const collection = chosenCollection();
  if (!tags.flush() || (collection && !sharedTags.flush())) return;
  if (details.type === 'note' && !$('detailsNote').value.trim()) { message($('detailsFeedback'), 'A note needs some text.', 'error'); $('detailsNote').focus(); return; }
  if (collection && !$('sharedTitle').value.trim()) { message($('detailsFeedback'), 'Add a title for the collection.', 'error'); $('sharedTitle').focus(); return; }
  const form = {
    title: $('detailsTitle').value, note: $('detailsNote').value, folderId: $('detailsFolder').value || null, tags: tags.get(),
    share: collection ? { collectionId: collection.id, title: $('sharedTitle').value, url: $('sharedUrl').value, body: $('sharedBody').value,
      tags: sharedTags.get(), shareImage: !$('shareImageLabel').hidden && $('shareImage').checked } : null,
  };
  busy = true; update(); message($('detailsFeedback'), 'Saving…');
  try {
    await request('details-save', { form });
    message($('detailsFeedback'), '');
    finish(true);
  } catch (error) { message($('detailsFeedback'), error.message, 'error'); }
  finally { busy = false; update(); }
};
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); if (!busy) finish(false); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...$('detailsForm').querySelectorAll('button, input, textarea, select, a[href], summary')].filter(el => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
// Report the card's natural height (header + all fields + footer), not the
// frame-constrained body height, so the dock can grow the frame to fit.
const reportSize = () => {
  const body = $('detailsFields'), padding = parseFloat(getComputedStyle(body).paddingTop) + parseFloat(getComputedStyle(body).paddingBottom);
  post({ type: 'resize', height: Math.ceil(document.querySelector('.review-head').offsetHeight + $('detailsContent').offsetHeight + padding + document.querySelector('.review-foot').offsetHeight + 2) });
};
const sizes = new ResizeObserver(reportSize);
for (const el of [document.body, $('detailsContent'), document.querySelector('.review-foot')]) sizes.observe(el);
window.addEventListener('focus', focusFirstField);
void load();
