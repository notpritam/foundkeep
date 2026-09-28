import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dockWorld } from './helpers/dock-world.mjs';
import { pollUntil } from './helpers/poll.mjs';
import { backendCaptureMethods } from './helpers/backend-methods.mjs';
import { launch, signIn, extensionPage, summon, fixture, waitForLength, localCaptures, selectText, dragSelect } from './helpers/dock-launch.mjs';

// M8: read from the backend's own allowlist at test time (see the helper),
// never a hand-copied literal.
const BACKEND_CAPTURE_METHODS = await backendCaptureMethods();
const SAVED = '✓ Saved to My library · Add details';
const ARTICLE = '<title>Flow fixture</title><meta name="description" content="A fixture page about keeping things."><meta name="author" content="Ada Example">'
  + '<article><h1>Keeping things</h1><p id="one">The first sentence worth keeping around for later.</p><h2>Why it matters</h2>'
  + '<p id="two">A second paragraph that explains the idea in more depth.</p><p id="three">A third paragraph for another highlight.</p></article>';

async function openDock(t, name, { body = ARTICLE, uploads = null, allUrls = false } = {}) {
  const { context, worker, extensionId, origin } = await launch(t, { allUrls });
  await signIn(context, worker, { uploads });
  await fixture(context, origin + '/' + name, body);
  const web = await context.newPage(); await web.goto(origin + '/' + name);
  const ext = await extensionPage(context, worker);
  assert.equal(await summon(ext, origin + '/' + name + '*'), true);
  // Every capture requires the page to still be the active tab in its window
  // (assertCaptureTab); opening `ext` made that tab active instead.
  await web.bringToFront();
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  return { context, worker, extensionId, origin, web, ext, dock };
}

test('dock: Save page saves in one click with full provenance and readable text, and no review card opens', { timeout: 30000 }, async t => {
  const uploads = [];
  const body = ARTICLE + '<script>history.pushState({}, "", "/__flow?step=2")</script>';
  const { web, ext, dock } = await openDock(t, '__flow', { body, uploads });

  await dock.click('[data-action="savepage"]');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 10000);
  assert.deepEqual(web.frames().filter(f => f !== web.mainFrame()).map(f => f.url()), [], 'no review card before or after the save');
  const captures = await localCaptures(ext);
  assert.equal(captures.length, 1);
  const [capture] = captures;
  assert.equal(capture.type, 'bookmark');
  assert.equal(capture.cloudAccountId, 'account-a', 'saved straight into My library');
  assert.match(capture.sourceUrl, /\/__flow\?step=2$/);
  assert.equal(capture.sourceTitle, 'Flow fixture');
  assert.match(capture.articleText, /second paragraph that explains the idea/);
  assert.equal(capture.provenance.description, 'A fixture page about keeping things.');
  assert.deepEqual(capture.provenance.authors, ['Ada Example']);
  assert.ok(capture.provenance.headings.length >= 2, JSON.stringify(capture.provenance.headings));
  assert.equal(capture.provenance.captureMethod, 'popup-save-page');
  assert.equal(await waitForLength(uploads, 1), 1);
  assert.equal(uploads[0].provenance.captureMethod, 'popup-save-page');
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod), 'captureMethod must be one the backend accepts');
  assert.equal(uploads[0].sourceTitle, 'Flow fixture');
});

test('dock: the "Saved · Add details" widget fades after about 5 s, and hovering keeps it', { timeout: 45000 }, async t => {
  const { web, dock } = await openDock(t, '__toast');
  await dock.click('[data-action="savepage"]');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 10000);
  const shownAt = Date.now();
  // Sits near the dock: its bottom edge is within a few pixels above the dock.
  const toast = await dock.evaluate(`__foundkeepDock.rect('.toast')`), bar = await dock.evaluate(`__foundkeepDock.rect('.dock')`);
  assert.ok(toast.height > 0 && toast.y + toast.height <= bar.y + 1 && bar.y - (toast.y + toast.height) < 24, JSON.stringify({ toast, bar }));
  assert.ok(Math.abs((toast.x + toast.width) - (bar.x + bar.width)) < 2, 'right-aligned with the dock');
  await dock.waitFor(`__foundkeepDock.toast() === ''`, 9000);
  const shownFor = Date.now() - shownAt;
  assert.ok(shownFor > 3500 && shownFor < 8000, `faded after ~5 s, took ${shownFor} ms`);
  // The dock collapses back to its pill once the widget is gone.
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`, 3000);

  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  await dock.click('[data-action="savepage"]');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 10000);
  const again = await dock.evaluate(`__foundkeepDock.rect('.toast')`);
  await web.mouse.move(again.x + 10, again.y + again.height / 2);
  await new Promise(r => setTimeout(r, 7000));
  assert.equal(await dock.evaluate('__foundkeepDock.toast()'), SAVED, 'hovering keeps the widget');
  await web.mouse.move(20, 20);
  await dock.waitFor(`__foundkeepDock.toast() === ''`, 9000);
});

test('dock: Highlight saves selected text at once; with nothing selected it enters highlighter mode until Esc', { timeout: 60000 }, async t => {
  const uploads = [];
  const { web, ext, dock } = await openDock(t, '__highlight', { uploads });

  // Pre-selected text saves immediately.
  await selectText(web, '#one');
  await dock.click('[data-action="highlight"]');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 10000);
  assert.equal(await dock.evaluate('__foundkeepDock.highlighting()'), false);
  let captures = await localCaptures(ext);
  assert.deepEqual(captures.map(c => [c.type, c.selectionText]), [['highlight', 'The first sentence worth keeping around for later.']]);

  // Nothing selected: highlighter mode.
  await web.evaluate(() => getSelection().removeAllRanges());
  await dock.click('[data-action="highlight"]');
  await dock.waitFor('__foundkeepDock.highlighting() === true');
  assert.equal(await dock.evaluate('__foundkeepDock.status()'), 'Select text to save · Esc to stop');
  assert.equal(await dock.evaluate(`__foundkeepDock.attr('[data-action="highlight"]', 'aria-pressed')`), 'true');
  const flashesBefore = await dock.evaluate('__foundkeepDock.flashes()');
  await dragSelect(web, '#two');
  await pollUntil(ext, async () => (await (await import('./db.js')).listCaptures()).length === 2, null);
  await dragSelect(web, '#three');
  await pollUntil(ext, async () => (await (await import('./db.js')).listCaptures()).length === 3, null);
  assert.ok(await dock.evaluate('__foundkeepDock.flashes()') >= flashesBefore + 2, 'each saved selection is briefly flashed');
  // Flashes are short-lived: no marks stay in the page or the dock.
  await dock.waitFor(`__foundkeepDock.rect('.flash').height === 0`, 3000);
  assert.equal(await web.evaluate(() => document.querySelectorAll('mark, [data-foundkeep-highlight]').length), 0);
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'expanded', 'selecting on the page does not collapse the dock in highlighter mode');
  assert.equal(await dock.evaluate('__foundkeepDock.status()'), 'Select text to save · Esc to stop');

  // A page script cannot feed the highlighter: a synthetic mouseup is ignored.
  await web.evaluate(() => {
    const range = document.createRange(); range.selectNodeContents(document.querySelector('#one'));
    getSelection().removeAllRanges(); getSelection().addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 700));
  assert.equal((await localCaptures(ext)).length, 3, 'an untrusted mouseup saves nothing');

  await web.keyboard.press('Escape');
  await dock.waitFor('__foundkeepDock.highlighting() === false');
  assert.equal(await dock.evaluate('__foundkeepDock.status()'), '');
  assert.equal(await dock.evaluate(`__foundkeepDock.attr('[data-action="highlight"]', 'aria-pressed')`), 'false');
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'expanded', 'Esc stops the mode without collapsing the dock');
  // With the mode off, selecting on the page is an ordinary click outside
  // the dock again: it collapses the dock and saves nothing.
  await dragSelect(web, '#two');
  await dock.waitFor(`__foundkeepDock.state() === 'collapsed'`);
  await new Promise(r => setTimeout(r, 500));
  assert.equal((await localCaptures(ext)).length, 3, 'nothing saves once the mode is off');

  // Clicking Highlight again also stops the mode.
  await web.evaluate(() => getSelection().removeAllRanges());
  await dock.click('.pill'); await dock.waitFor(`__foundkeepDock.state() === 'expanded'`);
  await dock.click('[data-action="highlight"]');
  await dock.waitFor('__foundkeepDock.highlighting() === true');
  await dock.click('[data-action="highlight"]');
  await dock.waitFor('__foundkeepDock.highlighting() === false');

  captures = await localCaptures(ext);
  assert.deepEqual(captures.map(c => c.selectionText).sort(), [
    'A second paragraph that explains the idea in more depth.',
    'A third paragraph for another highlight.',
    'The first sentence worth keeping around for later.',
  ]);
  assert.ok(captures.every(c => c.provenance.captureMethod === 'popup-highlight'));
  assert.equal(await waitForLength(uploads, 3), 3);
  for (const upload of uploads) assert.ok(BACKEND_CAPTURE_METHODS.has(upload.provenance.captureMethod));
});

test('dock: Note opens an inline field — Enter saves, Shift+Enter adds a line, Esc closes it', { timeout: 30000 }, async t => {
  const uploads = [];
  const { web, ext, dock } = await openDock(t, '__note', { uploads });
  await web.evaluate(() => { window.__keys = []; document.addEventListener('keydown', event => window.__keys.push(event.key)); });

  await dock.click('[data-action="note"]');
  await dock.waitFor('__foundkeepDock.composing() === true');
  await dock.waitFor(`__foundkeepDock.focused() === 'note-text'`);
  await web.keyboard.type('Line one');
  await web.keyboard.press('Shift+Enter');
  await web.keyboard.type('Line two');
  assert.equal((await localCaptures(ext)).length, 0, 'Shift+Enter does not save');
  await web.keyboard.press('Enter');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 10000);
  assert.equal(await dock.evaluate('__foundkeepDock.composing()'), false);
  const [note] = await localCaptures(ext);
  assert.equal(note.type, 'note');
  assert.equal(note.noteText, 'Line one\nLine two');
  assert.match(note.sourceUrl, /\/__note$/, 'the page is attached as before');
  assert.equal(note.provenance.captureMethod, 'extension-note');
  assert.deepEqual(await web.evaluate(() => window.__keys), [], 'the page does not receive the note keystrokes');

  await dock.click('[data-action="note"]');
  await dock.waitFor(`__foundkeepDock.focused() === 'note-text'`);
  await web.keyboard.type('Never mind');
  await web.keyboard.press('Escape');
  await dock.waitFor('__foundkeepDock.composing() === false');
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'expanded', 'Esc closes the field, not the dock');
  await new Promise(r => setTimeout(r, 300));
  assert.equal((await localCaptures(ext)).length, 1, 'Esc saves nothing');
  // An empty note is not saved either.
  await dock.click('[data-action="note"]');
  await dock.waitFor(`__foundkeepDock.focused() === 'note-text'`);
  await web.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 300));
  assert.equal((await localCaptures(ext)).length, 1);
  assert.equal(await waitForLength(uploads, 1), 1);
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod));
});

test('dock: right-click and keyboard captures save directly and show the widget', { timeout: 40000 }, async t => {
  const uploads = [];
  const body = ARTICLE + '<p><a id="link" href="https://example.com/read">A linked article</a></p>';
  const { web, ext, dock, origin } = await openDock(t, '__direct', { body, uploads });
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/__direct*');
  const start = (action, extra) => ext.evaluate(({ tab, action, extra }) => import('./dock-control.js').then(m => m.startCapture(tab, action, extra)), { tab, action, extra });

  await selectText(web, '#one');
  assert.equal((await start('save-selection', { trigger: 'context', info: { selectionText: 'The first sentence worth keeping around for later.' } })).ok, true);
  assert.equal((await start('save-link', { trigger: 'context', info: { linkUrl: 'https://example.com/read', linkText: 'A linked article' } })).ok, true);
  assert.equal((await start('savepage', { trigger: 'context' })).ok, true);
  await selectText(web, '#two');
  assert.equal((await start('highlight', { trigger: 'keyboard' })).ok, true);
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 5000);

  const captures = await localCaptures(ext);
  assert.deepEqual(captures.map(c => c.provenance.captureMethod).sort(), ['context-link', 'context-save-page', 'context-selection', 'keyboard-highlight']);
  assert.ok(captures.every(c => c.cloudAccountId === 'account-a'));
  assert.equal(captures.find(c => c.provenance.captureMethod === 'context-link').sourceUrl, 'https://example.com/read');
  assert.equal(await waitForLength(uploads, 4), 4);
  for (const upload of uploads) assert.ok(BACKEND_CAPTURE_METHODS.has(upload.provenance.captureMethod), upload.provenance.captureMethod);
  assert.deepEqual(web.frames().filter(f => f !== web.mainFrame()).map(f => f.url()), [], 'no review card');
});

test('dock: keyboard shortcuts map to direct saves, and both screenshot shortcuts start the corner-toolbar flow', async () => {
  const { actionForCommand } = await import('../apps/extension/src/capture-method.js');
  const on = { region: true, fullPage: true, highlight: true };
  assert.equal(actionForCommand('region-screenshot', on), 'region');
  assert.equal(actionForCommand('full-page-screenshot', on), 'region');
  assert.equal(actionForCommand('save-highlight', on), 'highlight');
  // With region selection turned off, the full-page shortcut captures the page directly.
  assert.equal(actionForCommand('full-page-screenshot', { ...on, region: false }), 'fullpage');
  assert.equal(actionForCommand('region-screenshot', { ...on, region: false }), 'region');
  assert.equal(actionForCommand('unknown', on), null);
});

test('dock: signed out, a capture is refused with "Sign in to FoundKeep to save." and nothing is stored', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await fixture(context, origin + '/__signed-out', ARTICLE);
  const web = await context.newPage(); await web.goto(origin + '/__signed-out');
  const ext = await extensionPage(context, worker);
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/__signed-out*');
  await web.bringToFront();
  const result = await ext.evaluate(tab => import('./dock-control.js').then(m => m.startCapture(tab, 'savepage', { trigger: 'context' })), tab);
  assert.deepEqual(result, { ok: false, error: 'Sign in to FoundKeep to save.' });
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor(`__foundkeepDock.status() === 'Sign in to FoundKeep to save.'`);
  assert.equal(await dock.evaluate('__foundkeepDock.toast()'), '');
  assert.equal((await localCaptures(ext)).length, 0);
});

test('dock: summonDock({toggle:true}) called twice collapses the second time (R1)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  await fixture(context, origin + '/__toggle', '<title>Toggle fixture</title><p>Text.</p>');
  const web = await context.newPage(); await web.goto(origin + '/__toggle');
  const ext = await extensionPage(context, worker);
  // Mirrors chrome.action.onClicked's own call shape (background.js): the
  // first click expands a hidden/collapsed dock, the second collapses it.
  assert.equal(await summon(ext, origin + '/__toggle*', { expand: true, toggle: true }), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  assert.equal(await summon(ext, origin + '/__toggle*', { expand: true, toggle: true }), true);
  await dock.waitFor("__foundkeepDock.state() === 'collapsed'");
});

test('dock: dock-show still shows the dock within its ~2s bound when dock-hello is slow to answer, and a late reply still updates state (fix round 1)', { timeout: 20000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await fixture(context, origin + '/__hello-slow', '<title>Hello-slow fixture</title><p>Text.</p>');
  const web = await context.newPage(); await web.goto(origin + '/__hello-slow');
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({ url }))[0]?.id, origin + '/__hello-slow*');
  // Patch chrome.runtime.sendMessage in this tab's isolated world before
  // dock.js loads into it: dock-hello resolves 4s late (past dockReady's 2s
  // bound) with a real-looking connected state.
  const lateState = { connected: true, actions: { savepage: true, highlight: true, region: true, fullpage: true, note: true }, alwaysOn: false, hiddenHere: false, localOnly: 0, show: false };
  await worker.evaluate(({ tabId, lateState }) => chrome.scripting.executeScript({
    target: { tabId },
    func: lateState => {
      const real = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = message =>
        message?.kind === 'dock-hello' ? new Promise(resolve => setTimeout(() => resolve(lateState), 4000)) : real(message);
    },
    args: [lateState],
  }), { tabId, lateState });
  await worker.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, files: ['src/dock/dock.js'] }), tabId);
  await worker.evaluate(tabId => chrome.tabs.sendMessage(tabId, { kind: 'dock-show', expand: true }), tabId);

  const dock = await dockWorld(web, extensionId);
  const start = Date.now();
  await dock.waitFor("__foundkeepDock.state() === 'expanded'", 3500);
  assert.ok(Date.now() - start < 3500, 'dock-show must not wait for dock-hello past its ~2s bound');
  assert.equal(await dock.evaluate(`__foundkeepDock.rect('.actions').height`), 0);
  await dock.waitFor(`__foundkeepDock.rect('[data-action="savepage"]').height > 0`, 6000);
});

test('dock: summonDock returns false for a restricted chrome:// page', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  const restricted = await context.newPage(); await restricted.goto('chrome://version/');
  const restrictedTabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  const ext = await extensionPage(context, worker);
  const result = await ext.evaluate(async restrictedTabId => (await import('./dock-control.js')).summonDock(restrictedTabId, { expand: true }), restrictedTabId);
  assert.equal(result, false);
});

// I2 / R14: 1.7.x set openPanelOnActionClick:true, which Chrome persists
// across updates; while it stays true the toolbar icon opens the (deleted)
// side panel and chrome.action.onClicked — the dock's entry point — never
// fires. The startup reset needs the sidePanel permission to run at all.
test('dock: an upgraded install\'s openPanelOnActionClick:true does not survive the next service-worker start (I2)', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  await worker.evaluate(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }));
  assert.equal(await worker.evaluate(async () => (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick), true);
  const wakeUrl = await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html'));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  let versionId, running = true;
  cdp.on('ServiceWorker.workerVersionUpdated', event => {
    for (const version of event.versions) {
      if (version.scriptURL !== worker.url()) continue;
      if (version.runningStatus === 'running') { versionId = version.versionId; running = true; }
      if (version.runningStatus === 'stopped') running = false;
    }
  });
  await cdp.send('ServiceWorker.enable');
  for (let i = 0; i < 100 && !versionId; i++) await new Promise(r => setTimeout(r, 50));
  assert.ok(versionId, 'found the running service worker version');
  await cdp.send('ServiceWorker.stopWorker', { versionId });
  for (let i = 0; i < 100 && running; i++) await new Promise(r => setTimeout(r, 50));
  assert.equal(running, false, 'the service worker stopped');
  await page.goto(wakeUrl);
  await page.evaluate(() => chrome.runtime.sendMessage({ kind: 'feature-status', feature: 'note' }));
  await pollUntil(page, async () => (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick === false, null);
  assert.equal(await page.evaluate(async () => (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick), false);
});

// M3: a capture method turned off in preferences is refused before anything
// runs, for every trigger.
test('dock: a disabled capture method is refused for keyboard, context and dock triggers (M3)', { timeout: 30000 }, async t => {
  const { context, worker, origin } = await launch(t);
  await signIn(context, worker);
  await fixture(context, origin + '/__disabled', '<title>Disabled fixture</title><p>Text.</p>');
  const web = await context.newPage(); await web.goto(origin + '/__disabled');
  const ext = await extensionPage(context, worker);
  await ext.evaluate(async () => {
    const { DEFAULT_PREFERENCES } = await import('./preferences.js');
    const preferences = JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));
    preferences.capture.region = false; preferences.capture.image = false; preferences.capture.highlight = false;
    await chrome.storage.local.set({ atlasPreferenceCache: { accountId: 'account-a', preferences, revision: 1, updatedAt: null, fetchedAt: Date.now() } });
  });
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/__disabled*');
  await web.bringToFront();
  const attempt = (action, extra) => ext.evaluate(({ tab, action, extra }) => import('./dock-control.js').then(m => m.startCapture(tab, action, extra)), { tab, action, extra });
  assert.deepEqual(await attempt('region', { trigger: 'keyboard' }), { ok: false, error: 'Region capture is disabled in your FoundKeep preferences.' });
  assert.deepEqual(await attempt('save-image', { trigger: 'context', info: { srcUrl: 'https://images.example.com/a.png' } }), { ok: false, error: 'Image capture is disabled in your FoundKeep preferences.' });
  assert.deepEqual(await attempt('highlight', { trigger: 'dock' }), { ok: false, error: 'Highlight capture is disabled in your FoundKeep preferences.' });
  assert.equal((await localCaptures(ext)).length, 0, 'nothing is saved');
});

// M8: every capture method a save can produce — the dock (savepage,
// highlight, region, fullpage, note with and without its page), the context
// menu, keyboard shortcuts and the X button — must be one the backend
// accepts. captureMethodFor is the single function performCapture uses.
test('capture methods: every trigger/action maps to a method the backend accepts (M8)', async () => {
  const { captureMethodFor } = await import('../apps/extension/src/capture-method.js');
  const cases = [
    ['dock', 'savepage', {}, 'popup-save-page'], ['dock', 'highlight', {}, 'popup-highlight'],
    ['dock', 'region', {}, 'popup-region'], ['dock', 'fullpage', {}, 'popup-full-page'],
    ['dock', 'note', { attachPage: true }, 'extension-note'], ['dock', 'note', { attachPage: false }, 'library-note'],
    ['context', 'save-selection', {}, 'context-selection'], ['context', 'save-link', {}, 'context-link'],
    ['context', 'save-image', {}, 'context-image'], ['context', 'savepage', {}, 'context-save-page'],
    ['context', 'region', {}, 'context-region'], ['context', 'fullpage', {}, 'context-full-page'],
    ['keyboard', 'region', {}, 'keyboard-region'], ['keyboard', 'fullpage', {}, 'keyboard-full-page'],
    ['keyboard', 'highlight', {}, 'keyboard-highlight'],
    ['twitter', 'tweet', {}, 'twitter-action'],
  ];
  for (const [trigger, action, options, expected] of cases) {
    const method = captureMethodFor(action, trigger, options);
    assert.equal(method, expected, `${trigger} ${action}`);
    assert.ok(BACKEND_CAPTURE_METHODS.has(method), `${trigger} ${action} -> ${method} must be in the backend's METHODS`);
  }
});

// M9b: a right-click image save asks for the image site's permission inside
// the click that started it (the save runs straight away now); declining
// saves nothing and says why.
test('dock: a context-menu image save asks for the image origin first, saves on grant, and saves nothing on denial (M9)', { timeout: 40000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t, { allUrls: true });
  await signIn(context, worker);
  await fixture(context, origin + '/__image', '<title>Image fixture</title><img src="https://images.example.com/photo.png" alt="A photo">');
  await context.route('https://images.example.com/**', r => r.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
  const web = await context.newPage(); await web.goto(origin + '/__image');
  const ext = await extensionPage(context, worker);
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/__image*');
  await web.bringToFront();
  const save = grant => ext.evaluate(({ tab, grant }) => {
    window.__permissionRequests = [];
    chrome.permissions.request = request => { window.__permissionRequests.push(request); return Promise.resolve(grant); };
    return import('./dock-control.js').then(m => m.startCapture(tab, 'save-image', { trigger: 'context', info: { menuItemId: 'save-image', srcUrl: 'https://images.example.com/photo.png', pageUrl: tab.url } }));
  }, { tab, grant });

  const denied = await save(false);
  assert.deepEqual(denied, { ok: false, error: 'Allow access to the image’s site to save its original file, then try again.' });
  assert.deepEqual(await ext.evaluate(() => window.__permissionRequests), [{ origins: ['https://images.example.com/*'] }]);
  assert.equal((await localCaptures(ext)).length, 0);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor(`__foundkeepDock.status() === 'Allow access to the image’s site to save its original file, then try again.'`);

  const granted = await save(true);
  assert.equal(granted.ok, true, JSON.stringify(granted));
  const captures = await localCaptures(ext);
  assert.equal(captures.length, 1);
  assert.equal(captures[0].type, 'image');
  assert.ok(captures[0].bytes > 0);
  assert.equal(captures[0].provenance.captureMethod, 'context-image');
  assert.equal(captures[0].provenance.targetUrl, 'https://images.example.com/photo.png');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`);
});
