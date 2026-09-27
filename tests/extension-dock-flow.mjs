import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from './helpers/dock-world.mjs';
import { pollUntil } from './helpers/poll.mjs';
import { backendCaptureMethods } from './helpers/backend-methods.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const SIGNED_IN = { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' };
// M8: read from the backend's own allowlist at test time (see the helper),
// never a hand-copied literal.
const BACKEND_CAPTURE_METHODS = await backendCaptureMethods();
const TWEET_FIXTURE = '<title>X fixture</title><article data-testid="tweet"><div data-testid="User-Name">Mina</div><a href="/mina/status/123456789"><time>Today</time></a><div data-testid="tweetText">A tweet worth keeping.</div><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/own.jpg"></div><div role="group"><button data-testid="reply">Reply</button></div></article>';

async function launch(t, { allUrls = false } = {}) {
  let extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  if (allUrls) {
    // chrome.tabs.captureVisibleTab requires the "<all_urls>" or "activeTab"
    // permission specifically — a plain host_permissions match (which is all
    // this fixture origin gets) is not enough, and nothing in this test
    // suite can grant a fresh activeTab gesture. extension-smoke.mjs uses
    // the same byte-for-byte copy + permission addition to work around it.
    const copy = await mkdtemp('/tmp/foundkeep-dock-flow-build-');
    await cp(extension, copy, { recursive: true });
    const manifestPath = path.join(copy, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.host_permissions.push('<all_urls>');
    await writeFile(manifestPath, JSON.stringify(manifest));
    extension = copy;
  }
  const profile = await mkdtemp('/tmp/foundkeep-dock-flow-');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  t.after(async () => { await context.close(); await rm(profile, { recursive: true, force: true }); if (allUrls) await rm(extension, { recursive: true, force: true }); });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  return { context, worker, extensionId, origin };
}

async function signIn(context, worker) {
  await worker.evaluate(state => chrome.storage.local.set({ atlasCustomer: state }), SIGNED_IN);
  await context.route('**/api/organization', r => r.fulfill({ json: { folders: [], tags: [], suggestedTags: [] } }));
  await context.route('**/api/collections', r => r.fulfill({ json: { collections: [] } }));
  await context.route('**/api/captures', r => r.fulfill({ json: { capture: { id: 'remote-1', status: 'done' } } }));
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

async function reviewFrame(web, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const frame = web.frames().find(f => f.url().includes('review.html'));
    if (frame) return frame;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('review.html frame did not appear');
}

test('dock: savepage saves into the account queue with the SPA url and auto-collapses', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  // Registered after signIn's own **/api/captures route, so this one (the
  // most recently added match) handles the request and lets the test
  // inspect the real upload body — R12.
  const uploads = [];
  await context.route('**/api/captures', r => { uploads.push(r.request().postDataJSON()); return r.fulfill({ json: { capture: { id: 'remote-1', status: 'done' } } }); });
  await context.route(origin + '/__flow', r => r.fulfill({ contentType: 'text/html', body: '<title>Flow fixture</title><p>Readable paragraph worth keeping.</p><script>history.pushState({}, "", "/__flow?step=2")</script>' }));
  const web = await context.newPage(); await web.goto(origin + '/__flow');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__flow*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");

  await dock.click('[data-action="savepage"]');
  const frame = await reviewFrame(web);
  assert.match(frame.url(), /^chrome-extension:\/\//);
  assert.match(frame.url(), /review\.html\?tab=/);
  await frame.waitForSelector('#reviewForm[data-ready="true"]');
  assert.deepEqual(await frame.$$eval('#saveDestination option', options => options.map(o => o.value)), ['library']);
  await frame.fill('#destinationPersonalTitle', 'A flow worth keeping');
  // performCapture requires the reviewed tab to still be the active tab in
  // its window (assertCaptureTab) — opening `ext` above made it the active
  // tab instead, which a real dock review (no second extension tab) never does.
  await web.bringToFront();
  await frame.click('#destinationConfirm');

  await dock.waitFor("__foundkeepDock.status() === 'Saved'", 10000);
  const captures = await ext.evaluate(async () => (await import('./db.js')).listCaptures());
  assert.equal(captures.length, 1);
  assert.equal(captures[0].type, 'bookmark');
  assert.equal(captures[0].cloudAccountId, 'account-a');
  assert.match(captures[0].sourceUrl, /\/__flow\?step=2$/);
  await dock.waitFor("__foundkeepDock.state() === 'collapsed'", 5000);
  // The local save queues the upload fire-and-forget (capture.js's
  // saveCapture does not await drainQueue()), so the request can still be
  // in flight after "Saved"/"collapsed" — wait for it directly (R12).
  const deadline = Date.now() + 10000;
  while (uploads.length === 0 && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].provenance.captureMethod, 'popup-save-page');
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod), 'captureMethod must be one the backend accepts: ' + uploads[0].provenance.captureMethod);
});

test('dock: reload mid-review reopens the card with the same note text', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__reload', r => r.fulfill({ contentType: 'text/html', body: '<title>Reload fixture</title><p>Kept steady across a reload.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__reload');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__reload*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.click('[data-action="note"]');
  let frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]');
  await frame.fill('#destinationPersonalTitle', 'A title worth keeping');
  await frame.fill('#reviewNote', 'Notes survive a reload');
  await frame.evaluate(() => { document.querySelector('#destinationTags input').value = 'Kept, Steady'; document.querySelector('#destinationTags .save-tag-entry button').click(); });
  await frame.waitForSelector('#destinationTags .selected', { state: 'attached' });
  await pollUntil(ext, async text => {
    const all = await chrome.storage.session.get(null);
    return Object.values(all).some(draft => draft?.form?.note === text && draft.form.title === 'A title worth keeping' && draft.form.tags.length === 2);
  }, 'Notes survive a reload');

  await web.reload();
  assert.equal(await summon(ext, origin + '/__reload*'), true);
  // The background's dock-hello handler (fired by dock.js's own init, once
  // re-injected) reopens the review for a tab with a pending draft.
  frame = await reviewFrame(web, 8000);
  await frame.waitForSelector('#reviewForm[data-ready="true"]');
  assert.equal(await frame.inputValue('#destinationPersonalTitle'), 'A title worth keeping');
  assert.equal(await frame.inputValue('#reviewNote'), 'Notes survive a reload');
  assert.equal(await frame.$$eval('#destinationTags .selected', els => els.length), 2);
});

test('dock: summonDock({toggle:true}) called twice collapses the second time (R1)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__toggle', r => r.fulfill({ contentType: 'text/html', body: '<title>Toggle fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__toggle');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

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
  await context.route(origin + '/__hello-slow', r => r.fulfill({ contentType: 'text/html', body: '<title>Hello-slow fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__hello-slow');
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({ url }))[0]?.id, origin + '/__hello-slow*');

  // Simulate a background that doesn't answer dock-hello in time — asleep,
  // mid-restart, or wedged. send()'s catch(() => null) in dock.js only
  // covers an outright rejection, not a slow/silent answer, so before fix
  // round 1 this left 'dock-show' waiting on dockReady forever and the dock
  // never appeared. Patch chrome.runtime.sendMessage inside this tab's
  // isolated content-script world *before* dock.js loads into it — both
  // executeScript calls below target the same frame, which shares one
  // persistent isolated world per extension, so the patch is still in
  // effect when dock.js's own IIFE calls chrome.runtime.sendMessage at the
  // bottom of the file. Everything except dock-hello passes through to the
  // real background; dock-hello resolves 4s late (past dockReady's 2s
  // bound) with a real-looking connected state, to prove a late reply still
  // lands and re-renders.
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

  // dock.js has no automatic injection path on this origin (no
  // content_scripts entry, no always-on registration) — inject it directly
  // and send dock-show straight to the tab, rather than through
  // summonDock(), which would push its own dock-state message ahead of
  // dock-show on a host_permissions origin like this one and populate
  // dockState before the race this test targets could ever matter (that's
  // exactly why the original x.com race needed a redacted tab.url to show
  // up at all — see the 'dock-show' comment in dock.js).
  await worker.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, files: ['src/dock/dock.js'] }), tabId);
  await worker.evaluate(tabId => chrome.tabs.sendMessage(tabId, { kind: 'dock-show', expand: true }), tabId);

  const dock = await dockWorld(web, extensionId);
  const start = Date.now();
  await dock.waitFor("__foundkeepDock.state() === 'expanded'", 3500);
  assert.ok(Date.now() - start < 3500, 'dock-show must not wait for dock-hello past its ~2s bound');
  // dockState is still null here (the slow dock-hello hasn't answered yet) —
  // render() falls back to the same signed-out/limited view a genuinely
  // disconnected account gets (.actions stays hidden), not a stuck empty dock.
  assert.equal(await dock.evaluate(`__foundkeepDock.rect('.actions').height`), 0);

  // The late dock-hello reply (~4s in) must still update dockState and
  // re-render once it actually arrives.
  await dock.waitFor(`__foundkeepDock.rect('[data-action="savepage"]').height > 0`, 6000);
});

test('dock: a fallback popup confirms and closes on success', { timeout: 30000 }, async t => {
  const { context, worker, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__popup-success', r => r.fulfill({ contentType: 'text/html', body: '<title>Popup success fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__popup-success');
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  const popupPromise = context.waitForEvent('page', { timeout: 10000 });
  // Force the fallback popup path directly, rather than depending on
  // dock.js's 3s no-ready timeout on a strict-CSP page: verified empirically
  // (see the strict-CSP test above) that this Chromium build does not
  // enforce a page's frame-src against its own extension's resources, so
  // that path never actually exercises the popup here. This drives the same
  // production function (openFallbackReview) directly for a deterministic
  // confirm-then-close success run.
  await ext.evaluate(async tab => {
    const save = await import('./save-review.js');
    await save.stageSaveReview({ action: 'note', tab, trigger: 'dock', text: '', attachPage: false });
    const dockControl = await import('./dock-control.js');
    await dockControl.openFallbackReview(tab.id);
  }, tab);
  const popup = await popupPromise;
  await popup.waitForSelector('#reviewForm[data-ready="true"]');
  await popup.fill('#reviewNote', 'Saved from the fallback popup');
  await popup.selectOption('#saveDestination', 'library');
  await popup.dispatchEvent('#saveDestination', 'change');
  await popup.click('#destinationConfirm');
  await popup.waitForEvent('close', { timeout: 10000 });
  const captures = await ext.evaluate(async () => (await import('./db.js')).listCaptures());
  assert.equal(captures.length, 1);
  assert.equal(captures[0].noteText, 'Saved from the fallback popup');
});

test('dock: the X save button opens the review card in the dock on x.com', { timeout: 30000 }, async t => {
  const { context, worker, extensionId } = await launch(t);
  await signIn(context, worker);
  await context.route('https://x.com/**', r => r.fulfill({ contentType: 'text/html', body: TWEET_FIXTURE }));
  const web = await context.newPage(); await web.goto('https://x.com/home');
  const button = web.locator('article [data-state]'); await button.waitFor(); await button.click();
  await web.waitForFunction(() => document.querySelector('article [data-state]').dataset.state !== 'saving');

  // dock.js is a static content script entry on x.com — no injection needed.
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'review'", 8000);
  const frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]');
});

test('dock: hiding on x.com survives an X save despite the background\'s redacted tab.url (carried from Task 4 review)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId } = await launch(t);
  await signIn(context, worker);
  await context.route('https://x.com/**', r => r.fulfill({ contentType: 'text/html', body: TWEET_FIXTURE }));
  const web = await context.newPage(); await web.goto('https://x.com/home');
  const dock = await dockWorld(web, extensionId);
  // x.com has no host_permissions entry (only a static content_scripts
  // match), so chrome.tabs.query cannot filter on its url — capture the tab
  // via "active" while it is the only candidate, before the ext page below
  // takes over activeness.
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);

  // Reveal the dock and hide it for this site through its own ⋯ menu. The
  // dock-site message carries sender.url (always accurate, even on x.com),
  // so the background correctly records https://x.com as hidden.
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  await ext.evaluate(tabId => import('./dock-control.js').then(m => m.summonDock(tabId, { expand: true })), tabId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.click('[data-action="more"]');
  // Defensive wait for the menu to actually be open before clicking into it
  // (same pattern already used for the screenshot menu at lines 342/376):
  // dock.click reads a button's rect over CDP and only then dispatches the
  // real mouse click, so clicking a button that isn't rendered yet (zero
  // rect) mis-clicks the page instead. The flake this guarded against here
  // traced to a real product race, not this timing gap on its own — see the
  // 'dock-show' fix in apps/extension/src/dock/dock.js (dockReady): on
  // x.com, summonDock's dock-show could arrive and render mode 'expanded'
  // before this content script's own dock-hello had populated dockState,
  // which read connected as false and hid .actions (including "more")
  // entirely, so the very first click above landed outside the dock and a
  // document-level listener collapsed it right back down before the menu
  // ever opened. Kept as a second line of defense regardless.
  await dock.waitFor(`__foundkeepDock.rect('[data-menu="more"]').height > 0`);
  await dock.click('[data-action="site"]');
  await dock.waitFor("__foundkeepDock.state() === 'hidden'");
  assert.equal(await dock.evaluate(`__foundkeepDock.text('[data-action="site"]')`), 'Show on this site again');

  // Trigger a real X save. Its startCapture -> openReview -> summonDock
  // chain calls chrome.tabs.get(tabId) inside the background, which Chrome
  // redacts to no tab.url on x.com — before the Task 4 fix, summonDock then
  // unconditionally pushed a dock-state built from that redacted tab,
  // silently flipping hiddenHere back to false and losing the hide.
  const button = web.locator('article [data-state]'); await button.waitFor(); await button.click();
  await web.waitForFunction(() => document.querySelector('article [data-state]').dataset.state !== 'saving');
  await dock.waitFor("__foundkeepDock.state() === 'review'", 8000);

  assert.equal(await dock.evaluate(`__foundkeepDock.text('[data-action="site"]')`), 'Show on this site again',
    'an X save must not silently un-hide the dock on this site');
});

test('dock: the X save button reaches its error state when signed out', { timeout: 30000 }, async t => {
  const { context } = await launch(t);
  // No signIn(): stageSaveReview inside startCapture throws "Sign in to
  // FoundKeep to save.", which must reach twitter.js as {ok:false} so the
  // button shows its own error state — not get stuck showing "choosing"
  // forever just because the dock (always present on x.com) can also show
  // the same error in its own status line.
  await context.route('https://x.com/**', r => r.fulfill({ contentType: 'text/html', body: TWEET_FIXTURE }));
  const web = await context.newPage(); await web.goto('https://x.com/home');
  const button = web.locator('article [data-state]'); await button.waitFor(); await button.click();
  await web.waitForFunction(() => document.querySelector('article [data-state]').dataset.state !== 'saving');
  assert.equal(await button.getAttribute('data-state'), 'error');
});

test('dock: a strict CSP page loads the framed card (or falls back to a popup)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  const uploads = [];
  await context.route('**/api/captures', r => { uploads.push(r.request().postDataJSON()); return r.fulfill({ json: { capture: { id: 'remote-1', status: 'done' } } }); });
  await context.route(origin + '/__strict', r => r.fulfill({ contentType: 'text/html', headers: { 'content-security-policy': "frame-src 'none'; default-src 'self'" }, body: '<title>Strict fixture</title><p>Strict page</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__strict');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__strict*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  const popupPromise = context.waitForEvent('page', { timeout: 6000 }).catch(() => null);
  await dock.click('[data-action="note"]');

  // spec risk 1 (brief step 4): does a page's Content-Security-Policy
  // frame-src block a chrome-extension:// iframe? Verified empirically on
  // this Chromium build: no — Chrome does not enforce a page's frame-src
  // against its own installed extension's resources, so the framed card
  // loads normally here, same as the unrestricted tests (confirmed via a
  // console CSP-violation message appearing for an ordinary cross-origin
  // iframe on the same page, but never for this one). If a future Chrome
  // does enforce it, dock.js's 3s ready timeout sends dock-review-fallback
  // and a popup opens instead — accept either outcome, as the brief allows.
  const framed = await reviewFrame(web, 4000).catch(() => null);
  // The note draft attaches the source page by default, which requires
  // `web` to still be the active tab in its window (assertCaptureTab).
  await web.bringToFront();
  if (framed) {
    await framed.waitForSelector('#reviewForm[data-ready="true"]');
    await framed.fill('#reviewNote', 'A note despite strict CSP'); // required for the note action
    await framed.click('#destinationConfirm');
    await dock.waitFor("__foundkeepDock.status() === 'Saved'", 10000);
  } else {
    const popup = await popupPromise;
    assert.ok(popup, 'expected either a framed card or a fallback popup');
    await popup.waitForSelector('#reviewForm[data-ready="true"]');
    await popup.fill('#reviewNote', 'A note despite strict CSP');
    await popup.click('#destinationConfirm');
    await popup.waitForEvent('close', { timeout: 10000 });
  }
  // M8: the upload carries a captureMethod the backend accepts.
  const uploadDeadline = Date.now() + 10000;
  while (uploads.length === 0 && Date.now() < uploadDeadline) await new Promise(r => setTimeout(r, 50));
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].provenance.captureMethod, 'extension-note');
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod));
});

test('dock: summonDock returns false for a restricted chrome:// page', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  const restricted = await context.newPage(); await restricted.goto('chrome://version/');
  // chrome://version isn't covered by any host permission, so chrome.tabs.query
  // cannot filter on its url; capture its id via "active" while it is the only
  // candidate, before the ext page below takes over activeness. (Dynamic
  // import() is disallowed in the service worker's own realm, so the id lookup
  // happens there but dock-control.js is loaded from the ext page.)
  const restrictedTabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  const result = await ext.evaluate(async restrictedTabId => (await import('./dock-control.js')).summonDock(restrictedTabId, { expand: true }), restrictedTabId);
  assert.equal(result, false);
});

test('dock: hides during a full-page screenshot and reappears afterward', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t, { allUrls: true });
  await signIn(context, worker);
  const uploads = [];
  await context.route('**/api/captures', r => { uploads.push(r.request().postDataJSON()); return r.fulfill({ json: { capture: { id: 'remote-1', status: 'done' } } }); });
  await context.route(origin + '/__shot', r => r.fulfill({ contentType: 'text/html', body: '<title>Shot fixture</title><p style="height:600px">A page worth screenshotting.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__shot');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__shot*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.click('[data-action="screenshot"]');
  await dock.waitFor(`__foundkeepDock.rect('[data-menu="screenshot"]').height > 0`);
  await dock.click('[data-action="fullpage"]');
  const frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]');

  await web.bringToFront();
  const samples = [];
  let sampling = true;
  const sampler = (async () => {
    while (sampling) { samples.push(await dock.evaluate('__foundkeepDock.visible()')); await new Promise(r => setTimeout(r, 50)); }
  })();
  await frame.click('#destinationConfirm');
  await dock.waitFor("__foundkeepDock.state() !== 'review'", 20000);
  sampling = false; await sampler;
  samples.push(await dock.evaluate('__foundkeepDock.visible()'));
  assert.ok(samples.includes(false), 'the dock must hide at least once during the capture: ' + JSON.stringify(samples));
  assert.equal(samples[samples.length - 1], true, 'the dock must be visible again once the capture finishes');
  // M8: the upload carries a captureMethod the backend accepts.
  const uploadDeadline = Date.now() + 10000;
  while (uploads.length === 0 && Date.now() < uploadDeadline) await new Promise(r => setTimeout(r, 50));
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].provenance.captureMethod, 'popup-full-page');
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod));
});

test('dock: a region drag saves a screenshot capture with the dragged dimensions', { timeout: 30000 }, async t => {
  // captureVisibleTab needs the activeTab or all-urls permission specifically;
  // nothing in this suite can grant a fresh activeTab gesture, so this reuses
  // the same disposable all-urls extension copy as the full-page test above
  // (and the deleted tests/extension-smoke.mjs's region test, at 5713572).
  const { context, worker, extensionId, origin } = await launch(t, { allUrls: true });
  await signIn(context, worker);
  const uploads = [];
  await context.route('**/api/captures', r => { uploads.push(r.request().postDataJSON()); return r.fulfill({ json: { capture: { id: 'remote-1', status: 'done' } } }); });
  await context.route(origin + '/__region', r => r.fulfill({ contentType: 'text/html', body: '<title>Region fixture</title><p style="height:600px">A page worth dragging over.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__region');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__region*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.click('[data-action="screenshot"]');
  await dock.waitFor(`__foundkeepDock.rect('[data-menu="screenshot"]').height > 0`);
  await dock.click('[data-action="region"]');
  const frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]');
  await frame.selectOption('#saveDestination', 'library');
  await frame.dispatchEvent('#saveDestination', 'change');

  await web.bringToFront();
  await frame.click('#destinationConfirm');
  // Confirming a region draft injects the on-page drag overlay
  // (regionSelectInPage in background.js) rather than capturing immediately;
  // the review card hides for the duration (withDockHidden), same as the
  // full-page case above.
  await web.getByText('Drag to capture · Esc to cancel').waitFor();
  await web.mouse.move(50, 70);
  await web.mouse.down();
  await web.mouse.move(250, 210);
  await web.mouse.up();
  await dock.waitFor("__foundkeepDock.state() !== 'review'", 20000);

  const dpr = await web.evaluate(() => window.devicePixelRatio);
  // A Blob's own `size` is not JSON-structured-cloneable back across
  // page.evaluate()'s serialization boundary (it would arrive as `{}`), so
  // read it from inside the page like the deleted extension-smoke.mjs did.
  const captures = await ext.evaluate(async () => (await (await import('./db.js')).listCaptures())
    .map(c => ({ type: c.type, width: c.width, height: c.height, bytes: c.blob?.size ?? 0 })));
  assert.equal(captures.length, 1);
  const [capture] = captures;
  assert.equal(capture.type, 'screenshot');
  assert.equal(capture.width, Math.round(200 * dpr));
  assert.equal(capture.height, Math.round(140 * dpr));
  assert.ok(capture.bytes > 0, 'the screenshot must have non-zero bytes');
  // M8: the upload carries a captureMethod the backend accepts.
  const uploadDeadline = Date.now() + 10000;
  while (uploads.length === 0 && Date.now() < uploadDeadline) await new Promise(r => setTimeout(r, 50));
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].provenance.captureMethod, 'popup-region');
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod));
});

test('dock: a capture without a scripting grant is refused at staging, and a grant lost after staging surfaces through the fallback popup', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  await signIn(context, worker);
  await context.route('https://example.org/', r => r.fulfill({ contentType: 'text/html', body: '<title>No grant fixture</title><p>No host permission here.</p>' }));
  const web = await context.newPage(); await web.goto('https://example.org/');
  // example.org isn't covered by any host permission, so chrome.tabs.query
  // cannot filter on its url; capture its full tab record via "active" while
  // it is the only candidate, before the ext page below takes over activeness.
  // (Dynamic import() is disallowed in the service worker's own realm, so the
  // tab lookup happens there but dock-control.js is loaded from the ext page.)
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  // M1: no activeTab grant (this isn't a real toolbar click) and no host
  // permission for example.org — startCapture now says so before staging
  // anything, instead of opening a review that can only fail at Save.
  let popups = 0; context.on('page', () => { popups++; });
  const refused = await ext.evaluate(tab => import('./dock-control.js').then(m => m.startCapture(tab, 'region', { trigger: 'dock' })), tab);
  assert.deepEqual(refused, { ok: false, error: 'Click the FoundKeep icon on this page to allow capture.' });
  assert.equal(await ext.evaluate(id => import('./save-review.js').then(m => m.readSaveReview(id)), tab.id), null);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(popups, 0, 'no review opens for a capture that cannot run');

  // R5: a grant can still disappear between staging and Save (e.g. the
  // activeTab grant ends when the page navigates). Stage directly, as a
  // capture that had its grant at the time would have, and confirm through
  // the fallback popup: the popup reads the same remedy.
  const popupPromise = context.waitForEvent('page', { timeout: 10000 });
  await ext.evaluate(async tab => {
    await (await import('./save-review.js')).stageSaveReview({ action: 'region', tab, trigger: 'dock' });
    await (await import('./dock-control.js')).openFallbackReview(tab.id);
  }, tab);
  const popup = await popupPromise;
  await popup.waitForSelector('#reviewForm[data-ready="true"]');
  await popup.selectOption('#saveDestination', 'library');
  await popup.dispatchEvent('#saveDestination', 'change');
  // performCapture's top-of-function assertCaptureTab requires `web` to
  // still be the active tab in its window, ahead of the scripting-grant
  // failure this test is actually after.
  await web.bringToFront();
  await popup.click('#destinationConfirm');
  await pollUntil(popup, () => document.querySelector('#destinationFeedback')?.textContent === 'Click the FoundKeep icon on this page to allow capture.', null);
  assert.equal(await popup.$eval('#destinationFeedback', el => el.textContent), 'Click the FoundKeep icon on this page to allow capture.');
});

test('dock: review.html refuses save-review-get when framed by an unrelated tab', { timeout: 30000 }, async t => {
  const { context, worker, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__victim', r => r.fulfill({ contentType: 'text/html', body: '<title>Victim fixture</title><p>Text.</p>' }));
  await context.route(origin + '/__attacker', r => r.fulfill({ contentType: 'text/html', body: '<title>Attacker fixture</title><p>Text.</p>' }));
  const victim = await context.newPage(); await victim.goto(origin + '/__victim');
  // Capture the victim's tab id via "active" before the attacker page below
  // takes over activeness (chrome.tabs.query can't filter by url reliably
  // here once there are several same-origin fixture tabs).
  const victimTab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  const attacker = await context.newPage(); await attacker.goto(origin + '/__attacker');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  // A real draft on the victim's own tab. Staged directly rather than via
  // startCapture so the victim has no card of its own open — anything that
  // reaches its top frame below can only have come from the attacker's card.
  await ext.evaluate(tab => import('./save-review.js').then(m => m.stageSaveReview({ action: 'savepage', tab, trigger: 'dock' })), victimTab);
  await pollUntil(ext, tab => import('./save-review.js').then(m => m.readSaveReview(tab.id)).then(d => !!d), victimTab);

  // The attacker page frames review.html for the *victim's* tab id — the
  // same URL form the dock itself uses (chrome.runtime.getURL), which is
  // exactly what web_accessible_resources now allows any page to embed.
  const reviewUrl = await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), victimTab.id);
  // R16: the background must not relay that card's ready/resize/done to the
  // victim's dock either — record whatever reaches the victim's top frame.
  await worker.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, func: () => {
    window.__relayed = [];
    chrome.runtime.onMessage.addListener(message => { if (message?.kind === 'dock-review-frame') window.__relayed.push(message); });
  } }), victimTab.id);
  await attacker.evaluate(url => {
    const frame = document.createElement('iframe'); frame.id = 'evil'; frame.src = url; document.body.append(frame);
  }, reviewUrl);
  const frame = attacker.frameLocator('#evil');
  await frame.locator('#reviewForm').waitFor();
  let becameReady = false;
  try { await frame.locator('#reviewForm[data-ready="true"]').waitFor({ timeout: 3000 }); becameReady = true; } catch { /* expected */ }
  assert.equal(becameReady, false, 'a framed card whose own tab does not match the tab= param must never become ready');
  assert.match(await frame.locator('#destinationFeedback').textContent(), /no longer matches its page|Reopen it/i);
  // Refused at the source too: the victim's own draft is untouched, and no
  // capture was ever created via the attacker's frame.
  assert.ok(await ext.evaluate(tab => import('./save-review.js').then(m => m.readSaveReview(tab.id)).then(d => !!d), victimTab));
  assert.equal(await ext.evaluate(async () => (await (await import('./db.js')).listCaptures()).length), 0);
  assert.deepEqual(await worker.evaluate(async tabId => (await chrome.scripting.executeScript({ target: { tabId }, func: () => window.__relayed }))[0].result, victimTab.id), [],
    'a card framed by another tab must never reach the victim tab\'s dock');
});

test('dock: review.html?window=1 refuses save-review-confirm without a matching fallback-popup reservation', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  await signIn(context, worker);
  await context.route('https://example.org/', r => r.fulfill({ contentType: 'text/html', body: '<title>No-nonce fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto('https://example.org/');
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  await ext.evaluate(tab => import('./save-review.js').then(m => m.stageSaveReview({ action: 'note', tab, trigger: 'dock', text: '', attachPage: false })), tab);

  // Not opened via openFallbackReview (chrome.windows.create) — so there is
  // no nonce reservation for this tab, exactly what a page could construct
  // itself by navigating (or window.open-ing) review.html directly with a
  // guessed/omitted &popup= value.
  // Built from the plain extension-id, not chrome.runtime.getURL() (which
  // returns review.html's use_dynamic_url form): a bare top-level navigation
  // with no matching-page initiator — chrome.windows.create has the same
  // restriction, per openFallbackReview's own comment — cannot load the
  // dynamic-host form at all, so this is what a page constructing this URL
  // itself would actually be able to navigate to.
  const extensionId = await worker.evaluate(() => chrome.runtime.id);
  const url = `chrome-extension://${extensionId}/src/review.html?tab=${tab.id}&window=1`;
  const plain = await context.newPage(); await plain.goto(url);
  await plain.waitForSelector('#reviewForm');
  let becameReady = false;
  try { await plain.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 3000 }); becameReady = true; } catch { /* expected */ }
  assert.equal(becameReady, false, 'a window=1 tab with no matching popup reservation must never become ready');
  assert.match(await plain.$eval('#destinationFeedback', el => el.textContent), /no longer matches its page|Reopen it/i);
  assert.equal(await ext.evaluate(async () => (await (await import('./db.js')).listCaptures()).length), 0);
});

test('dock: openFallbackReview does not open a second popup for a tab that already has one', { timeout: 30000 }, async t => {
  const { context, worker, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__double-popup', r => r.fulfill({ contentType: 'text/html', body: '<title>Double popup fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__double-popup');
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  await ext.evaluate(tab => import('./save-review.js').then(m => m.stageSaveReview({ action: 'note', tab, trigger: 'dock', text: '', attachPage: false })), tab);

  const before = context.pages().length;
  await ext.evaluate(tab => import('./dock-control.js').then(m => m.openFallbackReview(tab.id)), tab);
  await new Promise(r => setTimeout(r, 500));
  assert.equal(context.pages().length, before + 1, 'the first call opens exactly one popup');
  await ext.evaluate(tab => import('./dock-control.js').then(m => m.openFallbackReview(tab.id)), tab);
  await new Promise(r => setTimeout(r, 500));
  assert.equal(context.pages().length, before + 1, 'a second call for the same tab must focus the existing popup, not open a new one');
});

// C1 / R16 (probe C): review-card -> dock messages used to be
// window.parent.postMessage(..., '*'), which the page's own script received
// with event.source = the card's window — enough to navigate the real card
// slot to an attacker URL. They now travel only through the extension
// (review.html -> background -> dock), and the dock closes the card if its
// frame ever loads a second document.
test('dock: a page never receives review-card messages and cannot hijack the card (C1)', { timeout: 40000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  const PAGE = `<title>Hijack fixture</title><p>Text.</p><script>
    window.__received = [];
    addEventListener('message', event => {
      window.__received.push(JSON.stringify(event.data));
      try { event.source.postMessage({ foundkeepReview: true, type: 'done', saved: true }, '*'); } catch {}
      try { event.source.location = location.origin + '/__evil'; } catch {}
    });
  </script>`;
  await context.route(origin + '/__hijack-target', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
  await context.route(origin + '/__evil', r => r.fulfill({ contentType: 'text/html', body: '<title>Evil</title><p>Attacker page</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__hijack-target');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__hijack-target*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.click('[data-action="note"]');
  const frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
  // ready and the ResizeObserver's first resize have been sent by now; give
  // any leaked message (and the page's navigation attempt) time to land.
  await frame.fill('#reviewNote', 'Grow the card a little\n\n\n\n');
  await new Promise(r => setTimeout(r, 800));
  assert.deepEqual(await web.evaluate(() => window.__received), [], 'the page must never receive a review-card message');
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'review');
  const cardUrls = () => web.frames().filter(f => f !== web.mainFrame()).map(f => f.url());
  assert.equal(cardUrls().length, 1);
  assert.match(cardUrls()[0], /^chrome-extension:\/\/[^/]+\/src\/review\.html\?tab=\d+$/);
  await frame.click('#reviewCancel');
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  assert.deepEqual(await web.evaluate(() => window.__received), [], 'done must not reach the page either');

  // With no message to take event.source from, the page has no handle on
  // the card at all: an iframe inside the closed shadow root is not one of
  // window's indexed child frames.
  await dock.click('[data-action="note"]');
  const second = await reviewFrame(web);
  await second.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
  await dock.waitFor("__foundkeepDock.state() === 'review'");
  assert.equal(await web.evaluate(() => window.length), 0, 'the page must not be able to reach the card frame');
  // Should the card's frame ever load a second document anyway (forced
  // here from outside the page, through CDP), the dock must close it rather
  // than keep showing whatever loaded in the real card slot.
  await second.goto(origin + '/__evil').catch(() => {});
  await dock.waitFor("__foundkeepDock.state() === 'expanded'", 5000);
  assert.deepEqual(cardUrls(), [], 'the navigated card frame must be removed');
  assert.equal(await dock.evaluate('__foundkeepDock.status()'), 'Review closed. Save again to reopen it.');
  assert.deepEqual(await web.evaluate(() => window.__received), []);
});

test('dock: keyboard — focus moves into the card when it opens and back to the pill when it closes (M4)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__keys', r => r.fulfill({ contentType: 'text/html', body: '<title>Keyboard fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__keys');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  assert.equal(await summon(ext, origin + '/__keys*'), true);
  await web.bringToFront();
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  // Keyboard only from here: Tab to "Note" and press Enter.
  for (let i = 0; i < 12 && await dock.evaluate('__foundkeepDock.focused()') !== 'note'; i++) await web.keyboard.press('Tab');
  assert.equal(await dock.evaluate('__foundkeepDock.focused()'), 'note');
  await web.keyboard.press('Enter');
  const frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
  // Focus lands on the card's first field that needs input (a note's text).
  await dock.waitFor("__foundkeepDock.focused() === 'card'");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && await frame.evaluate(() => document.activeElement?.id) !== 'reviewNote') await new Promise(r => setTimeout(r, 50));
  assert.equal(await frame.evaluate(() => document.activeElement?.id), 'reviewNote');
  await web.keyboard.type('Typed without a mouse');
  assert.equal(await frame.inputValue('#reviewNote'), 'Typed without a mouse');
  // Escape cancels the card; focus returns to the dock's pill.
  await web.keyboard.press('Escape');
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.waitFor("__foundkeepDock.focused() === 'pill'");
});

test('dock: Escape during a region selection cancels it — no capture, and the dock says "Selection cancelled." (I1)', { timeout: 40000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t, { allUrls: true });
  await signIn(context, worker);
  await context.route(origin + '/__region-cancel', r => r.fulfill({ contentType: 'text/html', body: '<title>Region cancel fixture</title><p style="height:600px">Nothing worth keeping.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__region-cancel');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));

  assert.equal(await summon(ext, origin + '/__region-cancel*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.click('[data-action="screenshot"]');
  await dock.waitFor(`__foundkeepDock.rect('[data-menu="screenshot"]').height > 0`);
  await dock.click('[data-action="region"]');
  const frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
  await web.bringToFront();
  // Confirming from inside the card leaves keyboard focus in the card's
  // (now hidden) frame — exactly where a real user's focus would be.
  await frame.click('#destinationConfirm');
  const hint = web.getByText('Drag to capture · Esc to cancel');
  await hint.waitFor();
  await web.keyboard.press('Escape');
  await hint.waitFor({ state: 'detached', timeout: 5000 });
  await dock.waitFor("__foundkeepDock.state() === 'expanded'", 10000);
  await dock.waitFor("__foundkeepDock.status() === 'Selection cancelled.'");
  assert.notEqual(await dock.evaluate('__foundkeepDock.status()'), 'Saved');
  assert.equal(await dock.evaluate(`__foundkeepDock.text('.dock > .status')`), 'Selection cancelled.');
  assert.equal(await ext.evaluate(async () => (await (await import('./db.js')).listCaptures()).length), 0);
  // Still expanded (not auto-collapsing like a save), and the draft is gone.
  await new Promise(r => setTimeout(r, 500));
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'expanded');
});

// I2 / R14: 1.7.x set openPanelOnActionClick:true, which Chrome persists
// across updates; while it stays true the toolbar icon opens the (deleted)
// side panel and chrome.action.onClicked — the dock's entry point — never
// fires. The startup reset needs the sidePanel permission to run at all.
test('dock: an upgraded install\'s openPanelOnActionClick:true does not survive the next service-worker start (I2)', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  await worker.evaluate(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }));
  assert.equal(await worker.evaluate(async () => (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick), true);
  // Fetch this URL before stopping — evaluate() on a just-stopped worker
  // has nothing to wake it and hangs.
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
  // Waking it reruns background.js's top level. An extension page alone does
  // not need the worker; a runtime message to it does.
  await page.goto(wakeUrl);
  await page.evaluate(() => chrome.runtime.sendMessage({ kind: 'feature-status', feature: 'note' }));
  await pollUntil(page, async () => (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick === false, null);
  assert.equal(await page.evaluate(async () => (await chrome.sidePanel.getPanelBehavior()).openPanelOnActionClick), false);
});

// M1: x.com is matched only by a static content_scripts entry, so without an
// icon click the background can't read the tab's url (tabs.get/query redact
// it) or script the page. Every page capture used to stage fine and then
// fail at confirm with "The page changed during capture…".
test('dock: on x.com without an icon grant, page captures fail at staging with the grant message (M1)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId } = await launch(t);
  await signIn(context, worker);
  await context.route('https://x.com/**', r => r.fulfill({ contentType: 'text/html', body: TWEET_FIXTURE }));
  const web = await context.newPage(); await web.goto('https://x.com/home');
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  await ext.evaluate(tabId => import('./dock-control.js').then(m => m.summonDock(tabId, { expand: true })), tabId);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.waitFor(`__foundkeepDock.rect('[data-action="savepage"]').height > 0`);
  await dock.click('[data-action="savepage"]');
  await dock.waitFor("__foundkeepDock.status() === 'Click the FoundKeep icon on this page to allow capture.'");
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'expanded', 'no review opens');
  assert.equal(await ext.evaluate(tabId => import('./save-review.js').then(m => m.readSaveReview(tabId)), tabId), null, 'nothing is staged');
  // The X button itself needs no page grant and still opens its review.
  const button = web.locator('article [data-state]'); await button.waitFor(); await button.click();
  await dock.waitFor("__foundkeepDock.state() === 'review'", 8000);
});

// M2: a draft whose review is no longer visible (popup closed with the
// window's X, an open that failed silently) used to block every capture on
// that tab with "Finish or cancel the current save first." for 30 minutes.
test('dock: a capture on a tab with an invisible draft reopens that draft\'s review (M2)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__stuck', r => r.fulfill({ contentType: 'text/html', body: '<title>Stuck fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__stuck');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/__stuck*');
  assert.equal(await summon(ext, origin + '/__stuck*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  // Staged behind the dock's back (after its dock-hello, which would
  // otherwise reopen it): a draft with no visible review.
  const staged = await ext.evaluate(tab => import('./save-review.js').then(m => m.stageSaveReview({ action: 'note', tab, trigger: 'dock', text: 'An earlier thought', attachPage: false })), tab);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'expanded');
  await dock.click('[data-action="savepage"]');
  await dock.waitFor("__foundkeepDock.state() === 'review'", 8000);
  const frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
  assert.equal(await frame.inputValue('#reviewNote'), 'An earlier thought', 'the existing draft is the one reopened');
  assert.equal(await dock.evaluate('__foundkeepDock.status()'), 'Finish or cancel the current save first.');
  assert.equal((await ext.evaluate(tabId => import('./save-review.js').then(m => m.readSaveReview(tabId)), tab.id)).id, staged.id);
});

test('dock: startCapture reports {ok:false} and drops the draft when its review cannot open (M2)', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  await signIn(context, worker);
  await context.route('https://example.org/', r => r.fulfill({ contentType: 'text/html', body: '<title>No-open fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto('https://example.org/');
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  // No dock can be summoned on example.org (no grant), and the fallback
  // popup cannot open either.
  const result = await ext.evaluate(async tab => {
    chrome.windows.create = () => Promise.reject(new Error('No window.'));
    return (await import('./dock-control.js')).startCapture(tab, 'note', { trigger: 'dock', text: '', attachPage: false });
  }, tab);
  assert.deepEqual(result, { ok: false, error: 'FoundKeep could not open the save review. Try again.' });
  assert.equal(await ext.evaluate(id => import('./save-review.js').then(m => m.readSaveReview(id)), tab.id), null, 'a draft nobody can see must not block the next capture');
});

// M3: a capture method turned off in preferences used to stage and open a
// review, only to be refused at Save.
test('dock: a disabled capture method is refused at staging for keyboard, context and dock triggers (M3)', { timeout: 30000 }, async t => {
  const { context, worker, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__disabled', r => r.fulfill({ contentType: 'text/html', body: '<title>Disabled fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__disabled');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  await ext.evaluate(async () => {
    const { DEFAULT_PREFERENCES } = await import('./preferences.js');
    const preferences = JSON.parse(JSON.stringify(DEFAULT_PREFERENCES));
    preferences.capture.region = false; preferences.capture.image = false; preferences.capture.highlight = false;
    await chrome.storage.local.set({ atlasPreferenceCache: { accountId: 'account-a', preferences, revision: 1, updatedAt: null, fetchedAt: Date.now() } });
  });
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/__disabled*');
  const attempt = (action, extra) => ext.evaluate(({ tab, action, extra }) => import('./dock-control.js').then(m => m.startCapture(tab, action, extra)), { tab, action, extra });
  assert.deepEqual(await attempt('region', { trigger: 'keyboard' }), { ok: false, error: 'Region capture is disabled in your FoundKeep preferences.' });
  assert.deepEqual(await attempt('save-image', { trigger: 'context', info: { srcUrl: 'https://images.example.com/a.png' } }), { ok: false, error: 'Image capture is disabled in your FoundKeep preferences.' });
  assert.deepEqual(await attempt('highlight', { trigger: 'dock' }), { ok: false, error: 'Highlight capture is disabled in your FoundKeep preferences.' });
  assert.equal(await ext.evaluate(id => import('./save-review.js').then(m => m.readSaveReview(id)), tab.id), null, 'nothing is staged');
});

// M8: every capture method staging can produce — the dock (savepage,
// highlight, region, fullpage, note with and without its page), the context
// menu, keyboard shortcuts and the X button — must be one the backend
// accepts. captureMethodFor is the single function performCapture uses.
test('capture methods: every staged trigger/action maps to a method the backend accepts (M8)', async () => {
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

// M8 end to end: the upload body's provenance.captureMethod for a dock
// highlight, a context-menu selection and a keyboard highlight.
test('dock: highlight, context selection and keyboard highlight upload with backend-accepted methods (M8)', { timeout: 40000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  const uploads = [];
  await context.route('**/api/captures', r => { uploads.push(r.request().postDataJSON()); return r.fulfill({ json: { capture: { id: 'remote-' + uploads.length, status: 'done' } } }); });
  await context.route(origin + '/__methods', r => r.fulfill({ contentType: 'text/html', body: '<title>Methods fixture</title><p id="quote">A sentence worth highlighting.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__methods');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/__methods*');
  assert.equal(await summon(ext, origin + '/__methods*'), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  const select = () => web.evaluate(() => { const range = document.createRange(); range.selectNodeContents(document.querySelector('#quote')); getSelection().removeAllRanges(); getSelection().addRange(range); });
  const confirm = async () => {
    const frame = await reviewFrame(web);
    await frame.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
    await web.bringToFront();
    await frame.click('#destinationConfirm');
    await dock.waitFor("__foundkeepDock.state() !== 'review'", 10000);
  };
  await select();
  await dock.click('[data-action="highlight"]');
  await confirm();
  await ext.evaluate(tab => import('./dock-control.js').then(m => m.startCapture(tab, 'save-selection', { trigger: 'context', info: { selectionText: 'A sentence worth highlighting.' } })), tab);
  await confirm();
  await select();
  await ext.evaluate(tab => import('./dock-control.js').then(m => m.startCapture(tab, 'highlight', { trigger: 'keyboard' })), tab);
  await confirm();
  const deadline = Date.now() + 10000;
  while (uploads.length < 3 && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
  const methods = uploads.map(upload => upload.provenance.captureMethod).sort();
  assert.deepEqual(methods, ['context-selection', 'keyboard-highlight', 'popup-highlight']);
  for (const method of methods) assert.ok(BACKEND_CAPTURE_METHODS.has(method), method);
});

// M9a: the X button's whole round trip through the dock review.
test('dock: an X save confirms through the dock review (twitter-action, button saved) and a cancel resets the button (M9)', { timeout: 40000 }, async t => {
  const { context, worker, extensionId } = await launch(t);
  await signIn(context, worker);
  const uploads = [];
  await context.route('**/api/captures', r => { uploads.push(r.request().postDataJSON()); return r.fulfill({ json: { capture: { id: 'remote-1', status: 'done' } } }); });
  await context.route('https://x.com/**', r => r.fulfill({ contentType: 'text/html', body: TWEET_FIXTURE }));
  const web = await context.newPage(); await web.goto('https://x.com/home');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  await web.bringToFront();
  const dock = await dockWorld(web, extensionId);

  // Confirm: the capture is a tweet with the twitter-action method, and the
  // button on the post ends up "saved".
  const button = web.locator('article [data-state]'); await button.waitFor(); await button.click();
  await dock.waitFor("__foundkeepDock.state() === 'review'", 8000);
  assert.equal(await button.getAttribute('data-state'), 'choosing');
  let frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
  assert.equal(await frame.inputValue('#destinationPersonalTitle'), 'Mina (@mina) on X');
  await frame.click('#destinationConfirm');
  await dock.waitFor("__foundkeepDock.status() === 'Saved'", 10000);
  await pollUntil(web, () => document.querySelector('article [data-state]').dataset.state === 'saved', null);
  const captures = await ext.evaluate(async () => (await (await import('./db.js')).listCaptures()).map(c => ({ cloudType: c.cloudType, sourceUrl: c.sourceUrl, method: c.provenance.captureMethod })));
  assert.deepEqual(captures, [{ cloudType: 'tweet', sourceUrl: 'https://x.com/mina/status/123456789', method: 'twitter-action' }]);
  const deadline = Date.now() + 10000;
  while (uploads.length === 0 && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
  assert.equal(uploads[0].provenance.captureMethod, 'twitter-action');
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod));

  // Cancel: a fresh button (after a reload) goes back to idle, nothing saved.
  await web.reload();
  const dockAgain = await dockWorld(web, extensionId);
  const fresh = web.locator('article [data-state]'); await fresh.waitFor(); await fresh.click();
  await dockAgain.waitFor("__foundkeepDock.state() === 'review'", 8000);
  frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
  await frame.click('#reviewCancel');
  await dockAgain.waitFor("__foundkeepDock.state() === 'expanded'");
  await pollUntil(web, () => document.querySelector('article [data-state]').dataset.state === 'idle', null);
  assert.equal(await ext.evaluate(async () => (await (await import('./db.js')).listCaptures()).length), 1);
});

// M9b: a right-click image save asks for the image site's permission only at
// Save; declining keeps the review open with the existing message.
test('dock: a context-menu image save requests the image origin at confirm, and denial keeps the review open (M9)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__image', r => r.fulfill({ contentType: 'text/html', body: '<title>Image fixture</title><img src="https://images.example.com/photo.png" alt="A photo">' }));
  await context.route('https://images.example.com/**', r => r.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
  const web = await context.newPage(); await web.goto(origin + '/__image');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  const tab = await ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], origin + '/__image*');
  // What chrome.contextMenus.onClicked does for "Save image to FoundKeep".
  const started = await ext.evaluate(tab => import('./dock-control.js').then(m => m.startCapture(tab, 'save-image', { trigger: 'context', info: { menuItemId: 'save-image', srcUrl: 'https://images.example.com/photo.png', pageUrl: tab.url } })), tab);
  assert.deepEqual(started, { ok: true });
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'review'", 8000);
  const frame = await reviewFrame(web);
  await frame.waitForSelector('#reviewForm[data-ready="true"]', { timeout: 8000 });
  await frame.evaluate(() => {
    window.__permissionRequests = [];
    chrome.permissions.request = request => { window.__permissionRequests.push(request); return Promise.resolve(false); };
  });
  assert.deepEqual(await frame.evaluate(() => window.__permissionRequests), [], 'nothing is requested before Save');
  await web.bringToFront();
  await frame.click('#destinationConfirm');
  const feedback = async () => frame.$eval('#destinationFeedback', el => el.textContent);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && await feedback() !== 'Allow access to the image’s site to save its original file, then try again.') await new Promise(r => setTimeout(r, 50));
  assert.equal(await feedback(), 'Allow access to the image’s site to save its original file, then try again.');
  assert.deepEqual(await frame.evaluate(() => window.__permissionRequests), [{ origins: ['https://images.example.com/*'] }]);
  assert.equal(await dock.evaluate('__foundkeepDock.state()'), 'review', 'the review stays open');
  assert.ok(await ext.evaluate(id => import('./save-review.js').then(m => m.readSaveReview(id)).then(d => d?.action === 'save-image'), tab.id), 'the draft is kept');
  assert.equal(await ext.evaluate(async () => (await (await import('./db.js')).listCaptures()).length), 0);
  assert.equal(await frame.$eval('#destinationConfirm', el => el.disabled), false, 'Save can be tried again');
});
