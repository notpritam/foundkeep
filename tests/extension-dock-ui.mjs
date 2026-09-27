import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from './helpers/dock-world.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const CONNECTED_STATE = {
  connected: true,
  actions: { savepage: true, highlight: true, region: true, fullpage: true, note: true },
  alwaysOn: false,
  hiddenHere: false,
  localOnly: 0,
  show: false,
};

test('dock: collapsed pill, expand, keyboard, drag and position memory, page scripts cannot drive it', { timeout: 45000 }, async t => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-dock-ui-'); let context;
  t.after(async () => { await context?.close(); await rm(profile, { recursive: true, force: true }); });
  // R7: headless-shell (the Playwright default) cannot load extensions; the
  // chromium channel is required.
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    viewport: { width: 1200, height: 800 }, args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await context.route(origin + '/__dock*', route => route.fulfill({ contentType: 'text/html', body: '<title>Dock fixture</title><p style="height:3000px">Long page</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__dock');
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: '*://*/__dock' }))[0].id);
  // Task 4 wires the real background summon path; here the test injects the
  // dock directly and feeds it a dock-state (no background handler yet for
  // dock-hello, so dockState would otherwise stay null and connected false).
  await worker.evaluate(async ({ id, state }) => {
    await chrome.scripting.executeScript({ target: { tabId: id }, files: ['src/dock/dock.js'] });
    await chrome.tabs.sendMessage(id, { kind: 'dock-show' });
    await chrome.tabs.sendMessage(id, { kind: 'dock-state', state });
  }, { id: tabId, state: CONNECTED_STATE });
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  // Closed shadow root: the page sees an opaque element and cannot open it.
  assert.equal(await web.evaluate(() => document.querySelector('foundkeep-dock')?.shadowRoot ?? null), null);
  await web.evaluate(() => document.querySelector('foundkeep-dock').click());
  assert.equal(await dock.evaluate(`__foundkeepDock.state()`), 'collapsed', 'a synthetic click must not expand the dock');
  // R10: the dock must never read chrome.storage itself — the background
  // (protectCloudStorage) keeps storage.local at TRUSTED_CONTEXTS so
  // account credentials never reach a content script; the dock's own
  // position persistence goes through the dock-position message instead.
  assert.equal(await dock.evaluate(`chrome.storage.local.get(null).then(() => 'readable', () => 'blocked')`), 'blocked');
  // Default bottom-right, 16px from the edges. R4: measure the .dock rect,
  // not .pill — the pill sits inside the dock's 1px border + 2px padding.
  const dockRect = await dock.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.equal(Math.round(1200 - (dockRect.x + dockRect.width)), 16); assert.equal(Math.round(800 - (dockRect.y + dockRect.height)), 16);
  await dock.click('.pill');
  await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  for (const action of ['savepage', 'highlight', 'screenshot', 'note', 'library', 'more'])
    assert.ok(await dock.evaluate(`!!__foundkeepDock.rect('[data-action="${action}"]').width`), action);
  // R1: the toolbar icon toggles the dock. Sending dock-show with
  // toggle:true while expanded collapses it (never while review).
  await worker.evaluate(async id => { await chrome.tabs.sendMessage(id, { kind: 'dock-show', expand: true, toggle: true }); }, tabId);
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  // R1 negative case: the toggle must never collapse a dock that is
  // mid-review. (The review card has no draft staged for this tab, so it
  // may render "no draft" content — that's fine for this assertion.)
  const reviewUrl = await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), tabId);
  await worker.evaluate(async ({ id, url }) => { await chrome.tabs.sendMessage(id, { kind: 'dock-review-open', url }); }, { id: tabId, url: reviewUrl });
  await dock.waitFor(`__foundkeepDock.state() === 'review'`);
  await worker.evaluate(async id => { await chrome.tabs.sendMessage(id, { kind: 'dock-show', expand: true, toggle: true }); }, tabId);
  assert.equal(await dock.evaluate(`__foundkeepDock.state()`), 'review', 'toggle must not collapse a dock mid-review');
  await worker.evaluate(async id => { await chrome.tabs.sendMessage(id, { kind: 'dock-review-close', saved: false }); }, tabId);
  await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  // Keyboard: Escape collapses and returns focus to the pill.
  await web.keyboard.press('Escape');
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  assert.equal(await dock.evaluate(`__foundkeepDock.focused()`), 'pill', 'Escape returns focus to the pill');
  // Tab reaches every toolbar control in order.
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  const reached = [];
  for (let i = 0; i < 7; i++) { await web.keyboard.press('Tab'); reached.push(await dock.evaluate(`__foundkeepDock.focused()`)); }
  for (const action of ['savepage', 'highlight', 'screenshot', 'note', 'library', 'more']) assert.ok(reached.includes(action), `Tab reaches ${action}: ${reached}`);
  await web.keyboard.press('Escape'); await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  // Drag by the grip, then reload and summon again: the position is remembered.
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  const grip = await dock.evaluate(`__foundkeepDock.rect('.grip')`);
  await web.mouse.move(grip.x + 5, grip.y + 5); await web.mouse.down(); await web.mouse.move(300, 200, { steps: 8 }); await web.mouse.up();
  const moved = await dock.evaluate(`__foundkeepDock.position()`);
  assert.ok(moved.left < 400 && moved.top < 300, JSON.stringify(moved));
  // Arrow keys move 16px, Shift+Arrow 64px, Home resets.
  await dock.click('.grip'); await web.keyboard.press('ArrowRight');
  assert.equal((await dock.evaluate(`__foundkeepDock.position()`)).left, moved.left + 16);
  await web.keyboard.press('Shift+ArrowDown');
  assert.equal((await dock.evaluate(`__foundkeepDock.position()`)).top, moved.top + 64);
  await web.reload();
  await worker.evaluate(async ({ id, state }) => {
    await chrome.scripting.executeScript({ target: { tabId: id }, files: ['src/dock/dock.js'] });
    await chrome.tabs.sendMessage(id, { kind: 'dock-show' });
    await chrome.tabs.sendMessage(id, { kind: 'dock-state', state });
  }, { id: tabId, state: CONNECTED_STATE });
  const again = await dockWorld(web, extensionId); await again.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  const kept = await again.evaluate(`__foundkeepDock.position()`);
  assert.equal(kept.left, moved.left + 16); assert.equal(kept.top, moved.top + 64);
  await again.click('.pill'); await again.click('.grip'); await web.keyboard.press('Home');
  const reset = await again.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.equal(Math.round(1200 - (reset.x + reset.width)), 16);
  // Resizing the window keeps the dock inside the viewport. The resize
  // handler runs on the next event-loop turn after Playwright applies the
  // new viewport, so wait for the clamp rather than reading the rect
  // immediately (R9: poll through the dock world instead of a raw
  // page.waitForFunction, which never awaits an async predicate anyway).
  await web.setViewportSize({ width: 500, height: 400 });
  await again.waitFor(`(() => { const r = __foundkeepDock.rect('.dock'); return r.x >= 0 && r.x + r.width <= 500 && r.y + r.height <= 400; })()`);
  const clamped = await again.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.ok(clamped.x >= 0 && clamped.x + clamped.width <= 500 && clamped.y + clamped.height <= 400, JSON.stringify(clamped));
});
