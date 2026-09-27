import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pollUntil } from './helpers/poll.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

// The dock frames review.html on the very tab it is reviewing (dock-control's
// openReview sends dock-review-open with `review.html?tab=<tab.id>` to that
// same tab), so the background's reviewTabFor(sender) check — which a Task 4
// hardening pass added because review.html is now a web-accessible resource
// any page could otherwise iframe for someone else's tab id — requires the
// framing tab's own id to equal the `tab` query param. These tests frame the
// card on the fixture page itself (`web`) rather than on an unrelated
// extension tab, matching that real topology.
async function frameReview(web, worker, tabId, frameId) {
  const url = await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), tabId);
  const handle = await web.evaluateHandle(({ url, frameId }) => {
    const frame = document.createElement('iframe');
    frame.id = frameId; frame.src = url;
    document.body.append(frame);
    return frame;
  }, { url, frameId });
  return handle.asElement().contentFrame();
}

test('review card: account required, note text comes from the form, cancel clears the draft', { timeout: 30000 }, async t => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-review-'); let context;
  t.after(async () => { await context?.close(); await rm(profile, { recursive: true, force: true }); });
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await context.route(origin + '/__review', route => route.fulfill({ contentType: 'text/html', body: '<title>Review fixture</title>' }));
  const web = await context.newPage(); await web.goto(origin + '/__review');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  const tabId = await ext.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__review' }))[0].id);
  // Signed out: staging is refused with a sign-in message.
  const signedOut = await ext.evaluate(async id => { try { await (await import('./save-review.js')).stageSaveReview({ action: 'note', tab: await chrome.tabs.get(id), text: '', trigger: 'dock' }); return 'staged'; } catch (e) { return e.message; } }, tabId);
  assert.match(signedOut, /Sign in to FoundKeep to save/);
  // Signed in (fixture account with no network): a draft stages and renders.
  await ext.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' } }));
  await context.route('**/api/organization', route => route.fulfill({ json: { folders: [], tags: [], suggestedTags: [] } }));
  await context.route('**/api/collections', route => route.fulfill({ json: { collections: [] } }));
  await context.route('**/api/captures', route => route.fulfill({ json: { capture: { id: 'remote-1', status: 'done' } } }));
  await ext.evaluate(async id => (await import('./save-review.js')).stageSaveReview({ action: 'note', tab: await chrome.tabs.get(id), text: '', trigger: 'dock' }), tabId);
  const card = await frameReview(web, worker, tabId, 'cardFrame');
  await card.waitForSelector('#reviewForm[data-ready="true"]');
  assert.deepEqual(await card.$$eval('#saveDestination option', options => options.map(o => o.value)), ['library']);
  assert.equal(await card.getAttribute('#reviewNote', 'required'), '');
  // Note text comes from the confirmed form, not from whatever was staged.
  await card.fill('#reviewNote', 'Written in the review card');
  await card.click('#destinationConfirm');
  await pollUntil(ext, async id => !(await (await import('./save-review.js')).readSaveReview(id)), tabId);
  // Confirm works offline: the record is stored locally (and queued for
  // sync) before any network round trip settles. Poll rather than reading
  // once — the card's own tab can close itself right after confirming
  // (unframed finish() calls window.close()), and Playwright's click()
  // resolves once the click dispatches, not once the confirm round trip
  // (message to the background, capture, IndexedDB write) has settled.
  await pollUntil(ext, async text => (await (await import('./db.js')).listCaptures()).some(c => c.noteText === text), 'Written in the review card');
  // A second draft on the same tab: cancel clears it without confirming.
  await ext.evaluate(async id => (await import('./save-review.js')).stageSaveReview({ action: 'note', tab: await chrome.tabs.get(id), text: '', trigger: 'dock' }), tabId);
  const card2 = await frameReview(web, worker, tabId, 'card2Frame');
  await card2.waitForSelector('#reviewForm[data-ready="true"]');
  await card2.click('#reviewCancel');
  await pollUntil(ext, async id => !(await (await import('./save-review.js')).readSaveReview(id)), tabId);
  const capturesAfterCancel = await ext.evaluate(async () => (await (await import('./db.js')).listCaptures()).length);
  assert.equal(capturesAfterCancel, 1, 'cancel must not save a second capture');
});

test('review card: cancel posts done exactly once to a framing parent', { timeout: 30000 }, async t => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-review-frame-'); let context;
  t.after(async () => { await context?.close(); await rm(profile, { recursive: true, force: true }); });
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await context.route(origin + '/__review3', route => route.fulfill({ contentType: 'text/html', body: '<title>Review fixture 3</title>' }));
  const web = await context.newPage(); await web.goto(origin + '/__review3');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  const tabId = await ext.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__review3' }))[0].id);
  await ext.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' } }));
  await context.route('**/api/organization', route => route.fulfill({ json: { folders: [], tags: [], suggestedTags: [] } }));
  await context.route('**/api/collections', route => route.fulfill({ json: { collections: [] } }));
  await ext.evaluate(async id => (await import('./save-review.js')).stageSaveReview({ action: 'note', tab: await chrome.tabs.get(id), text: '', trigger: 'dock' }), tabId);
  const reviewUrl = await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), tabId);
  // The dock frames review.html on the tab it reviews, so this frame lives
  // on `web` (the same tab the draft was staged for) — reviewTabFor(sender)
  // requires the framing tab's own id to equal the `tab` query param.
  // popup.html frames review.html itself, so the cancel handler's own
  // finish(false) and the foundkeep-save-review-changed broadcast it
  // triggers (observed by review.js's own listener, which also tries to
  // finish once it sees the draft is gone) both have a chance to post; only
  // one "done" message must actually reach the parent.
  await web.evaluate(url => {
    window.__doneMessages = [];
    window.addEventListener('message', event => {
      if (event.data?.foundkeepReview && event.data.type === 'done') window.__doneMessages.push(event.data);
    });
    const frame = document.createElement('iframe');
    frame.id = 'reviewFrame';
    frame.src = url;
    document.body.append(frame);
  }, reviewUrl);
  const frame = web.frameLocator('#reviewFrame');
  await frame.locator('#reviewForm[data-ready="true"]').waitFor();
  await frame.locator('#reviewCancel').click();
  await pollUntil(web, () => window.__doneMessages.length > 0, null);
  // Give a spurious second post (from the foundkeep-save-review-changed
  // broadcast cancelSaveReview itself emits, which review.js's own listener
  // also reacts to) a chance to arrive before asserting exactly one.
  await web.waitForTimeout(500);
  assert.equal(await web.evaluate(() => window.__doneMessages.length), 1, JSON.stringify(await web.evaluate(() => window.__doneMessages)));
  assert.equal(await web.evaluate(() => window.__doneMessages[0].saved), false);
});

test('review card: a collection destination shows the shared fields and label', { timeout: 30000 }, async t => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-review-collection-'); let context;
  t.after(async () => { await context?.close(); await rm(profile, { recursive: true, force: true }); });
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await context.route(origin + '/__review2', route => route.fulfill({ contentType: 'text/html', body: '<title>Review fixture 2</title>' }));
  const web = await context.newPage(); await web.goto(origin + '/__review2');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  const tabId = await ext.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__review2' }))[0].id);
  await ext.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' } }));
  await context.route('**/api/organization', route => route.fulfill({ json: { folders: [], tags: [], suggestedTags: [] } }));
  await context.route('**/api/collections', route => route.fulfill({ json: { collections: [{ id: 'col_1', title: 'Design refs', visibility: 'public', canSubmit: true, requireApproval: false, canModerate: true }] } }));
  await ext.evaluate(async id => (await import('./save-review.js')).stageSaveReview({ action: 'savepage', tab: await chrome.tabs.get(id), trigger: 'dock' }), tabId);
  const card = await frameReview(web, worker, tabId, 'cardFrame2');
  await card.waitForSelector('#reviewForm[data-ready="true"]');
  // <option> elements never report as "visible" to Playwright's default
  // actionability check, so wait for attachment rather than visibility.
  await card.waitForSelector('#saveDestination option[value="collection:col_1"]', { state: 'attached' });
  await card.selectOption('#saveDestination', 'collection:col_1');
  await card.dispatchEvent('#saveDestination', 'change');
  await card.waitForSelector('#destinationShare:not([hidden])');
  assert.equal(await card.$eval('#destinationConfirm', el => el.textContent), 'Save to collection');
});
