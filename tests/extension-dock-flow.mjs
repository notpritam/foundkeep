import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from './helpers/dock-world.mjs';
import { pollUntil } from './helpers/poll.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const SIGNED_IN = { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' };
// Copied from the backend's own allowlist (apps/backend/src/customer-provenance.ts
// METHODS) — a captureMethod outside this set 400s on upload with
// invalid_capture_context, and cloud.js marks the capture permanently failed
// even though the dock already said "Saved" (R12).
const BACKEND_CAPTURE_METHODS = new Set([
  "popup-save-page", "keyboard-save-page", "context-selection", "context-link", "context-image",
  "popup-highlight", "keyboard-highlight", "popup-region", "keyboard-region", "popup-full-page",
  "keyboard-full-page", "context-save-page", "context-region", "context-full-page",
  "extension-note", "library-note", "twitter-action", "bookmark-import",
  "agent-create",
  "ios-share-url", "ios-share-text", "ios-share-image", "ios-share-video",
  "ios-share-audio", "ios-share-document", "ios-share-file", "ios-app-note",
  "android-share-url", "android-share-text", "android-share-image", "android-share-video",
  "android-share-audio", "android-share-document", "android-share-file", "android-app-note",
]);
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
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));

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
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));

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
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));

  // Mirrors chrome.action.onClicked's own call shape (background.js): the
  // first click expands a hidden/collapsed dock, the second collapses it.
  assert.equal(await summon(ext, origin + '/__toggle*', { expand: true, toggle: true }), true);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  assert.equal(await summon(ext, origin + '/__toggle*', { expand: true, toggle: true }), true);
  await dock.waitFor("__foundkeepDock.state() === 'collapsed'");
});

test('dock: a fallback popup confirms and closes on success', { timeout: 30000 }, async t => {
  const { context, worker, origin } = await launch(t);
  await signIn(context, worker);
  await context.route(origin + '/__popup-success', r => r.fulfill({ contentType: 'text/html', body: '<title>Popup success fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__popup-success');
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));

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
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  await ext.evaluate(tabId => import('./dock-control.js').then(m => m.summonDock(tabId, { expand: true })), tabId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.click('[data-action="more"]');
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
  await context.route(origin + '/__strict', r => r.fulfill({ contentType: 'text/html', headers: { 'content-security-policy': "frame-src 'none'; default-src 'self'" }, body: '<title>Strict fixture</title><p>Strict page</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__strict');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));

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
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  const result = await ext.evaluate(async restrictedTabId => (await import('./dock-control.js')).summonDock(restrictedTabId, { expand: true }), restrictedTabId);
  assert.equal(result, false);
});

test('dock: hides during a full-page screenshot and reappears afterward', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, origin } = await launch(t, { allUrls: true });
  await signIn(context, worker);
  await context.route(origin + '/__shot', r => r.fulfill({ contentType: 'text/html', body: '<title>Shot fixture</title><p style="height:600px">A page worth screenshotting.</p>' }));
  const web = await context.newPage(); await web.goto(origin + '/__shot');
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));

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
});

test('dock: a capture without a scripting grant surfaces through the fallback popup', { timeout: 30000 }, async t => {
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
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));

  const popupPromise = context.waitForEvent('page', { timeout: 10000 });
  // No activeTab grant (this isn't a real toolbar click) and no host
  // permission for example.org, so summonDock inside startCapture fails
  // and it falls back to the popup review card directly.
  await ext.evaluate(tab => import('./dock-control.js').then(m => m.startCapture(tab, 'region', { trigger: 'dock' })), tab);
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
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));

  // A real draft on the victim's own tab.
  await ext.evaluate(tab => import('./dock-control.js').then(m => m.startCapture(tab, 'savepage', { trigger: 'dock' })), victimTab);
  await pollUntil(ext, tab => import('./save-review.js').then(m => m.readSaveReview(tab.id)).then(d => !!d), victimTab);

  // The attacker page frames review.html for the *victim's* tab id — the
  // same URL form the dock itself uses (chrome.runtime.getURL), which is
  // exactly what web_accessible_resources now allows any page to embed.
  const reviewUrl = await worker.evaluate(id => chrome.runtime.getURL('src/review.html?tab=' + id), victimTab.id);
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
});

test('dock: review.html?window=1 refuses save-review-confirm without a matching fallback-popup reservation', { timeout: 30000 }, async t => {
  const { context, worker } = await launch(t);
  await signIn(context, worker);
  await context.route('https://example.org/', r => r.fulfill({ contentType: 'text/html', body: '<title>No-nonce fixture</title><p>Text.</p>' }));
  const web = await context.newPage(); await web.goto('https://example.org/');
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]);
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
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
  const ext = await context.newPage(); await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  await ext.evaluate(tab => import('./save-review.js').then(m => m.stageSaveReview({ action: 'note', tab, trigger: 'dock', text: '', attachPage: false })), tab);

  const before = context.pages().length;
  await ext.evaluate(tab => import('./dock-control.js').then(m => m.openFallbackReview(tab.id)), tab);
  await new Promise(r => setTimeout(r, 500));
  assert.equal(context.pages().length, before + 1, 'the first call opens exactly one popup');
  await ext.evaluate(tab => import('./dock-control.js').then(m => m.openFallbackReview(tab.id)), tab);
  await new Promise(r => setTimeout(r, 500));
  assert.equal(context.pages().length, before + 1, 'a second call for the same tab must focus the existing popup, not open a new one');
});
