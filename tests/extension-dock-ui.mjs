import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from './helpers/dock-world.mjs';
import { pollUntil } from './helpers/poll.mjs';
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
  // Task 4 wires the real background summon path, including a dock-hello
  // handler that computes and returns a real dockState — dock.js's own init
  // fires dock-hello as soon as it loads, racing the explicit dock-state
  // this test sends below. Signing in here makes that real state agree with
  // CONNECTED_STATE regardless of which response dock.js applies last.
  await worker.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' } }));
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
  // Screenshot goes straight to region selection: no Region / Full page popover.
  assert.equal(await dock.evaluate(`__foundkeepDock.rect('[data-menu="screenshot"]').height`), 0);
  assert.equal(await dock.evaluate(`__foundkeepDock.attr('[data-action="screenshot"]', 'aria-haspopup')`), null);
  // R1: the toolbar icon toggles the dock. Sending dock-show with
  // toggle:true while expanded collapses it.
  await worker.evaluate(async id => { await chrome.tabs.sendMessage(id, { kind: 'dock-show', expand: true, toggle: true }); }, tabId);
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  // (R1 negative case — the toggle never collapses a dock whose details card
  // is open — lives in tests/extension-review.mjs, which opens a real card.)
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
  // Design review (scripts/design/dock-review.mjs) copies the shadow root
  // through the isolated-world handle — stylesheet and markup, keyboard focus
  // marked — while the page still cannot reach the handle.
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  await web.keyboard.press('Tab');
  const snapshot = await dock.evaluate(`__foundkeepDock.snapshot()`);
  assert.match(snapshot.css, /\.dock\{position:fixed/);
  assert.match(snapshot.html, /<button data-action="savepage"[^>]*data-fk-focus-visible/);
  assert.doesNotMatch(snapshot.html, /<style/);
  assert.deepEqual(snapshot.viewport, { width: 1200, height: 800 });
  assert.ok(snapshot.boxes.some(box => box.width > 200), JSON.stringify(snapshot.boxes));
  assert.equal(await web.evaluate(() => typeof window.__foundkeepDock), 'undefined', 'the page cannot see the handle');
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
  // A drag ending outside the viewport must persist where the dock actually
  // landed (the clamped edge, flush with 0 margin) rather than an
  // out-of-range fraction the background's dock-position handler rejects —
  // which would otherwise silently fall back to the default position (with
  // its 16px margin) on the next reload. Collapse first: the expanded dock
  // is much wider, so "flush with the edge" is only comparable across the
  // drag and the reload check below when both read the same (collapsed) width.
  await again.click('.pill'); await again.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  const edgeGrip = await again.evaluate(`__foundkeepDock.rect('.grip')`);
  await web.mouse.move(edgeGrip.x + 5, edgeGrip.y + 5); await web.mouse.down();
  await web.mouse.move(5000, 400, { steps: 8 }); await web.mouse.up();
  const draggedToEdge = await again.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.equal(Math.round(1200 - (draggedToEdge.x + draggedToEdge.width)), 0, 'dragging past the right edge clamps flush to it: ' + JSON.stringify(draggedToEdge));
  // setPosition's persist message is fire-and-forget from the dock's side;
  // wait for it to actually land in storage before reloading, or the reload
  // can race ahead of it and observe the previous (or default) position.
  await pollUntil(worker, async () => {
    const stored = (await chrome.storage.local.get('foundkeep-dock-position'))['foundkeep-dock-position'];
    return !!stored && stored.fx > 0.9;
  }, null);
  await web.reload();
  await worker.evaluate(async ({ id, state }) => {
    await chrome.scripting.executeScript({ target: { tabId: id }, files: ['src/dock/dock.js'] });
    await chrome.tabs.sendMessage(id, { kind: 'dock-show' });
    await chrome.tabs.sendMessage(id, { kind: 'dock-state', state });
  }, { id: tabId, state: CONNECTED_STATE });
  const afterEdgeDrag = await dockWorld(web, extensionId);
  await afterEdgeDrag.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  const persistedEdge = await afterEdgeDrag.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.equal(Math.round(1200 - (persistedEdge.x + persistedEdge.width)), 0, 'the clamped edge position, not the default, survives a reload: ' + JSON.stringify(persistedEdge));
  // Resizing the window keeps the dock inside the viewport. The resize
  // handler runs on the next event-loop turn after Playwright applies the
  // new viewport, so wait for the clamp rather than reading the rect
  // immediately (R9: poll through the dock world instead of a raw
  // page.waitForFunction, which never awaits an async predicate anyway).
  await web.setViewportSize({ width: 500, height: 400 });
  await afterEdgeDrag.waitFor(`(() => { const r = __foundkeepDock.rect('.dock'); return r.x >= 0 && r.x + r.width <= 500 && r.y + r.height <= 400; })()`);
  const clamped = await afterEdgeDrag.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.ok(clamped.x >= 0 && clamped.x + clamped.width <= 500 && clamped.y + clamped.height <= 400, JSON.stringify(clamped));
});
