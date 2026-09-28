import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from './helpers/dock-world.mjs';
import { pollUntil } from './helpers/poll.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const SIGNED_IN = { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' };

// R7: headless-shell (the Playwright default) cannot load extensions; the
// chromium channel is required.
async function launch(t) {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-dock-account-');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  t.after(async () => { await context.close(); await rm(profile, { recursive: true, force: true }); });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  return { context, worker, extensionId, origin };
}

async function signIn(context, worker) {
  await worker.evaluate(state => chrome.storage.local.set({ atlasCustomer: state }), SIGNED_IN);
  // The move flow's importLocalCaptures fires a fire-and-forget drainQueue()
  // upload; route it so the test never depends on real network.
  await context.route('**/api/captures', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ capture: { id: 'remote-1', status: 'done' } }) }));
}

// dock-control.js is a plain module and works outside the worker; tests
// drive summonDock from an extension page since they cannot click the
// toolbar icon themselves.
function summon(ext, url, opts = { expand: true }) {
  return ext.evaluate(async ({ url, opts }) => {
    const [tab] = await chrome.tabs.query({ url });
    return (await import('./dock-control.js')).summonDock(tab.id, opts);
  }, { url, opts });
}

test('dock: signed out shows only "Sign in to save", which opens the login page', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await context.route(origin + '/login', r => r.fulfill({ contentType: 'text/html', body: '<title>Login fixture</title>' }));
  await context.route(origin + '/__account-signed-out', r => r.fulfill({ contentType: 'text/html', body: '<title>Signed-out fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__account-signed-out');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__account-signed-out*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");

  assert.equal((await dock.evaluate(`__foundkeepDock.rect('.actions')`)).height, 0, 'actions must stay hidden while signed out');
  assert.ok((await dock.evaluate(`__foundkeepDock.rect('[data-action="sign-in"]')`)).height > 0, 'the sign-in button must be visible');
  assert.equal((await dock.evaluate(`__foundkeepDock.rect('.waiting')`)).height, 0, 'no waiting-saves line without local saves');

  const loginPromise = context.waitForEvent('page', { timeout: 10000 });
  await dock.click('[data-action="sign-in"]');
  const login = await loginPromise;
  await login.waitForLoadState('domcontentloaded');
  assert.equal(login.url(), origin + '/login');
});

test('dock: local-only saves prompt to move into the account, or wait a week', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  // Seeded before sign-in: a capture with no cloudAccountId is "local-only".
  await ext.evaluate(() => import('./db.js').then(db => db.addCapture({ type: 'note', noteText: 'old local', createdAt: Date.now() })));
  await signIn(context, worker);

  await context.route(origin + '/__account-local', r => r.fulfill({ contentType: 'text/html', body: '<title>Local fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__account-local');

  assert.equal(await summon(ext, origin + '/__account-local*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.waitFor(`__foundkeepDock.rect('.local').height > 0`);
  // M5: singular and plural.
  assert.equal(await dock.evaluate(`__foundkeepDock.text('.local .status')`), '1 save is only in this browser');
  await ext.evaluate(() => import('./db.js').then(db => db.addCapture({ type: 'note', noteText: 'second local', createdAt: Date.now() })));
  assert.equal(await summon(ext, origin + '/__account-local*'), true);
  await dock.waitFor(`__foundkeepDock.text('.local .status') === '2 saves are only in this browser'`);

  await dock.click('[data-action="local-later"]');
  await dock.waitFor(`__foundkeepDock.rect('.local').height === 0`);
  const afterLater = await worker.evaluate(() => chrome.storage.local.get('foundkeep-dock-local-prompt'));
  const laterUntil = afterLater['foundkeep-dock-local-prompt']?.laterUntil || 0;
  assert.ok(Math.abs(laterUntil - (Date.now() + 7 * 86_400_000)) < 15_000, `laterUntil must be about 7 days ahead, got ${laterUntil}`);

  // Fast-forward past the "later" window and re-summon: the prompt returns.
  await worker.evaluate(() => chrome.storage.local.set({ 'foundkeep-dock-local-prompt': { laterUntil: 0 } }));
  assert.equal(await summon(ext, origin + '/__account-local*'), true);
  await dock.waitFor(`__foundkeepDock.rect('.local').height > 0`);

  await dock.click('[data-action="local-move"]');
  await dock.waitFor(`__foundkeepDock.rect('.local').height === 0`);
  const captures = await ext.evaluate(() => import('./db.js').then(db => db.listCaptures()));
  assert.equal(captures.length, 2);
  assert.ok(captures.every(capture => capture.cloudAccountId === 'account-a'));
});

// I5: 1.7.12 let signed-out users save locally. After upgrading they only
// see "Sign in to save" — tell them those saves exist and are waiting.
test('dock: signed out with local saves, the dock says they are waiting above "Sign in to save" (I5)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  await ext.evaluate(() => import('./db.js').then(db => db.addCapture({ type: 'note', noteText: 'saved in 1.7.12 without an account' })));
  await context.route(origin + '/__account-waiting', r => r.fulfill({ contentType: 'text/html', body: '<title>Waiting fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__account-waiting');

  assert.equal(await summon(ext, origin + '/__account-waiting*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.waitFor(`__foundkeepDock.rect('.waiting').height > 0`);
  assert.equal(await dock.evaluate(`__foundkeepDock.text('.waiting')`), '1 save from this browser is waiting — sign in to keep it');
  const waiting = await dock.evaluate(`__foundkeepDock.rect('.waiting')`);
  const signInButton = await dock.evaluate(`__foundkeepDock.rect('[data-action="sign-in"]')`);
  assert.ok(signInButton.height > 0, 'the sign-in button is still there');
  assert.ok(waiting.y + waiting.height <= signInButton.y + 1, `the line sits above "Sign in to save": ${JSON.stringify({ waiting, signInButton })}`);
  assert.equal((await dock.evaluate(`__foundkeepDock.rect('.actions')`)).height, 0);

  await ext.evaluate(() => import('./db.js').then(db => db.addCapture({ type: 'note', noteText: 'another one' })));
  assert.equal(await summon(ext, origin + '/__account-waiting*'), true);
  await dock.waitFor(`__foundkeepDock.text('.waiting') === '2 saves from this browser are waiting — sign in to keep them'`);
});

test('dock: the ⋯ menu opens the standalone import page', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__account-import', r => r.fulfill({ contentType: 'text/html', body: '<title>Import-menu fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__account-import');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__account-import*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");

  const importPagePromise = context.waitForEvent('page', { timeout: 10000 });
  await dock.click('[data-action="more"]');
  await dock.click('[data-action="import"]');
  const importPage = await importPagePromise;
  await importPage.waitForLoadState('domcontentloaded');
  assert.match(importPage.url(), /\/src\/import\.html$/);

  assert.match(await importPage.locator('h2').first().textContent(), /Bring your collection\./);
  await importPage.evaluate(() => {
    window.__permissionRequests = [];
    chrome.permissions.request = (opts) => { window.__permissionRequests.push(opts); return Promise.resolve(false); };
  });
  await importPage.click('#readBrowser');
  await importPage.waitForFunction(() => window.__permissionRequests.length > 0);
  assert.deepEqual(await importPage.evaluate(() => window.__permissionRequests), [{ permissions: ['bookmarks'] }]);
});

test('dock: an external atlas-open-import message from foundkeep.app opens the import page', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await context.route(origin + '/__ext', r => r.fulfill({ contentType: 'text/html', body: '<title>External fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__ext');

  const importPagePromise = context.waitForEvent('page', { timeout: 10000 });
  const result = await web.evaluate(extensionId => new Promise(resolve => chrome.runtime.sendMessage(extensionId, { kind: 'atlas-open-import' }, resolve)), extensionId);
  assert.equal(result.ok, true);
  const importPage = await importPagePromise;
  await importPage.waitForLoadState('domcontentloaded');
  assert.match(importPage.url(), /\/src\/import\.html$/);
});

// I3 / R15: 1.7.x's side panel staged captures with provenance.captureMethod
// 'sidebar-*', which the backend's METHODS allowlist rejects (400
// invalid_capture_context -> permanently failed). On update, 1.8 rewrites
// them to the equivalent 'popup-*' method and requeues the unsynced ones.
test('dock: an update migrates stranded 1.7.x sidebar-* captures to popup-* and requeues them (I3)', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  const provenance = method => ({ schemaVersion: 1, captureMethod: method, pageUrl: 'https://example.com/', canonicalUrl: null, pageTitle: 'Example', siteName: null, description: null, authors: [], publishedAt: null, modifiedAt: null, language: null, leadImageUrl: null, faviconUrl: null, targetUrl: null, headings: [], capturedAt: 1, extractedAt: 1, extractorVersion: 1, contentHash: null, extractionStatus: 'complete', extractionError: null });
  await ext.evaluate(async ({ failed, synced, local, other }) => {
    const db = await import('./db.js');
    await db.addCapture({ type: 'bookmark', sourceUrl: 'https://example.com/', cloudAccountId: 'account-a', provenance: failed }, { id: 'cap_failed' });
    await db.updateCapture('cap_failed', { cloudStatus: 'failed', cloudAttempts: 3, cloudError: 'captureMethod is not supported.', cloudNextRetryAt: Date.now() + 3_600_000 });
    await db.addCapture({ type: 'screenshot', sourceUrl: 'https://example.com/', cloudAccountId: 'account-a', provenance: synced }, { id: 'cap_synced' });
    await db.updateCapture('cap_synced', { cloudStatus: 'synced' });
    await db.addCapture({ type: 'highlight', sourceUrl: 'https://example.com/', provenance: local }, { id: 'cap_local' });
    await db.addCapture({ type: 'bookmark', sourceUrl: 'https://example.com/', cloudAccountId: 'account-a', provenance: other }, { id: 'cap_other' });
    await db.updateCapture('cap_other', { cloudStatus: 'failed', cloudAttempts: 2, cloudError: 'Something else.' });
  }, { failed: provenance('sidebar-save-page'), synced: provenance('sidebar-region'), local: provenance('sidebar-highlight'), other: provenance('popup-full-page') });
  const read = () => ext.evaluate(async () => Object.fromEntries((await (await import('./db.js')).listCaptures()).map(c => [c.id, {
    method: c.provenance.captureMethod, cloudStatus: c.cloudStatus, cloudAttempts: c.cloudAttempts, cloudError: c.cloudError, cloudNextRetryAt: c.cloudNextRetryAt, updatedAt: c.updatedAt }])));

  const first = await ext.evaluate(async () => (await import('./cloud.js')).migrateSidebarCaptures());
  assert.deepEqual(first, { rewritten: 3, requeued: 1 });
  const after = await read();
  assert.deepEqual({ ...after.cap_failed, updatedAt: 0 }, { method: 'popup-save-page', cloudStatus: 'queued', cloudAttempts: 0, cloudError: null, cloudNextRetryAt: 0, updatedAt: 0 });
  assert.equal(after.cap_synced.method, 'popup-region');
  assert.equal(after.cap_synced.cloudStatus, 'synced', 'an already-synced record is not requeued');
  assert.equal(after.cap_local.method, 'popup-highlight');
  assert.equal(after.cap_local.cloudStatus, 'local', 'a local-only record stays local');
  assert.equal(after.cap_other.method, 'popup-full-page');
  assert.equal(after.cap_other.cloudStatus, 'failed', 'records that never used a sidebar-* method are untouched');

  // Idempotent: a second run (another update, or a restart mid-update)
  // changes nothing more.
  const second = await ext.evaluate(async () => (await import('./cloud.js')).migrateSidebarCaptures());
  assert.deepEqual(second, { rewritten: 0, requeued: 0 });
  assert.deepEqual(await read(), after);

  // And the requeued record now uploads with a method the backend accepts.
  const uploads = [];
  await signIn(context, worker);
  await context.route('**/api/captures', r => { uploads.push(r.request().postDataJSON()); return r.fulfill({ json: { capture: { id: 'remote-1', status: 'done' } } }); });
  await ext.evaluate(async () => (await import('./capture.js')).drainQueue());
  assert.deepEqual(uploads.map(u => [u.clientId, u.provenance.captureMethod]), [['cap_failed', 'popup-save-page']]);
});

// I4: the dashboard shows "Import from this browser" only for an extension
// that says it can open the import page — released builds (store 1.0.2,
// friends 1.7.x) answer atlas-ping without it and don't handle
// atlas-open-import. A feature flag, not a version comparison.
test('dock: atlas-ping advertises the open-import feature to foundkeep.app (I4)', { timeout: 30000 }, async t => {
  const { context, extensionId, origin } = await launch(t);
  await context.route(origin + '/__ping', r => r.fulfill({ contentType: 'text/html', body: '<title>Ping fixture</title>' }));
  const web = await context.newPage(); await web.goto(origin + '/__ping');
  const result = await web.evaluate(extensionId => new Promise(resolve => chrome.runtime.sendMessage(extensionId, { kind: 'atlas-ping' }, resolve)), extensionId);
  assert.equal(result.ok, true);
  assert.deepEqual(result.features, ['open-import']);
});

// M7: a failing chrome.tabs.create must answer the site right away instead
// of leaving it waiting out its 15 s timeout.
test('dock: atlas-open-import answers {ok:false} when the import tab cannot open (M7)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await context.route(origin + '/__ext-fail', r => r.fulfill({ contentType: 'text/html', body: '<title>External fixture</title>' }));
  const web = await context.newPage(); await web.goto(origin + '/__ext-fail');
  await worker.evaluate(() => { chrome.tabs.create = () => Promise.reject(new Error('No window is available.')); });
  const started = Date.now();
  const result = await web.evaluate(extensionId => Promise.race([
    new Promise(resolve => chrome.runtime.sendMessage(extensionId, { kind: 'atlas-open-import' }, resolve)),
    new Promise(resolve => setTimeout(() => resolve('no answer within 5 s'), 5000)),
  ]), extensionId);
  assert.deepEqual(result, { ok: false, error: 'FoundKeep could not open the import page. Try again.' });
  assert.ok(Date.now() - started < 5000);
});

// M6: import-preview needs an account (cloud.js refuses it without one), so
// the signed-out import page must not promise a preview or offer one.
test('dock: the import page asks a signed-out user to sign in first and offers no preview until then (M6)', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  const page = await context.newPage(); await page.goto(await worker.evaluate(() => chrome.runtime.getURL('src/import.html')));
  await page.waitForSelector('#connect:not([hidden])');
  const copy = await page.locator('#connect').textContent();
  assert.doesNotMatch(copy, /preview/i, 'the signed-out copy must not promise a preview');
  assert.match(copy, /Sign in to FoundKeep first/);
  await pollUntil(page, () => document.querySelector('#readBrowser').disabled && document.querySelector('#importFile').disabled && document.querySelector('#importSource').disabled, null);

  // Signed in (and the page refreshed on focus/atlas-changed): preview is available.
  await worker.evaluate(state => chrome.storage.local.set({ atlasCustomer: state }), SIGNED_IN);
  await page.reload();
  await page.waitForSelector('#connect[hidden]', { state: 'attached' });
  await pollUntil(page, () => !document.querySelector('#readBrowser').disabled && !document.querySelector('#importFile').disabled && !document.querySelector('#importSource').disabled, null);
});
