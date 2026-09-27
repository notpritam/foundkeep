// Standalone import page — extracted from library.html/library.js's
// #importDialog (same element ids, no dialog chrome to close). library.js is
// deleted in Task 7; this binder is a deliberate copy rather than a shared
// module, since library.js's own copy is tangled with the rest of the sidebar
// (accountId is driven by its full refresh(), which also loads the
// collection, folders, etc.). Only the import-only slice is kept here.
import { $, hydrateIcons } from './ui.js';
import { parseBookmarkHtml, flattenBookmarkTree, IMPORT_MAX_BYTES } from './bookmark-import.js';

hydrateIcons();
let accountId = null, preview = null;

async function message(kind, args = {}) {
  const result = await chrome.runtime.sendMessage({ kind, accountId, ...args });
  if (!result?.ok) throw new Error(result?.error || 'FoundKeep could not respond. Try again.');
  return result.data;
}
const api = (operation, args = {}) => message('library-request', { operation, args });

async function refresh() {
  try {
    const state = await chrome.runtime.sendMessage({ kind: 'cloud-status' });
    if (!state?.ok) throw new Error(state?.error || 'Could not load the connection.');
    accountId = state.account?.id && state.status !== 'reconnect' ? state.account.id : null;
    $('connect').hidden = !!accountId;
  } catch (error) { $('importError').textContent = error.message; }
  setSignedIn(!!accountId);
  await updateImportProgress();
}
// M6: previewing checks bookmarks against the account's library
// (import-preview needs a connected account), so nothing can be chosen or
// previewed until the browser is signed in.
function setSignedIn(signedIn) {
  for (const id of ['readBrowser', 'importFile', 'importSource']) $(id).disabled = !signedIn;
}

async function previewImport(parsed) {
  preview = null; $('confirmImport').disabled = true; $('importError').textContent = '';
  if (!accountId) { $('importPreview').hidden = true; $('importError').textContent = 'Sign in to FoundKeep to preview and import your bookmarks.'; return; }
  $('importPreview').hidden = false; $('importPreview').textContent = 'Checking your bookmarks…';
  const owner = accountId, source = $('importSource').value;
  try {
    const result = await api('import-preview', { source, entries: parsed.entries });
    if (owner !== accountId) return;
    preview = { accountId: owner, source, entries: parsed.entries };
    $('importPreview').textContent = `${result.newBookmarks.toLocaleString()} new bookmarks · ${result.duplicates.toLocaleString()} already saved · ${result.folders.toLocaleString()} folders. ${parsed.skipped + result.skipped} unsupported entries skipped.${!result.fitsCaptureLimit ? ' This exceeds your remaining library allowance. Import a smaller export.' : ''}`;
    $('confirmImport').disabled = !result.fitsCaptureLimit || !parsed.entries.length;
  } catch (error) { $('importPreview').hidden = true; $('importError').textContent = error.message; }
}
$('readBrowser').onclick = async () => {
  // Permission request is the first call from this direct user gesture.
  const permission = chrome.permissions.request({ permissions: ['bookmarks'] });
  $('readBrowser').disabled = true; $('importError').textContent = '';
  try {
    if (!await permission) throw new Error('Bookmark access was not granted. You can import an HTML export instead.');
    const tree = await chrome.bookmarks.getTree();
    await previewImport(flattenBookmarkTree(tree));
  } catch (error) { $('importError').textContent = error.message; }
  finally { $('readBrowser').disabled = !accountId; }
};
$('importFile').onchange = async () => {
  const file = $('importFile').files[0]; if (!file) return;
  try {
    if (file.size > IMPORT_MAX_BYTES) throw new Error('Choose a bookmark export smaller than 8 MB.');
    await previewImport(parseBookmarkHtml(await file.text()));
  } catch (error) { preview = null; $('confirmImport').disabled = true; $('importError').textContent = error.message; }
};
$('importSource').onchange = () => { preview = null; $('confirmImport').disabled = true; $('importPreview').hidden = true; $('importFile').value = ''; };
$('confirmImport').onclick = async () => {
  if (!preview || preview.accountId !== accountId) return;
  $('confirmImport').disabled = true;
  try { await message('bookmark-import-start', preview); preview = null; await updateImportProgress(); }
  catch (error) { $('importError').textContent = error.message; $('confirmImport').disabled = !preview; }
};
async function updateImportProgress() {
  if (!accountId) { $('importProgress').hidden = true; return; }
  try {
    const progress = await message('bookmark-import-status');
    const el = $('importProgress'); el.hidden = !progress; if (!progress) return;
    el.replaceChildren(); const text = document.createElement('p');
    text.textContent = progress.otherAccount ? 'An unfinished import belongs to another connected account. Reconnect that account to resume it.' : progress.status === 'complete' ? `Done. ${progress.imported} bookmarks imported; ${progress.duplicates} existing saves kept.` : `${progress.offset} of ${progress.total} bookmarks checked${progress.status === 'paused' ? ' · Paused' : ''}`;
    el.append(text);
    if (!progress.otherAccount) { const bar = document.createElement('progress'); bar.max = progress.total || 1; bar.value = progress.offset; bar.setAttribute('aria-label', 'Bookmark import progress'); el.append(bar); }
    $('retryImport').hidden = progress.status !== 'paused' || !!progress.otherAccount;
    $('cancelImport').hidden = progress.status === 'complete';
    if (progress.error) $('importError').textContent = progress.error;
  } catch (error) { $('importError').textContent = error.message; }
}
$('retryImport').onclick = () => void message('bookmark-import-retry').then(updateImportProgress).catch(error => { $('importError').textContent = error.message; });
$('cancelImport').onclick = () => void message('bookmark-import-cancel').then(() => { preview = null; $('confirmImport').disabled = true; return updateImportProgress(); });
chrome.runtime.onMessage.addListener(event => {
  if (event.kind === 'atlas-import-changed') void updateImportProgress();
  if (event.kind === 'atlas-changed') void refresh();
});
window.addEventListener('focus', () => void refresh());
void refresh();
