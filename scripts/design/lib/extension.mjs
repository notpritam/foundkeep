// Launches the real, unpacked extension in Chromium and stands in for the
// FoundKeep backend, the way tests/extension-dock-*.mjs do. Nothing here
// changes what the extension draws: it only decides what the "server"
// answers and how quickly.
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dockWorld } from '../../../tests/helpers/dock-world.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

export const SIGNED_IN = { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' };
export const FOLDERS = [{ id: 'f-reading', name: 'Reading list' }, { id: 'f-research', name: 'Research' }];
export const COLLECTIONS = [
  { id: 'col-design', title: 'Design references', visibility: 'public', canSubmit: true, requireApproval: false, canModerate: true },
  { id: 'col-team', title: 'Team reading', visibility: 'private', canSubmit: true, requireApproval: true, canModerate: false },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export { sleep };

/**
 * `allUrls` adds "<all_urls>" to a disposable copy of the extension (as the
 * screenshot tests do: captureVisibleTab needs it and nothing here can make
 * a fresh activeTab gesture). `patchManifest` edits that same copy, and
 * `extraFiles` ({ 'src/x.html': '…' }) adds pages to it — never to the source.
 */
export async function launchExtension({ repo, allUrls = false, patchManifest = null, extraFiles = null, viewport = { width: 1280, height: 800 }, deviceScaleFactor = 2, headless = true }) {
  let extension = path.join(repo, 'apps/extension');
  const copied = allUrls || !!patchManifest || !!extraFiles;
  if (copied) {
    const copy = await mkdtemp('/tmp/foundkeep-design-ext-');
    await cp(extension, copy, { recursive: true });
    const manifestPath = path.join(copy, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (allUrls) manifest.host_permissions.push('<all_urls>');
    patchManifest?.(manifest);
    await writeFile(manifestPath, JSON.stringify(manifest));
    for (const [file, text] of Object.entries(extraFiles || {})) await writeFile(path.join(copy, file), text);
    extension = copy;
  }
  const profile = await mkdtemp('/tmp/foundkeep-design-profile-');
  // channel 'chromium': headless-shell (the Playwright default) cannot load extensions.
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless, executablePath: process.env.CHROMIUM_PATH, viewport, deviceScaleFactor,
    args: ['--no-sandbox', '--hide-scrollbars', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  const close = async () => {
    await context.close().catch(() => {});
    await rm(profile, { recursive: true, force: true });
    if (copied) await rm(extension, { recursive: true, force: true });
  };
  return { context, worker, extensionId, origin, close };
}

/**
 * The FoundKeep backend and the fixture pages, on the host-permitted origin
 * (and x.com). Every other request to that origin gets a 404, so a capture
 * never reaches the real service. Knobs on the returned object: `hold` a
 * route until released, make it `fail`, or delay preference reads.
 */
export async function installBackend(context, { origin, pages = {}, xPages = {} }) {
  const server = {
    captures: new Map(), uploads: 0,
    fail: { organization: false, collections: false },
    holds: {},
    preferencesDelay: 0,
    hold(name) { let release; const gate = new Promise(resolve => { release = resolve; }); this.holds[name] = gate; return () => { delete this.holds[name]; release(); }; },
  };
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await context.route(`${origin}/**`, async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    if (pages[url.pathname]) return route.fulfill({ contentType: 'text/html', body: pages[url.pathname] });
    const gate = name => server.holds[name] || null;
    if (url.pathname === '/api/organization') {
      await gate('organization');
      if (server.fail.organization) return json(route, 500, { error: 'unavailable', message: 'Try again later.' });
      return json(route, 200, { folders: FOLDERS, tags: [{ name: 'Memory' }, { name: 'Reading' }], suggestedTags: ['Learning'] });
    }
    if (url.pathname === '/api/collections' && method === 'GET') {
      await gate('collections');
      if (server.fail.collections) return json(route, 500, { error: 'unavailable', message: 'Try again later.' });
      return json(route, 200, { collections: COLLECTIONS });
    }
    if (url.pathname === '/api/captures' && method === 'POST') {
      const body = request.postDataJSON();
      const id = `remote-${++server.uploads}`;
      server.captures.set(id, { id, sourceTitle: body.sourceTitle ?? null, noteText: body.noteText ?? null, userTags: body.userTags || [], folderId: body.folderId ?? null, updatedAt: 100 });
      return json(route, 201, { capture: { id, status: 'done' }, duplicate: false });
    }
    let match;
    if ((match = url.pathname.match(/^\/api\/mobile\/captures\/([\w-]+)$/))) {
      const capture = server.captures.get(match[1]);
      if (!capture) return json(route, 404, { error: 'not_found' });
      if (method === 'GET') return json(route, 200, { capture });
      const body = request.postDataJSON() || {};
      for (const key of ['sourceTitle', 'noteText', 'folderId', 'userTags']) if (key in body) capture[key] = body[key];
      capture.updatedAt++;
      return json(route, 200, { capture });
    }
    if (url.pathname === '/api/mobile/folders' && method === 'POST') {
      const body = request.postDataJSON() || {};
      return json(route, 201, { folder: { id: `f-${String(body.name || 'new').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: body.name } });
    }
    if (/^\/api\/collections\/[\w-]+\/entries$/.test(url.pathname)) return json(route, 201, { entry: { id: 'entry-1', status: 'approved' } });
    if (url.pathname === '/api/preferences') {
      if (server.preferencesDelay) await sleep(server.preferencesDelay);
      return json(route, 503, { error: 'unavailable' });
    }
    return json(route, 404, { error: 'not_found' });
  });
  await context.route('https://x.com/**', route => {
    const url = new URL(route.request().url());
    const body = xPages[url.pathname + url.search] || xPages[url.pathname];
    return body ? route.fulfill({ contentType: 'text/html', body }) : route.fulfill({ status: 404, body: '' });
  });
  for (const host of ['https://abs.twimg.com/**', 'https://pbs.twimg.com/**', 'https://twitter.com/**']) await context.route(host, route => route.fulfill({ status: 404, body: '' }));
  return server;
}

export const signIn = worker => worker.evaluate(state => chrome.storage.local.set({ atlasCustomer: state }), SIGNED_IN);
export const signOut = worker => worker.evaluate(() => chrome.storage.local.remove('atlasCustomer'));
/** The extension's own appearance setting ('system' | 'light' | 'dark'). */
export const appearance = (worker, value) => worker.evaluate(value => chrome.storage.local.set({ foundkeepAppearance: value }), value);

/** An extension page to import the extension's own modules from. */
export async function extensionPage(context, worker, file = 'src/dock-settings.html') {
  const page = await context.newPage();
  await page.goto(await worker.evaluate(file => chrome.runtime.getURL(file), file));
  return page;
}

/** The toolbar-icon path (summonDock), driven from an extension page. */
export const summon = (ext, url, opts = { expand: true }) => ext.evaluate(async ({ url, opts }) => {
  const [tab] = await chrome.tabs.query({ url });
  return (await import('./dock-control.js')).summonDock(tab.id, opts);
}, { url, opts });

export const tabFor = (ext, url) => ext.evaluate(async url => (await chrome.tabs.query({ url }))[0], url);
/** A keyboard shortcut / context-menu capture (startCapture), as the tests drive it. */
export const startCapture = (ext, tab, action, extra) => ext.evaluate(({ tab, action, extra }) => import('./dock-control.js').then(m => m.startCapture(tab, action, extra)), { tab, action, extra });

/** The dock's isolated world plus a faster poll than the test helper's. */
export async function dockHandle(page, extensionId) {
  const world = await dockWorld(page, extensionId);
  const until = async (expression, timeout = 8000, every = 20) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await world.evaluate(`!!(${expression})`)) return; await sleep(every); }
    throw new Error('Timed out waiting for ' + expression);
  };
  return { ...world, until };
}

export async function frameFor(page, fragment, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const frame = page.frames().find(f => f.url().includes(fragment));
    if (frame) return frame;
    await sleep(25);
  }
  throw new Error(`no frame with ${fragment}`);
}

/** A real (trusted) mouse drag across an element's text. */
export async function dragSelect(page, selector) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.move(box.x + 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 4, box.y + box.height - 8, { steps: 8 });
  await page.mouse.up();
}
