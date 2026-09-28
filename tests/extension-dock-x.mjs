import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dockWorld } from './helpers/dock-world.mjs';
import { pollUntil } from './helpers/poll.mjs';
import { backendCaptureMethods } from './helpers/backend-methods.mjs';
import { launch, signIn, extensionPage, waitForLength, localCaptures } from './helpers/dock-launch.mjs';

const BACKEND_CAPTURE_METHODS = await backendCaptureMethods();
const SAVED = '✓ Saved to My library · Add details';
const TWEET_FIXTURE = '<title>X fixture</title><article data-testid="tweet"><div data-testid="User-Name">Mina</div><a href="/mina/status/123456789"><time>Today</time></a><div data-testid="tweetText">A tweet worth keeping.</div><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/own.jpg"></div><div role="group"><button data-testid="reply">Reply</button></div></article>';
const button = web => web.locator('article [data-state]');

async function openX(t, { signedIn = true, uploads = null, patchManifest = null } = {}) {
  const { context, worker, extensionId } = await launch(t, { patchManifest, prefix: 'foundkeep-x-' });
  if (signedIn) await signIn(context, worker, { uploads });
  await context.route('https://x.com/**', r => r.fulfill({ contentType: 'text/html', body: TWEET_FIXTURE }));
  const web = await context.newPage(); await web.goto('https://x.com/home');
  await button(web).waitFor();
  return { context, worker, extensionId, web };
}

test('X: the button saves the post in one click (twitter-action), turns saved, and the dock offers Add details', { timeout: 40000 }, async t => {
  const uploads = [];
  const { context, worker, extensionId, web } = await openX(t, { uploads });
  const ext = await extensionPage(context, worker);
  await web.bringToFront();
  const dock = await dockWorld(web, extensionId);
  await button(web).click();
  await pollUntil(web, () => document.querySelector('article [data-state]').dataset.state === 'saved', null);
  assert.equal(await button(web).getAttribute('title'), 'Saved to FoundKeep');
  assert.equal(await button(web).getAttribute('aria-label'), 'Saved to FoundKeep');
  // Emerald when saved (after the button's short color transition).
  await pollUntil(web, () => getComputedStyle(document.querySelector('article [data-state]')).color === 'rgb(76, 195, 138)', null, { timeout: 3000 });
  assert.equal(await button(web).locator('svg[data-icon="foundkeep-mark"]').count(), 1, 'still the FoundKeep mark when saved');
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 8000);
  assert.deepEqual(web.frames().filter(f => f !== web.mainFrame()).map(f => f.url()), [], 'no review card');
  const captures = await localCaptures(ext);
  assert.deepEqual(captures.map(c => ({ cloudType: c.cloudType, sourceUrl: c.sourceUrl, method: c.provenance.captureMethod, text: c.selectionText })),
    [{ cloudType: 'tweet', sourceUrl: 'https://x.com/mina/status/123456789', method: 'twitter-action', text: 'A tweet worth keeping.' }]);
  assert.equal(await waitForLength(uploads, 1), 1);
  assert.equal(uploads[0].provenance.captureMethod, 'twitter-action');
  assert.ok(BACKEND_CAPTURE_METHODS.has(uploads[0].provenance.captureMethod));
  // A second click on a saved post does not save it again.
  await button(web).click();
  await new Promise(r => setTimeout(r, 500));
  assert.equal((await localCaptures(ext)).length, 1);
});

test('X: the button shows the FoundKeep mark at X\'s icon size and talks about saving, not destinations', { timeout: 30000 }, async t => {
  const { web } = await openX(t);
  const idle = button(web);
  assert.equal(await idle.getAttribute('data-state'), 'idle');
  assert.equal(await idle.getAttribute('title'), 'Save to FoundKeep');
  assert.equal(await idle.getAttribute('aria-label'), 'Save to FoundKeep');
  const icon = idle.locator('svg[data-icon="foundkeep-mark"]');
  assert.equal(await icon.count(), 1);
  // Bookmark body with the folded corner, plus the mark's dot — an outline.
  assert.equal(await icon.locator('path').count(), 2);
  assert.equal(await icon.locator('circle').count(), 1);
  assert.equal(await icon.getAttribute('fill'), 'none');
  const size = await icon.evaluate(el => [el.getAttribute('width'), el.getAttribute('height')]);
  assert.deepEqual(size, ['18.75', '18.75'], 'X\'s own action icons are 18.75px');
  assert.equal(await idle.evaluate(el => el.getBoundingClientRect().width), 34.75, 'the same 34.75px hit area as X\'s buttons');
  assert.doesNotMatch(await idle.innerText(), /Dev/);
  assert.equal(await idle.locator('[data-foundkeep-dev-dot]').count(), 0, 'no dev marker in a production build');
});

test('X: a dev build shows a small emerald dot instead of "Dev" text and a wider button', { timeout: 30000 }, async t => {
  const { web } = await openX(t, { patchManifest: manifest => { manifest.action.default_title = 'FoundKeep Dev'; } });
  const dev = web.locator('article [data-foundkeep-dev] button');
  await dev.waitFor();
  assert.equal(await dev.getAttribute('title'), 'Save to FoundKeep Dev');
  assert.doesNotMatch(await dev.innerText(), /Dev/);
  assert.equal(await dev.evaluate(el => el.getBoundingClientRect().width), 34.75);
  const dot = dev.locator('[data-foundkeep-dev-dot]');
  assert.equal(await dot.count(), 1);
  assert.equal(await dot.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(76, 195, 138)');
  const box = await dot.boundingBox();
  assert.ok(box.width <= 8 && box.height <= 8, 'small: ' + JSON.stringify(box));
});

test('X: signed out, the button reaches its error state and says why', { timeout: 30000 }, async t => {
  const { web } = await openX(t, { signedIn: false });
  await button(web).click();
  await pollUntil(web, () => document.querySelector('article [data-state]').dataset.state !== 'saving', null);
  assert.equal(await button(web).getAttribute('data-state'), 'error');
  assert.equal(await button(web).getAttribute('title'), 'Sign in to FoundKeep to save.');
});

test('X: hiding the dock on x.com survives an X save despite the background\'s redacted tab.url', { timeout: 40000 }, async t => {
  const { context, worker, extensionId, web } = await openX(t);
  const dock = await dockWorld(web, extensionId);
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  const ext = await extensionPage(context, worker);
  await ext.evaluate(tabId => import('./dock-control.js').then(m => m.summonDock(tabId, { expand: true })), tabId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await web.bringToFront();
  await dock.click('[data-action="more"]');
  await dock.waitFor(`__foundkeepDock.rect('[data-menu="more"]').height > 0`);
  await dock.click('[data-action="site"]');
  await dock.waitFor("__foundkeepDock.state() === 'hidden'");
  assert.equal(await dock.evaluate(`__foundkeepDock.text('[data-action="site"]')`), 'Show on this site again');
  // The X save summons the dock (to show "Saved") through chrome.tabs.get,
  // which redacts tab.url on x.com; that must not silently un-hide the site.
  await button(web).click();
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 8000);
  assert.equal(await dock.evaluate(`__foundkeepDock.text('[data-action="site"]')`), 'Show on this site again',
    'an X save must not silently un-hide the dock on this site');
});

// M1: x.com is matched only by a static content_scripts entry, so without an
// icon click the background can't read the tab's url or script the page.
test('X: without an icon grant, page captures fail with the grant message while the X button still saves (M1)', { timeout: 30000 }, async t => {
  const { context, worker, extensionId, web } = await openX(t);
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  const ext = await extensionPage(context, worker);
  await ext.evaluate(tabId => import('./dock-control.js').then(m => m.summonDock(tabId, { expand: true })), tabId);
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await dock.waitFor(`__foundkeepDock.rect('[data-action="savepage"]').height > 0`);
  await web.bringToFront();
  await dock.click('[data-action="savepage"]');
  await dock.waitFor("__foundkeepDock.status() === 'Click the FoundKeep icon on this page to allow capture.'");
  assert.equal((await localCaptures(ext)).length, 0, 'nothing is saved');
  await button(web).click();
  await dock.waitFor(`__foundkeepDock.toast() === ${JSON.stringify(SAVED)}`, 8000);
  assert.equal((await localCaptures(ext)).length, 1);
});
