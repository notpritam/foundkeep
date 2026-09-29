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

test('dock: bookmark tab, icon-only toolbar with tooltips, keyboard, drag and position memory, page scripts cannot drive it', { timeout: 45000 }, async t => {
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
  // account credentials never reach a content script.
  assert.equal(await dock.evaluate(`chrome.storage.local.get(null).then(() => 'readable', () => 'blocked')`), 'blocked');
  // Collapsed: a bookmark tab at the bottom-right, 16px from the right edge,
  // tucked into the bottom edge (it slides up into place and rests 5px
  // below it). No drag grip.
  await dock.waitFor(`(() => { const r = __foundkeepDock.rect('.dock'); return Math.round(r.y + r.height) === 805; })()`);
  const tab = await dock.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.equal(Math.round(1200 - (tab.x + tab.width)), 16);
  assert.ok(tab.y < 800 && tab.y + tab.height > 800, 'the tab sits in the bottom edge: ' + JSON.stringify(tab));
  assert.doesNotMatch((await dock.evaluate(`__foundkeepDock.snapshot()`)).html, /grip/);
  // Hovering the tab lifts it flush with the edge.
  const pill = await dock.evaluate(`__foundkeepDock.rect('.pill')`);
  await web.mouse.move(pill.x + pill.width / 2, pill.y + 8);
  await dock.waitFor(`(() => { const r = __foundkeepDock.rect('.dock'); return Math.round(r.y + r.height) === 800; })()`);
  await dock.click('.pill');
  await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  // Open: an icon-only toolbar 16px from the corner, without the tab's mark.
  await web.mouse.move(200, 200);
  await dock.waitFor(`(() => { const r = __foundkeepDock.rect('.dock'); return Math.round(800 - (r.y + r.height)) === 16; })()`);
  const bar = await dock.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.equal(Math.round(1200 - (bar.x + bar.width)), 16);
  assert.equal(await dock.evaluate(`__foundkeepDock.rect('.pill').width`), 0, 'no bookmark mark beside Save page');
  for (const action of ['savepage', 'highlight', 'screenshot', 'note', 'library', 'more']) {
    assert.ok(await dock.evaluate(`!!__foundkeepDock.rect('[data-action="${action}"]').width`), action);
    assert.equal((await dock.evaluate(`__foundkeepDock.text('[data-action="${action}"]')`)).trim(), '', `${action} is icon-only`);
    assert.ok(await dock.evaluate(`__foundkeepDock.attr('[data-action="${action}"]', 'aria-label')`), `${action} is named`);
  }
  // Hovering an icon shows what it does, above it; moving along the toolbar
  // switches at once; moving away hides it.
  const tipShown = `__foundkeepDock.rect('.tip').width > 0`;
  const hoverAction = async action => { const r = await dock.evaluate(`__foundkeepDock.rect('[data-action="${action}"]')`); await web.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 3 }); return r; };
  const highlightRect = await hoverAction('highlight');
  await dock.waitFor(tipShown, 2000);
  assert.equal(await dock.evaluate(`__foundkeepDock.text('.tip')`), 'Highlight text to save it');
  const tip = await dock.evaluate(`__foundkeepDock.rect('.tip')`);
  assert.ok(tip.y + tip.height <= highlightRect.y, 'the tooltip sits above the icon');
  await hoverAction('library');
  await dock.waitFor(`__foundkeepDock.text('.tip') === 'Open your library' && ${tipShown}`, 300);
  await web.mouse.move(200, 200);
  await dock.waitFor(`!(${tipShown})`, 1000);
  // ⋯ looks pressed while its menu is open.
  await dock.click('[data-action="more"]');
  assert.equal(await dock.evaluate(`__foundkeepDock.attr('[data-action="more"]', 'aria-expanded')`), 'true');
  assert.ok(await dock.evaluate(`__foundkeepDock.rect('[data-menu="more"]').height > 0`));
  await dock.click('[data-action="more"]');
  assert.equal(await dock.evaluate(`__foundkeepDock.attr('[data-action="more"]', 'aria-expanded')`), 'false');
  await web.mouse.move(200, 200);
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
  // Keyboard: Escape collapses and returns focus to the tab. (The mouse is
  // parked away first: the toolbar slides through wherever the tab was.)
  await web.mouse.move(200, 200);
  await web.keyboard.press('Escape');
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  assert.equal(await dock.evaluate(`__foundkeepDock.focused()`), 'pill', 'Escape returns focus to the tab');
  // Enter on the tab opens the toolbar with focus on its first control,
  // whose tooltip shows at once; Tab reaches every other control.
  await web.keyboard.press('Enter');
  await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  await dock.waitFor(`__foundkeepDock.focused() === 'savepage'`);
  await dock.waitFor(`__foundkeepDock.text('.tip') === 'Save this page' && ${tipShown}`, 1000);
  // Design review (scripts/design/capture-extension.mjs) copies the shadow
  // root through the isolated-world handle — stylesheet and markup, keyboard
  // focus marked — while the page still cannot reach the handle.
  const snapshot = await dock.evaluate(`__foundkeepDock.snapshot()`);
  assert.match(snapshot.css, /\.dock\{position:fixed/);
  assert.match(snapshot.html, /<button data-action="savepage"[^>]*data-fk-focus-visible/);
  assert.doesNotMatch(snapshot.html, /<style/);
  assert.deepEqual(snapshot.viewport, { width: 1200, height: 800 });
  assert.ok(snapshot.boxes.some(box => box.width > 200), JSON.stringify(snapshot.boxes));
  assert.equal(await web.evaluate(() => typeof window.__foundkeepDock), 'undefined', 'the page cannot see the handle');
  const reached = [];
  for (let i = 0; i < 6; i++) { await web.keyboard.press('Tab'); reached.push(await dock.evaluate(`__foundkeepDock.focused()`)); }
  for (const action of ['highlight', 'screenshot', 'note', 'library', 'more']) assert.ok(reached.includes(action), `Tab reaches ${action}: ${reached}`);
  await web.keyboard.press('Escape'); await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  // Drag: press anywhere on the dock and move. Dragging the tab moves it
  // without opening it, and it floats where it is dropped.
  const dragBy = async (from, to) => { await web.mouse.move(from.x, from.y); await web.mouse.down(); await web.mouse.move(to.x, to.y, { steps: 10 }); await web.mouse.up(); };
  const centre = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  await dock.waitFor(`(() => { const r = __foundkeepDock.rect('.dock'); return Math.round(r.y + r.height) === 805; })()`);
  await dragBy(centre(await dock.evaluate(`__foundkeepDock.rect('.pill')`)), { x: 300, y: 200 });
  assert.equal(await dock.evaluate(`__foundkeepDock.state()`), 'collapsed', 'a drag is not a click');
  let floating = await dock.evaluate(`__foundkeepDock.position()`);
  assert.ok(floating.left <= 300 && 300 <= floating.right && floating.top <= 200 && 200 <= floating.bottom, 'it stays under the pointer: ' + JSON.stringify(floating));
  assert.deepEqual(await dock.evaluate(`(() => { const a = __foundkeepDock.anchor(); return [a.side, a.tucked]; })()`), ['left', false]);
  // Open, the toolbar grows from the tab's outer (left) side at its height,
  // and the ⋯ menu opens from that side.
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  await web.mouse.move(700, 600);
  await dock.waitFor(`__foundkeepDock.position().left === ${floating.left}`);
  const toolbar = await dock.evaluate(`__foundkeepDock.position()`);
  assert.ok(Math.abs((toolbar.top + toolbar.bottom) / 2 - (floating.top + floating.bottom) / 2) <= 1, JSON.stringify({ toolbar, floating }));
  await dock.click('[data-action="more"]');
  assert.ok(Math.abs((await dock.evaluate(`__foundkeepDock.rect('[data-menu="more"]')`)).x - toolbar.left) <= 2, 'the menu opens from the left');
  await dock.click('[data-action="more"]');
  // Dragging the toolbar by a button moves it and saves nothing; dropped
  // near the bottom edge it tucks back in (16px above the edge while open).
  await dragBy(centre(await dock.evaluate(`__foundkeepDock.rect('[data-action="savepage"]')`)), { x: 1000, y: 780 });
  assert.equal(await dock.evaluate(`__foundkeepDock.state()`), 'expanded');
  assert.equal(await dock.evaluate(`__foundkeepDock.status() + __foundkeepDock.toast()`), '', 'dragging by Save page does not save');
  assert.deepEqual(await dock.evaluate(`(() => { const a = __foundkeepDock.anchor(); return [a.side, a.tucked]; })()`), ['right', true]);
  await dock.waitFor(`__foundkeepDock.position().bottom === 784`);
  await web.mouse.move(200, 200); await web.keyboard.press('Escape');
  // (Focused, the tab lifts flush with the edge: position() is where it rests.)
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed' && __foundkeepDock.position().bottom === 800`);
  // Keyboard: arrows on the focused tab move it (lifting it off the edge),
  // Home puts it back in the corner.
  assert.equal(await dock.evaluate(`__foundkeepDock.focused()`), 'pill');
  await web.keyboard.press('Shift+ArrowUp');
  await dock.waitFor(`__foundkeepDock.anchor()?.tucked === false`);
  floating = await dock.evaluate(`__foundkeepDock.position()`);
  // Its centre moved up 64px (the floating tab is a little taller than the tucked one).
  assert.ok(Math.abs((floating.top + floating.bottom) / 2 - ((767 + 800) / 2 - 64)) <= 1, JSON.stringify(floating));
  // The position survives a reload (stored by the background, not the page).
  await pollUntil(worker, async () => (await chrome.storage.local.get('foundkeep-dock-anchor'))['foundkeep-dock-anchor']?.tucked === false, null);
  await web.reload();
  await worker.evaluate(async ({ id, state }) => {
    await chrome.scripting.executeScript({ target: { tabId: id }, files: ['src/dock/dock.js'] });
    await chrome.tabs.sendMessage(id, { kind: 'dock-show' });
    await chrome.tabs.sendMessage(id, { kind: 'dock-state', state });
  }, { id: tabId, state: CONNECTED_STATE });
  const again = await dockWorld(web, extensionId);
  await again.waitFor(`__foundkeepDock.state() === 'collapsed' && __foundkeepDock.anchor()?.tucked === false`);
  await again.waitFor(`__foundkeepDock.position().bottom === ${floating.bottom}`);
  assert.equal((await again.evaluate(`__foundkeepDock.position()`)).right, floating.right);
  await again.click('.pill'); await again.waitFor(`__foundkeepDock.state() === 'expanded'`);
  await web.mouse.move(200, 200); await web.keyboard.press('Escape');
  await again.waitFor(`__foundkeepDock.state() === 'collapsed' && __foundkeepDock.focused() === 'pill'`);
  await web.keyboard.press('Home');
  await again.waitFor(`__foundkeepDock.anchor() === null`);
  await again.waitFor(`(() => { const p = __foundkeepDock.position(); return 1200 - p.right === 16 && p.bottom === 800; })()`);
  // A small window keeps both shapes inside the viewport.
  await web.setViewportSize({ width: 500, height: 400 });
  await again.waitFor(`(() => { const r = __foundkeepDock.rect('.dock'); return r.x >= 0 && r.x + r.width <= 500 && r.y < 400; })()`);
  await again.click('.pill'); await again.waitFor(`__foundkeepDock.state() === 'expanded'`);
  await web.mouse.move(100, 100);
  await again.waitFor(`(() => { const r = __foundkeepDock.rect('.dock'); return r.x >= 0 && r.x + r.width <= 500 && r.y + r.height <= 400; })()`);
});
