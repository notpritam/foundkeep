import { $, api, textElement, setMessage, downloadBlob, recoveryDownload, safeSource, safeBlob, dateLabel, extensionMessage, customerConfig } from './customer.js?v=1.4.0';

const state = { account: null, connections: [], usage: null, captures: [], cursor: null, total: 0, type: '', query: '', listRequest: 0, controller: null, detailRequest: 0, detail: null, extension: null, extensionId: null, expired: false, noteClientId: null, recoveryCode: '', connecting: false };
const kinds = { screenshot: 'Screenshot', selection: 'Highlight', bookmark: 'Bookmark', image: 'Image', note: 'Note', tweet: 'Tweet' };
let toastTimer, searchTimer, listRetry = () => loadCaptures();

function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}
function openDialog(id) { if (!$(id).open) $(id).showModal(); }
function closeDialog(id) { $(id).close(); }
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(`#${button.dataset.close}`)));
function confirmAction(title, description, label = 'Continue') {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title; $('#confirm-description').textContent = description; $('#confirm-accept').textContent = label;
  dialog.returnValue = 'cancel'; openDialog('#confirm-dialog'); $('#confirm-cancel').focus();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
function expireSession() {
  if (state.expired) return;
  state.expired = true; state.controller?.abort(); state.listRequest++; state.detailRequest++;
  state.account = null; state.captures = []; state.detail = null; state.connections = [];
  $('#capture-grid').replaceChildren(); $('#detail-body').replaceChildren(textElement('h2', 'Log in to view this capture.'));
  $('#account-name').textContent = 'Your account'; $('#settings-email').textContent = ''; $('#device-list').replaceChildren();
  $('#note-text').value = ''; $('#password-form').reset(); $('#delete-account-form').reset();
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  $('#library-state').hidden = true; $('#onboarding').hidden = true; $('#new-note').disabled = true;
  openDialog('#session-dialog');
}
window.addEventListener('atlas-session-expired', expireSession);
$('#session-dialog').addEventListener('cancel', event => event.preventDefault());
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
function bytes(value) { return `${((value || 0) / 1048576).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`; }
function updateAccount() {
  const { account, usage, connections } = state;
  if (!account) return;
  $('#account-name').textContent = account.name || account.email;
  $('#account-avatar').textContent = (account.name || account.email).slice(0, 1).toUpperCase();
  $('#settings-email').textContent = account.email;
  if (usage) {
    $('#nav-count').textContent = usage.captures.toLocaleString();
    $('#usage-summary').textContent = `${usage.captures.toLocaleString()} captures · ${bytes(usage.bytes)}`;
    $('#settings-usage').textContent = `${usage.captures.toLocaleString()} of ${usage.maxCaptures.toLocaleString()} captures · ${bytes(usage.bytes)} of ${bytes(usage.maxBytes)}`;
    $('#library-description').textContent = usage.captures ? `${usage.captures.toLocaleString()} ${usage.captures === 1 ? 'good thing' : 'good things'} worth coming back to.` : 'A place for the things worth keeping.';
  }
  $('#device-list').replaceChildren();
  if (!connections.length) $('#device-list').append(textElement('li', 'No browsers connected yet.', 'muted device-empty'));
  for (const connection of connections) {
    const row = textElement('li');
    const info = textElement('div');
    info.append(textElement('strong', connection.name || 'Atlas browser'), textElement('span', `Connected ${dateLabel(connection.createdAt)} · ${connection.lastSeenAt ? `Last active ${dateLabel(connection.lastSeenAt, true)}` : 'Not used yet'}`));
    const button = textElement('button', 'Revoke', 'subtle-button danger-text'); button.type = 'button'; button.setAttribute('aria-label', `Revoke ${connection.name || 'Atlas browser'}`);
    button.addEventListener('click', async () => {
      if (!await confirmAction('Disconnect this browser?', `${connection.name || 'This browser'} will lose access to your cloud library. Its local captures remain on that device.`, 'Revoke access')) return;
      button.disabled = true;
      try {
        await api(`/connections/${encodeURIComponent(connection.id)}`, { method: 'DELETE' });
        await refreshAccount(); await detectExtension(); toast('Browser access revoked.');
      } catch (error) { if (!state.expired) setMessage($('#account-message'), error.message); }
      finally { button.disabled = false; }
    });
    row.append(info, button); $('#device-list').append(row);
  }
  updateOnboarding();
}
async function refreshAccount() {
  const result = await api('/me');
  if (state.expired) return;
  if (state.account && result.account.id !== state.account.id) {
    expireSession();
    $('#session-description').textContent = 'Your signed-in account changed in another tab. Log in again to open the correct library.';
    return;
  }
  state.account = result.account; state.connections = result.connections; state.usage = result.usage;
  updateAccount();
}
function updateOnboarding() {
  const connected = state.extension?.account?.id === state.account?.id;
  $('#install-marker').classList.toggle('step-done', !!state.extension);
  $('#connect-marker').classList.toggle('step-done', connected);
  $('#capture-marker').classList.toggle('step-done', !!state.usage?.captures);
  $('#connect-extension').textContent = connected ? 'Reconnect Atlas' : state.extension?.account ? 'Switch Atlas account' : 'Connect Atlas';
  if (state.usage?.captures) {
    $('#first-capture-title').textContent = 'Your collection has started';
    $('#first-capture-description').textContent = 'Keep saving from the extension. Your new captures sync here when you’re online.';
  } else {
    $('#first-capture-title').textContent = 'Save your first find';
    $('#first-capture-description').textContent = 'Open a page, click Atlas and save a screenshot, highlight or bookmark.';
  }
}
async function detectExtension() {
  const config = await customerConfig();
  if (config.storeUrl) {
    $('#install-extension').href = config.storeUrl; $('#install-extension').removeAttribute('download');
    $('#install-extension').target = '_blank'; $('#install-extension').rel = 'noopener noreferrer';
    $('#install-extension').textContent = 'Add to Chrome';
    $('#install-description').textContent = 'Add Atlas from the Chrome Web Store, then pin it in your extensions menu.';
  }
  const attempts = await Promise.allSettled(config.extensionIds.map(async id => ({ id, result: await extensionMessage({ kind: 'atlas-ping' }, id) })));
  const success = attempts.find(attempt => attempt.status === 'fulfilled');
  if (state.expired) return null;
  if (success) {
    state.extension = success.value.result; state.extensionId = success.value.id;
    const account = state.extension.account;
    $('#extension-status').textContent = account?.id === state.account?.id ? `Connected as ${account.email}. New captures sync to this library.` : account ? `This browser is connected to ${account.email}. Confirm before switching accounts.` : 'Atlas is installed. Connect it to start syncing new captures.';
    $('#extension-status').classList.toggle('connection-success', account?.id === state.account?.id);
  } else {
    state.extension = null; state.extensionId = null;
    $('#extension-status').textContent = 'Atlas isn’t detected. Install it in Chrome, then reload this page. If it’s already installed, reload it at chrome://extensions.';
    $('#extension-status').classList.remove('connection-success');
  }
  updateOnboarding(); return state.extension;
}
$('#connect-extension').addEventListener('click', async () => {
  if (state.connecting || state.expired) return;
  state.connecting = true; $('#connect-extension').disabled = true;
  try {
    const extension = await detectExtension();
    if (!extension) { $('#manual-install').open = true; throw new Error('Install or reload Atlas in Chrome first. Then reload this page and connect again.'); }
    if (extension.account && extension.account.id !== state.account.id) {
      const accepted = await confirmAction('Switch this browser’s account?', `Atlas is connected to ${extension.account.email}. New captures will sync to ${state.account.email} after switching. Captures waiting to upload for the previous account stay with that account.`, 'Switch account');
      if (!accepted) return;
    }
    $('#extension-status').textContent = 'Connecting your browser…';
    const pairing = await api('/pairing', { method: 'POST', body: {} });
    const result = await extensionMessage({ kind: 'atlas-connect', code: pairing.code }, state.extensionId);
    if (result.account?.id !== state.account.id) throw new Error('The extension connected to a different account. Reload this page and reconnect.');
    state.extension = { ...state.extension, account: result.account };
    await refreshAccount();
    $('#extension-status').textContent = `Connected as ${result.account.email}. Your next capture will sync here.`;
    $('#extension-status').classList.add('connection-success'); toast('Browser connected. Save your first find with Atlas.');
  } catch (error) {
    if (!state.expired) { $('#extension-status').textContent = error.message; $('#extension-status').classList.remove('connection-success'); }
  } finally { state.connecting = false; $('#connect-extension').disabled = false; updateOnboarding(); }
});
$('#copy-extensions').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('chrome://extensions'); $('#copy-result').textContent = 'Copied. Paste it into Chrome’s address bar.'; }
  catch { $('#copy-result').textContent = 'Copy chrome://extensions and paste it into Chrome’s address bar.'; }
});
$('#open-setup').addEventListener('click', () => { if (state.expired) return; $('#onboarding').hidden = false; $('#onboarding').scrollIntoView({ behavior: 'smooth', block: 'start' }); detectExtension(); });
$('#hide-setup').addEventListener('click', () => { $('#onboarding').hidden = true; $('#open-setup').focus(); });

function showLibraryState(title, description, { loading = false, retry, action, label } = {}) {
  const holder = $('#library-state'); holder.replaceChildren(); holder.hidden = false;
  if (loading) holder.append(textElement('span', '', 'loading-dot'));
  holder.append(textElement('h2', title), textElement('p', description));
  if (retry || action) {
    const button = textElement('button', label || 'Try again', 'button secondary'); button.type = 'button';
    button.addEventListener('click', retry || action); holder.append(button);
  }
}
function captureTitle(capture) {
  return capture.sourceTitle || (capture.noteText || capture.selectionText || '').slice(0, 120) || `Untitled ${kinds[capture.type]?.toLowerCase() || 'capture'}`;
}
function captureCard(capture) {
  const card = textElement('article', null, `capture-card capture-${Object.hasOwn(kinds, capture.type) ? capture.type : 'note'}`);
  const button = textElement('button', null, 'capture-open'); button.type = 'button';
  button.setAttribute('aria-label', `Open ${kinds[capture.type] || 'capture'}: ${captureTitle(capture)}`);
  const blob = safeBlob(capture.blobUrl, capture.id);
  if (blob) {
    const image = textElement('img'); image.src = blob; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => { image.replaceWith(textElement('div', 'Image preview unavailable. Open to retry.', 'image-unavailable')); }, { once: true });
    button.append(image);
  }
  const body = textElement('div', null, 'capture-card-body');
  const meta = textElement('div', null, 'capture-meta'); meta.append(textElement('span', kinds[capture.type] || 'Capture'), textElement('time', dateLabel(capture.capturedAt)));
  body.append(meta, textElement('h2', captureTitle(capture)));
  const excerpt = capture.selectionText || capture.noteText || capture.summary || capture.articleText;
  if (excerpt && excerpt !== captureTitle(capture)) body.append(textElement('p', excerpt.slice(0, 700), 'capture-excerpt'));
  const source = safeSource(capture.sourceUrl);
  const foot = textElement('div', null, 'capture-card-footer');
  foot.append(textElement('span', source ? source.hostname.replace(/^www\./, '') : 'Saved in Atlas'));
  if (capture.status === 'pending' || capture.status === 'processing') foot.append(textElement('span', 'Adding context', 'processing-status'));
  else if (capture.status === 'failed') foot.append(textElement('span', 'Context unavailable', 'failed-status'));
  body.append(foot); button.append(body); card.append(button);
  button.addEventListener('click', () => openCapture(capture.id));
  return card;
}
async function loadCaptures({ append = false, silent = false } = {}) {
  if (state.expired) return;
  state.controller?.abort(); state.controller = new AbortController();
  const request = ++state.listRequest;
  const params = new URLSearchParams({ limit: '60' });
  if (state.query) params.set('q', state.query);
  if (state.type) params.set('type', state.type);
  if (append && state.cursor) params.set('cursor', state.cursor);
  if (!silent) {
    $('#capture-grid').setAttribute('aria-busy', 'true');
    if (!append) { $('#capture-grid').replaceChildren(); showLibraryState('Opening your library…', 'Finding your saved things.', { loading: true }); }
    $('#load-more').disabled = true;
    setMessage($('#page-message'), '');
  }
  try {
    const result = await api(`/captures?${params}`, { signal: state.controller.signal });
    if (request !== state.listRequest || state.expired) return;
    const existing = append ? new Set(state.captures.map(capture => capture.id)) : new Set();
    const incoming = result.captures.filter(capture => !existing.has(capture.id));
    state.captures = append ? [...state.captures, ...incoming] : incoming;
    state.cursor = result.nextCursor; state.total = result.total;
    $('#library-state').hidden = true;
    if (!append) $('#capture-grid').replaceChildren();
    $('#capture-grid').append(...incoming.map(captureCard));
    $('#results-count').textContent = `${state.total.toLocaleString()} ${state.total === 1 ? 'capture' : 'captures'}${state.query ? ` for “${state.query}”` : ''}`;
    if (!state.captures.length) {
      if (state.query || state.type) showLibraryState('No finds this time.', 'Try a different keyword or clear your filters to see your collection.', { action: resetFilters, label: 'Clear filters' });
      else showLibraryState('Your first good find goes here.', 'Capture something with the Atlas extension, or write a note to get your collection started.', { action: openNote, label: 'Write a first note' });
    }
    $('#load-more').hidden = !state.cursor; $('#load-more').textContent = 'Load more captures';
  } catch (error) {
    if (request !== state.listRequest || error.name === 'AbortError' || state.expired) return;
    listRetry = () => loadCaptures({ append });
    if (append || silent) {
      setMessage($('#page-message'), error.message);
      const retryButton = textElement('button', 'Try again', 'subtle-button'); retryButton.type = 'button'; retryButton.addEventListener('click', listRetry); $('#page-message').append(retryButton);
      if (append) $('#load-more').textContent = 'Retry loading more';
    } else { $('#results-count').textContent = ''; $('#load-more').hidden = true; showLibraryState('Your library couldn’t load.', error.message, { retry: listRetry }); }
  } finally {
    if (request === state.listRequest) { $('#capture-grid').setAttribute('aria-busy', 'false'); $('#load-more').disabled = false; }
  }
}
function resetFilters() {
  state.query = ''; state.type = ''; $('#search').value = '';
  document.querySelectorAll('[data-type]').forEach(button => button.setAttribute('aria-pressed', String(!button.dataset.type)));
  loadCaptures();
}
$('#all-captures').addEventListener('click', resetFilters);
$('#search').addEventListener('input', event => {
  clearTimeout(searchTimer); const value = event.target.value.trim();
  searchTimer = setTimeout(() => { state.query = value; loadCaptures(); }, 250);
});
document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => {
  clearTimeout(searchTimer); state.query = $('#search').value.trim(); state.type = button.dataset.type;
  document.querySelectorAll('[data-type]').forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
  loadCaptures();
}));
$('#load-more').addEventListener('click', () => loadCaptures({ append: true }));
async function refreshLibrary() {
  $('#refresh-library').disabled = true; $('#check-captures').disabled = true;
  try { await refreshAccount(); await loadCaptures(); }
  catch (error) { if (!state.expired) setMessage($('#page-message'), error.message); }
  finally { $('#refresh-library').disabled = false; $('#check-captures').disabled = false; }
}
$('#refresh-library').addEventListener('click', refreshLibrary); $('#check-captures').addEventListener('click', refreshLibrary);

async function openCapture(id) {
  const request = ++state.detailRequest;
  state.detail = null; $('#detail-actions').hidden = true;
  $('#detail-body').replaceChildren(Object.assign(textElement('h2', 'Opening capture…'), { id: 'detail-title' }));
  $('#detail-kind').textContent = 'Capture'; openDialog('#detail-dialog');
  try {
    const { capture } = await api(`/captures/${encodeURIComponent(id)}`);
    if (request !== state.detailRequest || state.expired) return;
    state.detail = capture; const body = $('#detail-body'); body.replaceChildren();
    $('#detail-kind').textContent = kinds[capture.type] || 'Capture';
    body.append(Object.assign(textElement('h2', captureTitle(capture)), { id: 'detail-title' }));
    const source = safeSource(capture.sourceUrl);
    if (source) {
      const link = textElement('a', `Open source · ${source.hostname}`, 'detail-source'); link.href = source.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(link);
    }
    const blob = safeBlob(capture.blobUrl, capture.id);
    if (blob) {
      const image = textElement('img', null, 'detail-image'); image.src = blob; image.alt = capture.sourceTitle || 'Saved capture';
      image.addEventListener('error', () => {
        const errorBox = textElement('div', 'The image could not load. ', 'form-message is-error');
        const retry = textElement('button', 'Retry image', 'subtle-button'); retry.type = 'button'; retry.addEventListener('click', () => openCapture(id)); errorBox.append(retry); image.replaceWith(errorBox);
      }, { once: true }); body.append(image);
    }
    for (const [title, content] of [['Highlight', capture.selectionText], ['Note', capture.noteText], ['Summary', capture.summary], ['Article text', capture.articleText], ['Text in image', capture.ocrText]]) {
      if (!content) continue;
      const section = textElement('section', null, 'detail-section'); section.append(textElement('h3', title), textElement('p', content)); body.append(section);
    }
    if (capture.category) body.append(textElement('p', `Category: ${capture.category}`, 'muted'));
    if (Array.isArray(capture.tags) && capture.tags.length) {
      const tags = textElement('ul', null, 'detail-tags'); tags.setAttribute('aria-label', 'Capture tags');
      tags.append(...capture.tags.map(tag => textElement('li', String(tag)))); body.append(tags);
    }
    if (capture.status === 'pending' || capture.status === 'processing') body.append(textElement('p', 'Your capture is saved. Atlas is still adding context; reopen it in a moment to see updates.', 'detail-processing'));
    if (capture.status === 'failed') body.append(textElement('p', 'Your capture is safe. Automatic context could not be added.', 'detail-processing'));
    if (capture.enrichError) body.append(textElement('p', capture.enrichError, 'detail-processing'));
    $('#detail-date').textContent = `Saved ${dateLabel(capture.capturedAt, true)}`; $('#detail-actions').hidden = false;
  } catch (error) {
    if (request !== state.detailRequest || state.expired) return;
    $('#detail-body').replaceChildren(Object.assign(textElement('h2', 'Capture unavailable'), { id: 'detail-title' }), textElement('p', error.status === 404 ? 'This capture may have been deleted. Refresh your library to see your current collection.' : error.message));
    const retry = textElement('button', error.status === 404 ? 'Refresh library' : 'Try again', 'button secondary'); retry.type = 'button';
    retry.addEventListener('click', () => { if (error.status === 404) { closeDialog('#detail-dialog'); refreshLibrary(); } else openCapture(id); }); $('#detail-body').append(retry);
  }
}
$('#detail-dialog').addEventListener('close', () => { state.detailRequest++; state.detail = null; });
$('#delete-capture').addEventListener('click', async () => {
  const capture = state.detail;
  if (!capture || !await confirmAction('Delete this capture?', 'This removes it from your cloud library permanently. Any local copy in your extension stays on that device.', 'Delete capture')) return;
  $('#delete-capture').disabled = true;
  try { await api(`/captures/${encodeURIComponent(capture.id)}`, { method: 'DELETE' }); closeDialog('#detail-dialog'); toast('Capture deleted.'); await refreshLibrary(); }
  catch (error) { if (!state.expired) { const message = textElement('p', error.message, 'form-message is-error'); message.setAttribute('role', 'alert'); $('#detail-body').append(message); } }
  finally { $('#delete-capture').disabled = false; }
});

function openNote() { if (state.expired || !state.account) return; openDialog('#note-dialog'); $('#note-text').focus(); }
$('#new-note').addEventListener('click', openNote);
$('#note-text').addEventListener('input', () => { state.noteClientId = null; });
$('#note-form').addEventListener('submit', async event => {
  event.preventDefault(); const note = $('#note-text').value.trim();
  if (!note) { setMessage($('#note-error'), 'Write something before saving your note.'); $('#note-text').focus(); return; }
  if ($('#save-note').disabled) return;
  $('#save-note').disabled = true; $('#note-text').disabled = true; $('#save-note').textContent = 'Saving…'; setMessage($('#note-error'), '');
  try {
    state.noteClientId ||= crypto.randomUUID();
    await api('/captures', { method: 'POST', body: { clientId: state.noteClientId, type: 'note', noteText: note, capturedAt: Date.now() } });
    $('#note-text').value = ''; state.noteClientId = null; closeDialog('#note-dialog'); toast('Note saved to your library.'); await refreshLibrary();
  } catch (error) { if (!state.expired) setMessage($('#note-error'), error.message); }
  finally { $('#save-note').disabled = false; $('#note-text').disabled = false; $('#save-note').textContent = 'Save note'; }
});

$('#open-account').addEventListener('click', async () => {
  if (state.expired || !state.account) return;
  setMessage($('#account-message'), ''); openDialog('#account-dialog');
  try { await refreshAccount(); } catch (error) { if (!state.expired) setMessage($('#account-message'), error.message); }
});
$('#export-account').addEventListener('click', async () => {
  if (!await confirmAction('Export your cloud library?', 'Download a JSON file containing your saved captures, text and images. The file may contain private information. Large libraries can take a moment.', 'Download export')) return;
  $('#export-account').disabled = true; $('#export-account').textContent = 'Preparing export…'; setMessage($('#account-message'), '');
  try { const blob = await api('/account/export', { download: true }); downloadBlob(blob, `atlas-export-${new Date().toISOString().slice(0, 10)}.json`); toast('Your export is ready to download.'); }
  catch (error) { if (!state.expired) setMessage($('#account-message'), error.message); }
  finally { $('#export-account').disabled = false; $('#export-account').textContent = 'Export my captures'; }
});
$('#logout').addEventListener('click', async () => {
  if (!await confirmAction('Log out of Atlas?', 'This signs out this website. Connected extensions stay connected until you revoke them in account settings.', 'Log out')) return;
  $('#logout').disabled = true;
  try { await api('/auth/logout', { method: 'POST', body: {} }); location.replace('/auth.html?mode=login'); }
  catch (error) { if (!state.expired) setMessage($('#account-message'), error.message); }
  finally { $('#logout').disabled = false; }
});
$('#password-form').addEventListener('submit', async event => {
  event.preventDefault(); if ($('#change-password').disabled || !event.currentTarget.reportValidity()) return;
  if (!await confirmAction('Change your password?', 'Other sessions will be signed out and all connected browsers will need to reconnect. You’ll receive a new recovery code to save.', 'Change password')) return;
  $('#change-password').disabled = true; setMessage($('#password-error'), '');
  try {
    const result = await api('/auth/password', { method: 'POST', body: { currentPassword: $('#current-password').value, password: $('#new-password').value } });
    $('#password-form').reset(); state.recoveryCode = result.recoveryCode;
    $('#password-recovery-code').textContent = state.recoveryCode; $('#password-recovery-saved').checked = false; $('#finish-password-recovery').disabled = true;
    openDialog('#password-recovery-dialog');
    refreshAccount().catch(() => {}); detectExtension();
  } catch (error) { if (!state.expired) setMessage($('#password-error'), error.message); }
  finally { $('#change-password').disabled = false; }
});
$('#password-recovery-dialog').addEventListener('cancel', event => { if (state.recoveryCode) event.preventDefault(); });
$('#download-password-recovery').addEventListener('click', () => recoveryDownload(state.recoveryCode, state.account.email));
$('#password-recovery-saved').addEventListener('change', event => { $('#finish-password-recovery').disabled = !event.target.checked; });
$('#finish-password-recovery').addEventListener('click', () => {
  if (!$('#password-recovery-saved').checked) return;
  state.recoveryCode = ''; $('#password-recovery-code').textContent = ''; closeDialog('#password-recovery-dialog'); toast('Password changed. Reconnect your browsers when you’re ready.');
});
$('#open-delete-account').addEventListener('click', () => { $('#delete-account-form').reset(); setMessage($('#delete-account-error'), ''); openDialog('#delete-account-dialog'); });
$('#delete-account-form').addEventListener('submit', async event => {
  event.preventDefault(); if ($('#delete-account-submit').disabled || !event.currentTarget.reportValidity()) return;
  $('#delete-account-submit').disabled = true; setMessage($('#delete-account-error'), '');
  try { await api('/account', { method: 'DELETE', body: { password: $('#delete-password').value } }); location.replace('/auth.html?mode=signup&deleted=1'); }
  catch (error) { if (!state.expired) setMessage($('#delete-account-error'), error.message); }
  finally { $('#delete-account-submit').disabled = false; }
});
window.addEventListener('beforeunload', event => { if (state.recoveryCode || $('#note-text').value.trim()) event.preventDefault(); });
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); }
});
window.addEventListener('online', () => { if (!state.expired) { toast('You’re back online. Refreshing your library.'); refreshLibrary(); } });
window.addEventListener('offline', () => setMessage($('#page-message'), 'You’re offline. Reconnect to load or save cloud captures. Your extension can still save locally.'));

async function start() {
  try {
    await refreshAccount(); if (state.expired) return;
    $('#new-note').disabled = false; $('#onboarding').hidden = !!(state.usage.captures && state.connections.length);
    await Promise.allSettled([loadCaptures(), detectExtension()]);
  } catch (error) {
    if (!state.expired) showLibraryState('Atlas couldn’t open your account.', error.message, { retry: start });
  }
}
start();
// Keep new saves and enrichment visible without interrupting open captures or pagination.
setInterval(async () => {
  if (document.visibilityState !== 'visible' || state.expired || !state.account || document.querySelector('dialog[open]')) return;
  try {
    const count = state.usage.captures, size = state.usage.bytes;
    await refreshAccount();
    if (state.expired) return;
    const changed = state.usage.captures !== count || state.usage.bytes !== size;
    const processing = state.captures.some(capture => ['pending', 'processing'].includes(capture.status));
    if (changed || processing) {
      if (state.captures.length <= 60) await loadCaptures({ silent: true });
      else if (changed) toast('Your library has new changes. Refresh to see the latest captures.');
    }
  } catch { /* Explicit refresh provides retry and connection feedback. */ }
}, 15000);
