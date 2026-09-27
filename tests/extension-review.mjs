import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

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
  await ext.evaluate(async id => (await import('./save-review.js')).stageSaveReview({ action: 'note', tab: await chrome.tabs.get(id), text: '', trigger: 'dock' }), tabId);
  const card = await context.newPage(); await card.goto(await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), tabId));
  await card.waitForSelector('#reviewForm[data-ready="true"]');
  assert.deepEqual(await card.$$eval('#saveDestination option', options => options.map(o => o.value)), ['library']);
  assert.equal(await card.getAttribute('#reviewNote', 'required'), '');
  // Unframed, the card calls window.close() on itself; whether Chrome honors
  // that for a plain, script-unopened tab is implementation-defined (and
  // observably flaky under concurrent automated browser processes), so
  // observe the cleared draft from the still-open extension page instead of
  // depending on the card tab actually disappearing.
  await card.click('#reviewCancel');
  await ext.waitForFunction(async id => !(await (await import('./save-review.js')).readSaveReview(id)), tabId);
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
  const card = await context.newPage(); await card.goto(await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), tabId));
  await card.waitForSelector('#reviewForm[data-ready="true"]');
  // <option> elements never report as "visible" to Playwright's default
  // actionability check, so wait for attachment rather than visibility.
  await card.waitForSelector('#saveDestination option[value="collection:col_1"]', { state: 'attached' });
  await card.selectOption('#saveDestination', 'collection:col_1');
  await card.dispatchEvent('#saveDestination', 'change');
  await card.waitForSelector('#destinationShare:not([hidden])');
  assert.equal(await card.$eval('#destinationConfirm', el => el.textContent), 'Save to collection');
});
