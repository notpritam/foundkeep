import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dockWorld } from './helpers/dock-world.mjs';
import { backendCaptureMethods } from './helpers/backend-methods.mjs';
import { launch, signIn, extensionPage, summon, fixture, waitForLength, localCaptures } from './helpers/dock-launch.mjs';

const BACKEND_CAPTURE_METHODS = await backendCaptureMethods();
const SAVED = '✓ Saved to My library · Add details';
const PAGE = '<title>Shot fixture</title><meta name="description" content="A page worth screenshotting.">'
  + '<style>body{margin:0;font:18px sans-serif}</style><article><h1>Screenshots keep context</h1>'
  + '<p style="height:700px">A readable paragraph that makes this screenshot findable later.</p><h2>More below</h2><p style="height:900px">Further text.</p></article>';

// captureVisibleTab needs the activeTab or all-urls permission specifically;
// nothing in this suite can grant a fresh activeTab gesture, so every test
// here uses the disposable all-urls copy of the extension.
async function openShot(t, name, { uploads = null } = {}) {
  const { context, worker, extensionId, origin } = await launch(t, { allUrls: true, prefix: 'foundkeep-shot-' });
  await signIn(context, worker, { uploads });
  await fixture(context, origin + '/' + name, PAGE);
  const web = await context.newPage(); await web.goto(origin + '/' + name);
  const ext = await extensionPage(context, worker);
  assert.equal(await summon(ext, origin + '/' + name + '*'), true);
  await web.bringToFront();
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/' + name + '*');
  return { context, worker, origin, web, ext, dock, tab };
}
const toolbar = dock => dock.waitFor('!!window.__foundkeepCapture', 8000);
async function clickChoice(web, dock, choice) {
  const r = await dock.evaluate(`window.__foundkeepCapture.rect('[data-choice="${choice}"]')`);
  assert.ok(r.width > 0, choice + ' is visible');
  await web.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

test('screenshot: the dock button goes straight to region selection with a corner toolbar; a drag saves that region with page details', { timeout: 40000 }, async t => {
  const uploads = [];
  const { web, ext, dock } = await openShot(t, '__region', { uploads });
  await dock.click('[data-action="screenshot"]');
  await toolbar(dock);
  // No Region / Full page popover first; the dock is hidden while selecting.
  assert.equal(await dock.evaluate('__foundkeepDock.visible()'), false);
  const bar = await dock.evaluate(`window.__foundkeepCapture.rect('.bar')`);
  assert.ok(bar.width > 0 && bar.y < 40 && 1200 - (bar.x + bar.width) < 40, 'pinned to the top-right corner: ' + JSON.stringify(bar));
  assert.equal(await dock.evaluate(`window.__foundkeepCapture.text('.bar')`), 'SelectionFull page✕');
  assert.equal(await dock.evaluate(`window.__foundkeepCapture.attr('[data-choice="selection"]', 'aria-pressed')`), 'true');
  // Design review copies the selector (stylesheet + markup) through the
  // isolated-world handle; the page cannot see it.
  const copy = await dock.evaluate(`window.__foundkeepCapture.snapshot()`);
  assert.match(copy.css, /\.bar\{position:fixed/);
  assert.match(copy.html, /data-choice="selection" aria-pressed="true"/);
  assert.equal(await web.evaluate(() => typeof window.__foundkeepCapture), 'undefined');

  await web.mouse.move(50, 120); await web.mouse.down(); await web.mouse.move(250, 260, { steps: 5 }); await web.mouse.up();
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 15000);
  assert.equal(await dock.evaluate('!!window.__foundkeepCapture'), false, 'the toolbar is gone');
  assert.equal(await dock.evaluate('__foundkeepDock.visible()'), true, 'the dock is back');
  const dpr = await web.evaluate(() => window.devicePixelRatio);
  const [capture] = await localCaptures(ext);
  assert.equal(capture.type, 'screenshot');
  assert.equal(capture.width, Math.round(200 * dpr));
  assert.equal(capture.height, Math.round(140 * dpr));
  assert.ok(capture.bytes > 0);
  assert.equal(capture.sourceTitle, 'Shot fixture');
  assert.match(capture.articleText, /readable paragraph that makes this screenshot findable/, 'screenshots store readable text');
  assert.equal(capture.provenance.description, 'A page worth screenshotting.');
  assert.ok(capture.provenance.headings.length >= 2, 'and headings');
  assert.equal(capture.provenance.captureMethod, 'popup-region');
  assert.equal(await waitForLength(uploads, 1), 1);
  assert.equal(uploads[0].provenance.captureMethod, 'popup-region');
  assert.match(uploads[0].articleText, /findable later/);
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod));
});

test('screenshot: Full page in the corner toolbar captures and saves the whole page, with the dock hidden meanwhile', { timeout: 60000 }, async t => {
  const uploads = [];
  const { web, ext, dock } = await openShot(t, '__fullpage', { uploads });
  await dock.click('[data-action="screenshot"]');
  await toolbar(dock);
  const samples = [];
  let sampling = true;
  const sampler = (async () => { while (sampling) { samples.push(await dock.evaluate('__foundkeepDock.visible()')); await new Promise(r => setTimeout(r, 50)); } })();
  await clickChoice(web, dock, 'fullpage');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 30000);
  sampling = false; await sampler;
  assert.ok(samples.includes(false), 'the dock hides during the capture');
  assert.equal(await dock.evaluate('__foundkeepDock.visible()'), true);
  const dpr = await web.evaluate(() => window.devicePixelRatio);
  const [capture] = await localCaptures(ext);
  assert.equal(capture.type, 'screenshot');
  assert.ok(capture.height > 800 * dpr, 'taller than the viewport: ' + capture.height);
  assert.equal(capture.provenance.captureMethod, 'popup-full-page');
  assert.match(capture.articleText, /findable later/);
  assert.equal(await waitForLength(uploads, 1), 1);
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod));
});

test('screenshot: ✕ and Esc cancel with no capture and say "Selection cancelled."', { timeout: 40000 }, async t => {
  const { web, ext, dock } = await openShot(t, '__cancel');
  await dock.click('[data-action="screenshot"]');
  await toolbar(dock);
  await clickChoice(web, dock, 'cancel');
  await dock.waitFor(`__foundkeepDock.status() === 'Selection cancelled.'`, 8000);
  assert.equal(await dock.evaluate('!!window.__foundkeepCapture'), false);
  assert.equal(await dock.evaluate('__foundkeepDock.visible()'), true);
  assert.equal(await dock.evaluate('__foundkeepDock.toast()'), '');

  await dock.click('[data-action="screenshot"]');
  await toolbar(dock);
  await web.keyboard.press('Escape');
  await dock.waitFor('!window.__foundkeepCapture', 8000);
  await dock.waitFor(`__foundkeepDock.status() === 'Selection cancelled.'`, 8000);
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'expanded');
  assert.equal((await localCaptures(ext)).length, 0, 'nothing was saved');
});

test('screenshot: a page script cannot drive the selection or the corner toolbar', { timeout: 40000 }, async t => {
  const { web, ext, dock } = await openShot(t, '__untrusted');
  await dock.click('[data-action="screenshot"]');
  await toolbar(dock);
  const full = await dock.evaluate(`window.__foundkeepCapture.rect('[data-choice="fullpage"]')`);
  await web.evaluate(({ x, y }) => {
    const host = document.querySelector('foundkeep-capture');
    const fire = (type, cx, cy) => (document.elementFromPoint(cx, cy) || host).dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, clientX: cx, clientY: cy, button: 0 }));
    fire('mousedown', 40, 100); fire('mousemove', 300, 300); fire('mouseup', 300, 300);
    fire('click', x, y);
    host.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }, { x: full.x + full.width / 2, y: full.y + full.height / 2 });
  await new Promise(r => setTimeout(r, 800));
  assert.equal(await dock.evaluate('!!window.__foundkeepCapture'), true, 'untrusted events neither capture nor cancel');
  assert.equal((await localCaptures(ext)).length, 0);
  await web.keyboard.press('Escape');
  await dock.waitFor(`__foundkeepDock.status() === 'Selection cancelled.'`, 8000);
});

test('screenshot: keyboard and right-click region start the same corner toolbar; right-click full page saves directly', { timeout: 60000 }, async t => {
  const uploads = [];
  const { web, ext, dock, tab } = await openShot(t, '__paths', { uploads });
  const start = (action, trigger) => ext.evaluate(({ tab, action, trigger }) => import('./dock-control.js').then(m => m.startCapture(tab, action, { trigger })), { tab, action, trigger });

  let pending = start('region', 'keyboard');
  await toolbar(dock);
  await web.mouse.move(40, 100); await web.mouse.down(); await web.mouse.move(200, 220, { steps: 4 }); await web.mouse.up();
  assert.equal((await pending).ok, true);

  pending = start('region', 'keyboard');
  await toolbar(dock);
  await clickChoice(web, dock, 'fullpage');
  assert.equal((await pending).ok, true);

  pending = start('region', 'context');
  await toolbar(dock);
  await web.mouse.move(60, 120); await web.mouse.down(); await web.mouse.move(160, 220, { steps: 4 }); await web.mouse.up();
  assert.equal((await pending).ok, true);

  let toolbarSeen = false;
  pending = start('fullpage', 'context');
  const watcher = (async () => { for (let i = 0; i < 40; i++) { if (await dock.evaluate('!!window.__foundkeepCapture')) toolbarSeen = true; await new Promise(r => setTimeout(r, 50)); } })();
  assert.equal((await pending).ok, true);
  await watcher;
  assert.equal(toolbarSeen, false, 'the right-click full-page item captures without the toolbar');

  const methods = (await localCaptures(ext)).map(c => c.provenance.captureMethod).sort();
  assert.deepEqual(methods, ['context-full-page', 'context-region', 'keyboard-full-page', 'keyboard-region']);
  assert.equal(await waitForLength(uploads, 4), 4);
  for (const upload of uploads) assert.ok(BACKEND_CAPTURE_METHODS.has(upload.provenance.captureMethod), upload.provenance.captureMethod);
});

// Fix round 1, item 6: a second screenshot while the selector is open (e.g.
// the shortcut pressed again) does not stack another selector.
test('screenshot: a second screenshot while one is selecting is refused and does not stack a selector', { timeout: 40000 }, async t => {
  const { web, ext, dock, tab } = await openShot(t, '__stacked');
  const start = trigger => ext.evaluate(({ tab, trigger }) => import('./dock-control.js').then(m => m.startCapture(tab, 'region', { trigger })), { tab, trigger });
  const pending = start('keyboard');
  await toolbar(dock);
  assert.deepEqual(await start('keyboard'), { ok: false, error: 'A screenshot is already in progress on this page.' });
  assert.equal(await web.evaluate(() => document.querySelectorAll('foundkeep-capture').length), 1, 'still one selector');
  await web.keyboard.press('Escape');
  assert.deepEqual(await pending, { ok: false, cancelled: true });
  // Once it is over, a new screenshot can start again.
  const again = start('keyboard');
  await toolbar(dock);
  await web.keyboard.press('Escape');
  assert.deepEqual(await again, { ok: false, cancelled: true });
  assert.equal((await localCaptures(ext)).length, 0);
});
