import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from './helpers/dock-world.mjs';
import { pollUntil } from './helpers/poll.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

// R7: headless-shell (the Playwright default) cannot load extensions; the
// chromium channel is required.
async function launch(t) {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-dock-always-on-');
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

test('dock: opt-in "show on every site" registers a content script, and per-site hiding survives a reload', { timeout: 45000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  // The ⋯ menu (and everything else in .actions, including the "more"
  // button itself) only renders once dockState.connected is true.
  await worker.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' } }));

  // Step 1: in the default test profile <all_urls> is not granted, so
  // applyAlwaysOn(true) must refuse and store false.
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  const firstAttempt = await ext.evaluate(async () => (await import('./dock-control.js')).applyAlwaysOn(true));
  assert.equal(firstAttempt, false, 'applyAlwaysOn(true) without the <all_urls> permission must return false');
  const registeredBeforeGrant = await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts({ ids: ['foundkeep-dock'] }));
  assert.equal(registeredBeforeGrant.length, 0);

  // Step 2: dock-settings.html is where a content script cannot request
  // permissions itself — stub the permission dance there and flip it on.
  const settings = await context.newPage();
  await settings.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  await settings.evaluate(() => {
    chrome.permissions.request = async () => true;
    chrome.permissions.contains = async () => true;
  });
  await settings.click('#enable');
  await pollUntil(worker, async () => {
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['foundkeep-dock'] });
    return scripts.length === 1;
  }, null);
  const registered = await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts({ ids: ['foundkeep-dock'] }));
  assert.equal(registered.length, 1);
  assert.equal(registered[0].id, 'foundkeep-dock');
  assert.deepEqual(registered[0].matches, ['http://*/*', 'https://*/*']);
  await settings.close();

  // Step 3: a fresh page on the host-permitted origin picks up the dock on
  // its own, collapsed, without anything summoning it.
  await context.route(origin + '/__always-on', r => r.fulfill({ contentType: 'text/html', body: '<title>Always-on fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__always-on');
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'collapsed'");

  // Step 4: "Hide on this site" from the ⋯ menu makes the dock disappear,
  // and it stays hidden across a reload.
  await dock.click('.pill');
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.click('[data-action="more"]');
  await dock.click('[data-action="site"]');
  await dock.waitFor("__foundkeepDock.state() === 'hidden'");
  await web.reload();
  const dockAfterReload = await dockWorld(web, extensionId);
  await new Promise(r => setTimeout(r, 500));
  assert.equal(await dockAfterReload.evaluate('__foundkeepDock.state()'), 'hidden', 'a hidden site must stay hidden after a reload');

  // Step 5: summoning it directly still shows it, and the menu now offers to
  // show it again on this site.
  const tabId = await worker.evaluate(async origin => (await chrome.tabs.query({ url: origin + '/__always-on*' }))[0].id, origin);
  const ext2 = await context.newPage(); await ext2.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  await ext2.evaluate(tabId => import('./dock-control.js').then(m => m.summonDock(tabId, { expand: true })), tabId);
  await dockAfterReload.waitFor("__foundkeepDock.state() === 'expanded'");
  await dockAfterReload.click('[data-action="more"]');
  assert.equal(await dockAfterReload.evaluate(`__foundkeepDock.text('[data-action="site"]')`), 'Show on this site again');
  await dockAfterReload.click('[data-action="site"]');
  await dockAfterReload.waitFor("__foundkeepDock.state() !== 'hidden'");
  // Unhiding round-trips through the background (dock-site -> storage ->
  // refreshState's own dock-state push) before the menu label updates, so
  // wait for that rather than asserting immediately after the click.
  await dockAfterReload.waitFor(`__foundkeepDock.text('[data-action="site"]') === 'Hide on this site'`);

  // Step 6: turning always-on off from the dock's own menu unregisters the
  // content script.
  await dockAfterReload.click('[data-action="more"]');
  await dockAfterReload.click('[data-action="always-on"]');
  await pollUntil(worker, async () => {
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: ['foundkeep-dock'] });
    return scripts.length === 0;
  }, null);
  const afterOff = await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts({ ids: ['foundkeep-dock'] }));
  assert.equal(afterOff.length, 0);
});
