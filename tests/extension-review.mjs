import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dockWorld } from './helpers/dock-world.mjs';
import { pollUntil } from './helpers/poll.mjs';
import { launch, signIn, extensionPage, summon, fixture, waitForLength, localCaptures } from './helpers/dock-launch.mjs';

// The details card is review.html in its "edit" mode: an extension-origin
// page the dock frames after a save, which edits that save and nothing else.
const SAVED = '✓ Saved to My library · Add details';
const PAGE = '<title>Details fixture</title><article><h1>A page worth keeping</h1><p>Readable text for the saved page.</p></article>';
const COLLECTION = { id: 'col_1', title: 'Design refs', visibility: 'public', canSubmit: true, requireApproval: false, canModerate: true };

// A small stateful stand-in for the backend's capture routes: POST commits
// once per client id (a retry answers 200 + duplicate:true, like
// apps/backend/src/customer.ts), GET/PUT /api/mobile/captures/remote-1 read
// and update the committed row with the same expectedUpdatedAt check.
async function saveAndOpen(t, name, { online = true, collections = [], folders = [], headers = {} } = {}) {
  const { context, worker, extensionId, origin } = await launch(t, { prefix: 'foundkeep-details-' });
  const uploads = [], puts = [], entries = [];
  await signIn(context, worker, { collections, folders });
  // mode: 'online' | 'offline' (503) | 'lose-response' (commit, then drop the answer)
  const state = { mode: online ? 'online' : 'offline', gate: null, server: null, beforePut: null, detailDelay: 0, get online() { return this.mode === 'online'; }, set online(value) { this.mode = value ? 'online' : 'offline'; } };
  // Registered after signIn's own route, so this one handles POST uploads.
  await context.route('**/api/captures', async r => {
    if (r.request().method() !== 'POST') return r.fallback();
    const body = r.request().postDataJSON();
    uploads.push(body);
    if (state.gate) await state.gate;
    if (state.mode === 'offline') return r.fulfill({ status: 503, json: { error: 'unavailable', message: 'Try later.' } });
    const duplicate = !!state.server;
    if (!duplicate) state.server = { sourceTitle: body.sourceTitle ?? null, noteText: body.noteText ?? null, userTags: body.userTags || [], folderId: body.folderId ?? null, updatedAt: 111 };
    if (state.mode === 'lose-response') { state.mode = 'online'; return r.abort('connectionreset'); }
    return r.fulfill({ status: duplicate ? 200 : 201, json: { capture: { id: 'remote-1', status: 'done' }, duplicate } });
  });
  await context.route('**/api/mobile/captures/remote-1', async r => {
    const capture = () => ({ id: 'remote-1', ...state.server });
    if (r.request().method() === 'GET') {
      if (state.detailDelay) await new Promise(resolve => setTimeout(resolve, state.detailDelay));
      return r.fulfill({ json: { capture: capture() } });
    }
    const body = r.request().postDataJSON();
    puts.push({ method: r.request().method(), body });
    await state.beforePut?.(state.server);
    if (body.expectedUpdatedAt !== state.server.updatedAt) return r.fulfill({ status: 409, json: { error: 'capture_changed', message: 'This capture changed. Refresh it before saving your edits.' } });
    for (const key of ['sourceTitle', 'noteText', 'folderId', 'userTags']) if (key in body) state.server[key] = body[key];
    state.server.updatedAt++;
    return r.fulfill({ json: { capture: capture() } });
  });
  await context.route('**/api/collections/*/entries', r => { entries.push({ url: r.request().url(), body: r.request().postDataJSON() }); return r.fulfill({ status: 201, json: { entry: { id: 'entry-1', status: 'approved' } } }); });
  await fixture(context, origin + '/' + name, PAGE, headers);
  const web = await context.newPage(); await web.goto(origin + '/' + name);
  const ext = await extensionPage(context, worker);
  assert.equal(await summon(ext, origin + '/' + name + '*'), true);
  await web.bringToFront();
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  return { context, worker, extensionId, origin, web, ext, dock, uploads, puts, entries, state };
}
const synced = ext => pollUntil(ext, async () => (await (await import('./db.js')).listCaptures())[0]?.cloudStatus === 'synced', null, { timeout: 15000 });
const uploaded = ext => pollUntil(ext, async () => (await (await import('./db.js')).listCaptures())[0]?.cloudRemoteId === 'remote-1', null);
async function cardFrame(web, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const frame = web.frames().find(f => f.url().includes('review.html'));
    if (frame) return frame;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('the details card did not appear');
}
async function openDetails(web, dock) {
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 10000);
  await dock.click('.toast [data-action="details"]');
  const card = await cardFrame(web);
  await card.waitForSelector('#detailsForm[data-ready="true"]', { timeout: 8000 });
  await dock.waitFor("__foundkeepDock.state() === 'details'");
  return card;
}
async function feedbackMatches(frame, pattern, timeout = 5000) {
  const deadline = Date.now() + timeout;
  let text = '';
  while (Date.now() < deadline) {
    text = await frame.locator('#detailsFeedback').textContent().catch(() => '');
    if (pattern.test(text)) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`feedback never matched ${pattern}: ${JSON.stringify(text)}`);
}
// The card's Selects open FoundKeep Listboxes (listbox.js), not native <select>s.
async function addTag(card, value) {
  await card.click('#detailsAddTag');
  await card.fill('.fk-listbox__input', value);
  await card.press('.fk-listbox__input', 'Enter');
  await card.waitForSelector(`#detailsTags .fk-tag[data-tag="${value}"]`, { state: 'attached' });
  await card.press('.fk-listbox__input', 'Escape');
  await card.waitForSelector('.fk-listbox', { state: 'detached' });
}
/** Open a Select's Listbox, wait for the option (folders and collections load after the card), pick it. */
async function pick(card, trigger, value) {
  const deadline = Date.now() + 8000;
  for (;;) {
    await card.click(trigger);
    if (await card.waitForSelector(`.fk-listbox__option[data-value="${value}"]`, { timeout: 1000 }).then(() => true, () => false)) break;
    await card.press('.fk-listbox__input', 'Escape');
    if (Date.now() > deadline) throw new Error(`No ${value} in ${trigger}`);
  }
  await card.click(`.fk-listbox__option[data-value="${value}"]`);
  await card.waitForSelector('.fk-listbox', { state: 'detached' });
}
/**
 * Click Save once the frame has caught up with the card. Adding a tag can
 * wrap a row and make the card taller; the dock resizes its frame a message
 * round trip later, which moves Save — a click aimed before that lands on
 * the page.
 */
async function saveCard(card, dock) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const form = await card.evaluate(() => Math.ceil(document.querySelector('#detailsForm').getBoundingClientRect().height));
    const frame = await dock.evaluate(`Math.round(__foundkeepDock.rect('.card').height)`);
    if (Math.abs(frame - Math.min(Math.max(160, form), 600)) <= 1) break;
    await new Promise(r => setTimeout(r, 50));
  }
  await card.click('#detailsSave');
}
async function listboxValues(card, trigger) {
  await card.click(trigger);
  const values = await card.$$eval('.fk-listbox__option[data-value]', options => options.map(o => o.dataset.value));
  await card.press('.fk-listbox__input', 'Escape');
  return values;
}

test('details: Add details opens the edit card pre-filled from the save, and before upload the local record carries the edits into the upload', { timeout: 40000 }, async t => {
  const { web, ext, dock, uploads, puts, state } = await saveAndOpen(t, '__before', { online: false, folders: [{ id: 'folder-a', name: 'Reading' }] });
  await dock.click('[data-action="savepage"]');
  await pollUntil(ext, async () => (await (await import('./db.js')).listCaptures()).some(c => c.cloudStatus === 'queued' && c.cloudAttempts > 0), null);
  const card = await openDetails(web, dock);
  assert.match(card.url(), /^chrome-extension:\/\/[^/]+\/src\/review\.html\?tab=\d+&grant=[\w-]+$/);
  assert.equal(await card.$eval('#detailsForm', form => form.firstElementChild.className), 'details__title-row', 'nothing above the title');
  assert.equal(await card.inputValue('#detailsTitle'), 'Details fixture', 'pre-filled from the saved capture');
  assert.equal(await card.inputValue('#detailsNote'), '');
  await card.waitForSelector('#detailsFeedback:empty', { state: 'attached' }); // folders and collections loaded
  assert.deepEqual(await listboxValues(card, '#detailsFolder'), ['', 'folder-a']);
  assert.deepEqual(await listboxValues(card, '#detailsCollection'), ['']);

  await card.fill('#detailsTitle', 'Edited before upload');
  await card.fill('#detailsNote', 'Why this matters');
  await addTag(card, 'Research');
  await pick(card, '#detailsFolder', 'folder-a');
  assert.match(await card.textContent('#detailsFolder'), /Reading/);
  await saveCard(card, dock);
  await dock.waitFor(`__foundkeepDock.status() === 'Details saved'`, 8000);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  assert.deepEqual(web.frames().filter(f => f !== web.mainFrame()).map(f => f.url()), [], 'the card closes');
  const [local] = await localCaptures(ext);
  assert.deepEqual({ title: local.sourceTitle, note: local.noteText, tags: local.userTags, folder: local.folderId, remote: local.cloudRemoteId },
    { title: 'Edited before upload', note: 'Why this matters', tags: ['Research'], folder: 'folder-a', remote: null });

  state.online = true;
  await ext.evaluate(() => import('./cloud.js').then(m => m.retryCloudSync()));
  await pollUntil(ext, async () => (await (await import('./db.js')).listCaptures())[0]?.cloudStatus === 'synced', null);
  const last = uploads[uploads.length - 1];
  assert.deepEqual({ title: last.sourceTitle, note: last.noteText, tags: last.userTags, folder: last.folderId },
    { title: 'Edited before upload', note: 'Why this matters', tags: ['Research'], folder: 'folder-a' }, 'the pending upload carries the details');
  assert.deepEqual(puts, [], 'no separate update is needed before upload');
});

test('details: after upload, Add details sends PUT with the remote id, shares to a collection, and mirrors the change locally', { timeout: 40000 }, async t => {
  const { web, ext, dock, puts, entries } = await saveAndOpen(t, '__after', { collections: [COLLECTION] });
  await dock.click('[data-action="savepage"]');
  await pollUntil(ext, async () => (await (await import('./db.js')).listCaptures())[0]?.cloudRemoteId === 'remote-1', null);
  const card = await openDetails(web, dock);
  await card.fill('#detailsTitle', 'Edited after upload');
  await card.fill('#detailsNote', 'A private note');
  await addTag(card, 'Keep');
  await pick(card, '#detailsCollection', 'col_1');
  await card.waitForSelector('#detailsShare:not([hidden])');
  assert.equal(await card.textContent('#detailsSave'), 'Save', 'a shared save says just Save');
  await card.fill('#sharedBody', 'Worth a look');
  await saveCard(card, dock);
  await dock.waitFor(`__foundkeepDock.status() === 'Details saved'`, 8000);

  // Only what the user changed (title, note, tags); the unchanged folder is
  // left alone on the server.
  assert.deepEqual(puts, [{ method: 'PUT', body: { sourceTitle: 'Edited after upload', noteText: 'A private note', userTags: ['Keep'], expectedUpdatedAt: 111 } }]);
  assert.equal(entries.length, 1);
  assert.match(entries[0].url, /\/api\/collections\/col_1\/entries$/);
  assert.equal(entries[0].body.captureId, 'remote-1');
  assert.equal(entries[0].body.title, 'Edited after upload');
  assert.equal(entries[0].body.body, 'Worth a look');
  assert.match(entries[0].body.url, /\/__after$/, 'the collection gets the page link');
  assert.equal(entries[0].body.noteText, undefined, 'the private note is never shared');
  const [local] = await localCaptures(ext);
  assert.deepEqual({ title: local.sourceTitle, note: local.noteText, tags: local.userTags, status: local.cloudStatus, shared: local.collectionSubmission?.id },
    { title: 'Edited after upload', note: 'A private note', tags: ['Keep'], status: 'synced', shared: 'col_1' });
});

test('details: an edit made while the upload is in flight is sent once the upload lands', { timeout: 40000 }, async t => {
  const { web, ext, dock, uploads, puts, state } = await saveAndOpen(t, '__race');
  let release; state.gate = new Promise(resolve => { release = resolve; });
  await dock.click('[data-action="savepage"]');
  assert.equal(await waitForLength(uploads, 1), 1, 'the upload is in flight');
  const card = await openDetails(web, dock);
  await card.fill('#detailsTitle', 'Edited mid-upload');
  await saveCard(card, dock);
  await dock.waitFor(`__foundkeepDock.status() === 'Details saved'`, 8000);
  assert.equal(uploads[0].sourceTitle, 'Details fixture', 'the in-flight upload still has the old title');
  release();
  await pollUntil(ext, async () => (await (await import('./db.js')).listCaptures())[0]?.cloudStatus === 'synced', null, { timeout: 15000 });
  assert.equal(puts.length, 1, 'the edit follows as an update');
  assert.equal(puts[0].body.sourceTitle, 'Edited mid-upload');
  const [local] = await localCaptures(ext);
  assert.equal(local.sourceTitle, 'Edited mid-upload');
});

test('details: Cancel changes nothing and relays done exactly once to the dock, never to the page (R16)', { timeout: 40000 }, async t => {
  const { worker, web, ext, dock } = await saveAndOpen(t, '__cancel');
  await web.evaluate(() => { window.__pageMessages = []; addEventListener('message', event => window.__pageMessages.push(JSON.stringify(event.data))); });
  await dock.click('[data-action="savepage"]');
  const tabId = await ext.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__cancel' }))[0].id);
  await worker.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, func: () => {
    window.__relayed = [];
    chrome.runtime.onMessage.addListener(message => { if (message?.kind === 'dock-details-frame') window.__relayed.push(message); });
  } }), tabId);
  const card = await openDetails(web, dock);
  await card.fill('#detailsTitle', 'Not kept');
  await card.click('#detailsCancel');
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await new Promise(r => setTimeout(r, 500));
  const relayed = await worker.evaluate(async tabId => (await chrome.scripting.executeScript({ target: { tabId }, func: () => window.__relayed }))[0].result, tabId);
  assert.deepEqual(relayed.filter(m => m.type === 'done'), [{ kind: 'dock-details-frame', type: 'done', saved: false }]);
  assert.deepEqual(await web.evaluate(() => window.__pageMessages), [], 'the page never receives card messages');
  assert.equal((await localCaptures(ext))[0].sourceTitle, 'Details fixture');
  // The grant ends with the card: its URL cannot be used again.
  await pollUntil(worker, async tabId => !((await chrome.storage.session.get('foundkeep-details-grants'))['foundkeep-details-grants'] || {})[tabId], tabId);
});

test('details: the page cannot drive or hijack the card (C1), and a card framed without its grant or for another tab never loads a save', { timeout: 60000 }, async t => {
  const { context, worker, extensionId, origin, web, ext, dock } = await saveAndOpen(t, '__victim');
  const PAGE_SCRIPT = `<title>Hijack fixture</title><p>Text.</p><script>
    window.__received = [];
    addEventListener('message', event => {
      window.__received.push(JSON.stringify(event.data));
      try { event.source.postMessage({ type: 'done', saved: true }, '*'); } catch {}
      try { event.source.location = location.origin + '/__evil'; } catch {}
    });
  </script>`;
  await fixture(context, origin + '/__evil', '<title>Evil</title><p>Attacker page</p>');
  await fixture(context, origin + '/__attacker', PAGE_SCRIPT);
  await web.evaluate(() => {
    window.__received = [];
    addEventListener('message', event => { window.__received.push(JSON.stringify(event.data)); try { event.source.location = location.origin + '/__evil'; } catch {} });
  });
  await dock.click('[data-action="savepage"]');
  const card = await openDetails(web, dock);
  assert.equal(await web.evaluate(() => window.length), 0, 'the page cannot reach the card frame');
  await card.fill('#detailsNote', 'Grow the card a little\n\n\n\n');
  await new Promise(r => setTimeout(r, 800));
  assert.deepEqual(await web.evaluate(() => window.__received), [], 'the page never receives a card message');
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'details');
  const victimTab = await ext.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__victim' }))[0]);
  // The card's own URL, in the per-session dynamic form (use_dynamic_url) a
  // page would have to use — Playwright reports frames by the plain id.
  const grant = new URL(card.url()).searchParams.get('grant');
  assert.ok(grant);
  const grantUrl = await worker.evaluate(({ id, grant }) => chrome.runtime.getURL(`src/review.html?tab=${id}&grant=${grant}`), { id: victimTab.id, grant });

  // Another tab frames the victim's exact card URL (grant included): the
  // grant is bound to the victim's tab, so it never loads the save.
  const attacker = await context.newPage(); await attacker.goto(origin + '/__attacker');
  for (const [id, url] of [['stolen', grantUrl], ['guessed', await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), victimTab.id)]]) {
    await attacker.evaluate(({ id, url }) => { const frame = document.createElement('iframe'); frame.id = id; frame.src = url; document.body.append(frame); }, { id, url });
    const frame = attacker.frameLocator('#' + id);
    await frame.locator('#detailsForm').waitFor();
    let ready = false;
    try { await frame.locator('#detailsForm[data-ready="true"]').waitFor({ timeout: 2500 }); ready = true; } catch { /* expected */ }
    assert.equal(ready, false, `${id}: a card outside its own tab/grant must never become ready`);
    await feedbackMatches(frame, /no longer available/i);
  }
  // The victim's own page cannot load a second card without the grant either.
  await web.bringToFront();
  await web.evaluate(url => { const frame = document.createElement('iframe'); frame.id = 'noGrant'; frame.src = url; document.body.append(frame); },
    await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), victimTab.id));
  const noGrant = web.frameLocator('#noGrant');
  await noGrant.locator('#detailsForm').waitFor();
  await feedbackMatches(noGrant, /no longer available/i);
  assert.equal(await noGrant.locator('#detailsForm').getAttribute('data-ready'), 'false');
  await web.evaluate(() => document.getElementById('noGrant').remove());
  // Nor can a top-level tab opened at the card's own URL, grant included
  // (what the removed fallback popup used to be): it is not framed in the
  // victim's tab.
  const top = await context.newPage();
  await top.goto(`chrome-extension://${extensionId}/src/review.html?tab=${victimTab.id}&grant=${grant}`);
  await top.waitForSelector('#detailsForm');
  await feedbackMatches(top, /no longer available/i);
  assert.equal(await top.getAttribute('#detailsForm', 'data-ready'), 'false');
  await top.close();
  await web.bringToFront();
  assert.equal((await localCaptures(ext))[0].sourceTitle, 'Details fixture', 'nothing was edited by any of them');

  // Should the real card's frame ever load a second document (forced here
  // through CDP), the dock closes it rather than keep framing it.
  await card.goto(origin + '/__evil').catch(() => {});
  await dock.waitFor("__foundkeepDock.state() === 'expanded'", 5000);
  const deadline = Date.now() + 5000;
  while (web.frames().some(f => f !== web.mainFrame()) && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(web.frames().filter(f => f !== web.mainFrame()).map(f => f.url()), [], 'the navigated card frame is removed');
  assert.equal(await dock.evaluate('__foundkeepDock.status()'), 'Details closed. Your save is kept.');
  assert.deepEqual(await web.evaluate(() => window.__received), []);
});

test('details: after the account changes, the card cannot edit the earlier account\'s save', { timeout: 40000 }, async t => {
  const { worker, web, ext, dock } = await saveAndOpen(t, '__account');
  await dock.click('[data-action="savepage"]');
  const card = await openDetails(web, dock);
  await worker.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'different-account' }, connection: { id: 'different-connection' }, token: 't'.repeat(43), status: 'connected' } }));
  await card.fill('#detailsTitle', 'Should not land');
  await saveCard(card, dock);
  await pollUntil(card, () => /account changed/i.test(document.querySelector('#detailsFeedback')?.textContent || ''), null);
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'details', 'the card stays open with the error');
  assert.equal((await localCaptures(ext))[0].sourceTitle, 'Details fixture');
});

test('details: keyboard — Add details moves focus into the card, and Esc returns it to the toolbar (M4)', { timeout: 40000 }, async t => {
  const { web, dock } = await saveAndOpen(t, '__keys');
  await dock.click('[data-action="savepage"]');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 10000);
  for (let i = 0; i < 16 && await dock.evaluate('__foundkeepDock.focused()') !== 'details'; i++) await web.keyboard.press('Tab');
  assert.equal(await dock.evaluate('__foundkeepDock.focused()'), 'details', 'Tab reaches Add details');
  await web.keyboard.press('Enter');
  const card = await cardFrame(web);
  await card.waitForSelector('#detailsForm[data-ready="true"]', { timeout: 8000 });
  await dock.waitFor("__foundkeepDock.focused() === 'card'");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && await card.evaluate(() => document.activeElement?.id) !== 'detailsTitle') await new Promise(r => setTimeout(r, 50));
  assert.equal(await card.evaluate(() => document.activeElement?.id), 'detailsTitle');
  await web.keyboard.press('End');
  await web.keyboard.type(' (typed)');
  assert.equal(await card.inputValue('#detailsTitle'), 'Details fixture (typed)');
  await web.keyboard.press('Escape');
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.waitFor("__foundkeepDock.focused() === 'savepage'");
});

test('dock-ui: the toolbar-icon toggle never collapses a dock with the details card open', { timeout: 30000 }, async t => {
  const { worker, web, ext, dock } = await saveAndOpen(t, '__toggle-card');
  await dock.click('[data-action="savepage"]');
  await openDetails(web, dock);
  const tabId = await ext.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__toggle-card' }))[0].id);
  await worker.evaluate(async id => { await chrome.tabs.sendMessage(id, { kind: 'dock-show', expand: true, toggle: true }); }, tabId);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'details', 'toggle must not collapse a dock with its card open');
});

// Fix round 1, item 1: a first upload that committed on the server but whose
// answer was lost is retried; the server answers duplicate:true and ignores
// the retried body, so an edit made in between must still be sent as a PUT.
test('details: an edit after a committed-but-unanswered upload is sent once the retry comes back duplicate', { timeout: 40000 }, async t => {
  const { web, ext, dock, uploads, puts, state } = await saveAndOpen(t, '__lost-response');
  state.mode = 'lose-response';
  await dock.click('[data-action="savepage"]');
  await pollUntil(ext, async () => { const [c] = await (await import('./db.js')).listCaptures(); return c?.cloudAttempts > 0 && !c.cloudRemoteId; }, null);
  assert.equal(uploads.length, 1);
  assert.equal(state.server.sourceTitle, 'Details fixture', 'the server committed the first upload');
  const card = await openDetails(web, dock);
  await card.fill('#detailsTitle', 'Edited after a lost response');
  await saveCard(card, dock);
  await dock.waitFor(`__foundkeepDock.status() === 'Details saved'`, 8000);
  await synced(ext);
  assert.equal(uploads.length, 2, 'the upload was retried');
  assert.equal(puts.length, 1, 'the duplicate answer does not count as delivering the edit');
  assert.equal(puts[0].body.sourceTitle, 'Edited after a lost response');
  assert.equal(state.server.sourceTitle, 'Edited after a lost response');
});

// Fix round 1, item 2: the card starts from the server's current values and
// the PUT sends only what the user changed — never a stale local copy.
test('details: a web edit to the title survives a tag edit from the card (pre-filled from the server, PUT sends only the change)', { timeout: 40000 }, async t => {
  const { web, ext, dock, puts, state } = await saveAndOpen(t, '__server-edit');
  await dock.click('[data-action="savepage"]');
  await uploaded(ext);
  // Renamed and annotated on the web after the upload.
  Object.assign(state.server, { sourceTitle: 'Renamed on the web', noteText: 'Web note', userTags: ['Web'], folderId: 'folder-web', updatedAt: 150 });
  const card = await openDetails(web, dock);
  assert.equal(await card.inputValue('#detailsTitle'), 'Renamed on the web', 'pre-filled from the server');
  assert.equal(await card.inputValue('#detailsNote'), 'Web note');
  await addTag(card, 'Keep');
  await saveCard(card, dock);
  await dock.waitFor(`__foundkeepDock.status() === 'Details saved'`, 8000);
  await synced(ext);
  assert.deepEqual(puts.map(p => p.body), [{ sourceTitle: 'Renamed on the web', noteText: 'Web note', userTags: ['Web', 'Keep'], expectedUpdatedAt: 150 }]);
  assert.deepEqual({ ...state.server, updatedAt: 0 }, { sourceTitle: 'Renamed on the web', noteText: 'Web note', userTags: ['Web', 'Keep'], folderId: 'folder-web', updatedAt: 0 });
  const [local] = await localCaptures(ext);
  assert.deepEqual({ title: local.sourceTitle, tags: local.userTags, folder: local.folderId }, { title: 'Renamed on the web', tags: ['Web', 'Keep'], folder: 'folder-web' }, 'the local copy mirrors the server');
});

test('details: a server change during the PUT (capture_changed) is re-read, not overwritten', { timeout: 40000 }, async t => {
  const { web, ext, dock, puts, state } = await saveAndOpen(t, '__conflict');
  await dock.click('[data-action="savepage"]');
  await uploaded(ext);
  const card = await openDetails(web, dock);
  await card.fill('#detailsNote', 'My note');
  // Someone renames the save (and files it) between our read and our write.
  let raced = false;
  state.beforePut = server => { if (raced) return; raced = true; Object.assign(server, { sourceTitle: 'Renamed meanwhile', folderId: 'folder-b', updatedAt: server.updatedAt + 5 }); };
  await saveCard(card, dock);
  await dock.waitFor(`__foundkeepDock.status() === 'Details saved'`, 8000);
  await synced(ext);
  assert.equal(puts.length, 2, 'the conflicting write is retried once against the fresh copy');
  assert.deepEqual(puts[1].body, { sourceTitle: 'Renamed meanwhile', noteText: 'My note', expectedUpdatedAt: 116 });
  assert.deepEqual({ title: state.server.sourceTitle, note: state.server.noteText, folder: state.server.folderId }, { title: 'Renamed meanwhile', note: 'My note', folder: 'folder-b' });
});

// Fix round 1, item 7: the card's own error stays on screen; the dock's 3 s
// "could not open" fallback is only for a card that never loaded.
test('details: a card that cannot load its save shows why and stays open', { timeout: 40000 }, async t => {
  const { worker, web, dock } = await saveAndOpen(t, '__card-error');
  await dock.click('[data-action="savepage"]');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 10000);
  await worker.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'different-account' }, connection: { id: 'different-connection' }, token: 't'.repeat(43), status: 'connected' } }));
  await dock.click('.toast [data-action="details"]');
  const card = await cardFrame(web);
  await feedbackMatches(card, /account changed/i);
  await new Promise(r => setTimeout(r, 3500));
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'details', 'the card stays open with its message');
  assert.equal(await dock.evaluate('__foundkeepDock.status()'), '', 'no generic "could not open" message replaces it');
  assert.equal(await card.getAttribute('#detailsCancel', 'aria-label'), 'Close without saving');
  await card.click('#detailsCancel');
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
});

// Fix round 1, item 5: a page whose CSP forbids frames still gets the card.
// Chrome does not apply a page's frame-src to the extension's own
// web-accessible pages, so the card opens framed.
test('details: the card opens framed on a strict-CSP page (frame-src none) and saves', { timeout: 40000 }, async t => {
  const { web, ext, dock } = await saveAndOpen(t, '__strict', { headers: { 'content-security-policy': "frame-src 'none'; default-src 'self'" } });
  await dock.click('[data-action="savepage"]');
  const card = await openDetails(web, dock);
  await card.fill('#detailsTitle', 'Saved despite a strict CSP');
  await saveCard(card, dock);
  await dock.waitFor(`__foundkeepDock.status() === 'Details saved'`, 8000);
  assert.equal((await localCaptures(ext))[0].sourceTitle, 'Saved despite a strict CSP');
});

// Fix round 2, item 1: the card must not wait on a slow server read past the
// dock's 3 s "ready" window. It opens from the local copy, and the save still
// sends only what the user changed in the card.
test('details: with a slow server read the card opens from the local copy, and the PUT sends only the changed field', { timeout: 60000 }, async t => {
  const { web, ext, dock, puts, state } = await saveAndOpen(t, '__slow-read');
  await dock.click('[data-action="savepage"]');
  await uploaded(ext);
  Object.assign(state.server, { sourceTitle: 'Renamed on the web', updatedAt: 200 });
  state.detailDelay = 4500;
  const started = Date.now();
  const card = await openDetails(web, dock);
  assert.ok(Date.now() - started < 4000, 'the card was ready before the slow read returned');
  assert.equal(await card.inputValue('#detailsTitle'), 'Details fixture', 'pre-filled from the local copy');
  await new Promise(r => setTimeout(r, 1500));
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'details', 'the dock keeps the card open');
  assert.equal(await dock.evaluate('__foundkeepDock.status()'), '');
  await addTag(card, 'Keep');
  await saveCard(card, dock);
  await dock.waitFor(`__foundkeepDock.status() === 'Details saved'`, 20000);
  await synced(ext);
  // The untouched title is the server's current one (read at update time),
  // not the stale local title the card showed.
  assert.deepEqual(puts.map(p => p.body), [{ sourceTitle: 'Renamed on the web', noteText: null, userTags: ['Keep'], expectedUpdatedAt: 200 }]);
  assert.equal(state.server.sourceTitle, 'Renamed on the web');
});
