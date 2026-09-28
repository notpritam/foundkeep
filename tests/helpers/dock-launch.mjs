import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

export const SIGNED_IN = { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' };

// R7: headless-shell (the Playwright default) cannot load extensions; the
// chromium channel is required. `allUrls` adds "<all_urls>" to a disposable
// copy of the extension: chrome.tabs.captureVisibleTab needs the activeTab or
// all-urls permission specifically, and nothing in this suite can grant a
// fresh activeTab gesture. `patchManifest` edits that same disposable copy.
export async function launch(t, { allUrls = false, patchManifest = null, prefix = 'foundkeep-dock-' } = {}) {
  let extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const copied = allUrls || !!patchManifest;
  if (copied) {
    const copy = await mkdtemp(`/tmp/${prefix}build-`);
    await cp(extension, copy, { recursive: true });
    const manifestPath = path.join(copy, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (allUrls) manifest.host_permissions.push('<all_urls>');
    patchManifest?.(manifest);
    await writeFile(manifestPath, JSON.stringify(manifest));
    extension = copy;
  }
  const profile = await mkdtemp(`/tmp/${prefix}`);
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    viewport: { width: 1200, height: 800 },
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  t.after(async () => { await context.close(); await rm(profile, { recursive: true, force: true }); if (copied) await rm(extension, { recursive: true, force: true }); });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  return { context, worker, extensionId, origin };
}

// Signs in the fixture account and routes the library endpoints the extension
// may call. Pass `uploads` to record every POST /api/captures body.
export async function signIn(context, worker, { uploads = null, collections = [], folders = [] } = {}) {
  await worker.evaluate(state => chrome.storage.local.set({ atlasCustomer: state }), SIGNED_IN);
  await context.route('**/api/organization', r => r.fulfill({ json: { folders, tags: [], suggestedTags: [] } }));
  await context.route('**/api/collections', r => r.fulfill({ json: { collections } }));
  await context.route('**/api/captures', r => {
    if (r.request().method() !== 'POST') return r.fallback();
    uploads?.push(r.request().postDataJSON());
    // The backend answers a new capture with 201 + duplicate:false.
    return r.fulfill({ status: 201, json: { capture: { id: 'remote-' + (uploads ? uploads.length : 1), status: 'done' }, duplicate: false } });
  });
}

// An extension page: tests import the extension's own modules there (dynamic
// import() is disallowed in the service worker's realm).
export async function extensionPage(context, worker) {
  const ext = await context.newPage();
  await ext.goto(await worker.evaluate(() => chrome.runtime.getURL('src/dock-settings.html')));
  return ext;
}

// dock-control.js is a plain module and works outside the worker; tests drive
// summonDock from an extension page since they cannot click the toolbar icon.
export function summon(ext, url, opts = { expand: true }) {
  return ext.evaluate(async ({ url, opts }) => {
    const [tab] = await chrome.tabs.query({ url });
    return (await import('./dock-control.js')).summonDock(tab.id, opts);
  }, { url, opts });
}

export async function fixture(context, url, body, headers = {}) {
  await context.route(url, r => r.fulfill({ contentType: 'text/html', headers, body }));
}

export async function waitForLength(list, length, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (list.length < length && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
  return list.length;
}

// Captures in the extension's IndexedDB, reduced to JSON-safe fields (a
// Blob's size does not survive page.evaluate()'s serialization, so it is
// read inside the page).
export function localCaptures(ext) {
  return ext.evaluate(async () => (await (await import('./db.js')).listCaptures()).map(c => ({
    id: c.id, type: c.type, cloudType: c.cloudType, cloudAccountId: c.cloudAccountId, cloudStatus: c.cloudStatus, cloudRemoteId: c.cloudRemoteId || null,
    sourceUrl: c.sourceUrl, sourceTitle: c.sourceTitle, noteText: c.noteText, selectionText: c.selectionText, userTags: c.userTags, folderId: c.folderId,
    articleText: c.articleText, width: c.width, height: c.height, bytes: c.blob?.size ?? 0, provenance: c.provenance,
    collectionSubmission: c.collectionSubmission, detailsRevision: c.detailsRevision || 0,
  })));
}

// The toolbar badge text (flashed when the dock cannot show a result).
export async function waitForBadge(worker, text, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await worker.evaluate(() => chrome.action.getBadgeText({})) === text) return true;
    await new Promise(r => setTimeout(r, 25));
  }
  throw new Error('badge never showed ' + JSON.stringify(text));
}

export async function selectText(page, selector) {
  await page.evaluate(selector => {
    const range = document.createRange(); range.selectNodeContents(document.querySelector(selector));
    getSelection().removeAllRanges(); getSelection().addRange(range);
  }, selector);
}

// A real (trusted) mouse drag across an element's text.
export async function dragSelect(page, selector) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
}
