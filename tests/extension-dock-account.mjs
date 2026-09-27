import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from './helpers/dock-world.mjs';
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
  assert.equal(await dock.evaluate(`__foundkeepDock.text('.local .status')`), '1 saves are only in this browser');

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
  assert.equal(captures.length, 1);
  assert.equal(captures[0].cloudAccountId, 'account-a');
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
