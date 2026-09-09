import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const root = path.resolve('dist-gallery-preview');
const output = path.resolve('../../.impeccable/review/gallery');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url || '/', 'http://local').pathname);
    let file = path.join(root, requested === '/' ? 'index.html' : requested);
    if (!file.startsWith(root) || !(await stat(file).catch(() => null))?.isFile()) file = path.join(root, 'index.html');
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(await readFile(file));
  } catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Screenshot server did not start.');
const base = `http://127.0.0.1:${address.port}`;

const now = Date.parse('2026-09-08T10:30:00.000Z');
const baseCapture = { clientId: 'store', batchId: null, status: 'done', selectionText: null, noteText: null, articleText: null, summary: null, ocrText: null, category: null, tags: [], blobUrl: null, fileName: null, fileMime: null, fileBytes: 0, fileUrl: null, width: null, height: null, createdAt: now, updatedAt: now, enrichError: null, provenance: null };
const captures = [
  { ...baseCapture, id: 'bookmark', type: 'bookmark', sourceTitle: 'A field guide to small details', sourceUrl: 'https://example.com/field-guide', summary: 'Why the smallest observations often become the ideas worth keeping.', capturedAt: now, provenance: { pageUrl: 'https://example.com/field-guide?from=reading', canonicalUrl: 'https://example.com/field-guide', siteName: 'Example Review', description: 'A field guide for attentive work.', authors: ['Mina Vale'], captureMethod: 'ios-share-url' } },
  { ...baseCapture, id: 'document', clientId: 'document', batchId: 'batch-files', type: 'document', sourceTitle: 'Autumn research brief', sourceUrl: 'https://example.com/research', fileName: 'Autumn Research Brief.pdf', fileMime: 'application/pdf', fileBytes: 2_482_190, fileUrl: '/api/captures/document/file', capturedAt: now - 3_600_000, provenance: { pageUrl: 'https://example.com/research', siteName: 'Field Office', sourceApplication: 'Files', originalFileName: 'Autumn Research Brief.pdf', declaredMime: 'application/pdf', byteSize: 2_482_190 } },
  { ...baseCapture, id: 'audio', clientId: 'audio', batchId: 'batch-files', type: 'audio', sourceTitle: null, sourceUrl: null, fileName: 'Voice memo — launch thought.m4a', fileMime: 'audio/mp4', fileBytes: 842_119, fileUrl: '/api/captures/audio/file', capturedAt: now - 3_600_001, provenance: { sourceApplication: 'Voice Memos', originalFileName: 'Voice memo — launch thought.m4a', declaredMime: 'audio/mp4', byteSize: 842_119 } },
  { ...baseCapture, id: 'image', clientId: 'image', type: 'image', sourceTitle: 'Reference shelf', sourceUrl: 'https://example.com/reference', fileName: 'reference-shelf.jpg', fileMime: 'image/jpeg', fileBytes: 1_115_441, fileUrl: '/api/captures/image/file', capturedAt: now - 86_400_000, provenance: { pageUrl: 'https://example.com/reference', siteName: 'Studio Notes', sourceApplication: 'Photos' } },
  { ...baseCapture, id: 'note', clientId: 'note', type: 'note', sourceTitle: null, sourceUrl: null, noteText: 'Keep the object simple enough that saving it never interrupts the thought.', capturedAt: now - 172_800_000 },
  { ...baseCapture, id: 'video', clientId: 'video', type: 'video', sourceTitle: null, sourceUrl: null, fileName: 'Prototype walkthrough.mov', fileMime: 'video/quicktime', fileBytes: 8_641_923, fileUrl: '/api/captures/video/file', capturedAt: now - 259_200_000, provenance: { sourceApplication: 'Photos' } },
];
captures[0].folder = { id: 'reading', name: 'Reading' }; captures[0].folderId = 'reading'; captures[0].userTags = ['Inspiration'];
captures[0].provenance.leadImageUrl = 'https://images.example.com/room.webp';
captures[0].articleText = 'A saved article. '.repeat(6000);
for (let i = 0; i < 18; i++) captures.push({ ...captures[0], id: `extra-${i}`, sourceTitle: `A thoughtful reference ${i}`, folderId: null, folder: null, userTags: [] });
let folders = [{ id: 'reading', name: 'Reading', count: 1 }];
let writes = 0;
const art = await readFile('assets/images/welcome-room.webp');
const account = { id: 'review', email: 'review@foundkeep.app', name: 'App Review', createdAt: now - 999_999 };
const policy = { schemaVersion: 1, revision: 2, cacheSeconds: 300, minimumVersion: '1.0.0', features: { notifications: true }, capture: { bookmark: true, selection: true, note: true, image: true, video: true, audio: true, document: true, file: true }, limits: { fileBytes: 52_428_800, textCharacters: 50_000, articleCharacters: 500_000, batchItems: 20, uploadTimeoutSeconds: 15 }, notice: null };

const executablePath = process.env.CHROMIUM_PATH || '/home/pritam/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const browser = await chromium.launch({ headless: true, executablePath });
const makeContext = async signedIn => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'no-preference', colorScheme: 'light' });
  if (signedIn) await context.addInitScript(() => localStorage.setItem('foundkeep-device-token', 'store-screenshot-token'));
  await context.route('https://images.example.com/**', async route => { assert.equal(route.request().headers().authorization, undefined); return route.fulfill({ contentType: 'image/webp', body: art }); });
  await context.route('https://foundkeep.app/**', async route => {
    const url = new URL(route.request().url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/mobile-policy.json') return json(policy);
    if (url.pathname === '/api/mobile/me') return json({ account, connectionId: 'review-device', usage: { captures: captures.length, bytes: 13_081_673, maxCaptures: 1000, maxBytes: 209_715_200 } });
    if (url.pathname === '/api/mobile/organization') return json({ folders, tags: [{ name: 'Inspiration', count: 1 }], suggestedTags: ['Work', 'Personal'], suggestedFolders: ['Reading', 'Projects'] });
    if (url.pathname === '/api/mobile/folders') { const folder = { id: `folder-${folders.length}`, name: route.request().postDataJSON().name, count: 0 }; folders.push(folder); return json({ folder }); }
    if (url.pathname === '/api/captures') { const body = route.request().postDataJSON(); const capture = { ...baseCapture, ...body, id: 'new-note', sourceTitle: body.noteText, sourceUrl: null, folder: folders.find(folder => folder.id === body.folderId) || null }; captures.unshift(capture); writes++; return json({ capture }); }
    if (url.pathname === '/api/mobile/captures') {
      await new Promise(resolve => setTimeout(resolve, 800));
      let list = captures; const folder = url.searchParams.get('folderId'); if (folder) list = list.filter(item => folder === 'unfiled' ? !item.folderId : item.folderId === folder);
      return json({ captures: list, total: list.length, nextCursor: null });
    }
    if (/\/(blob|file)$/.test(url.pathname)) return route.fulfill({ contentType: 'image/webp', body: art });
    if (url.pathname.endsWith('/related')) return json({ items: url.pathname.includes('/document/') ? [] : [{ capture: captures.find(item => item.id === 'document'), reasons: [{ kind: 'tag', label: 'Shared tag: Inspiration' }] }] });
    if (url.pathname.startsWith('/api/mobile/captures/')) {
      const id = url.pathname.split('/')[4];
      const capture = captures.find(capture => capture.id === id);
      if (route.request().method() === 'PUT') { Object.assign(capture, route.request().postDataJSON(), { updatedAt: now + 1 }); writes++; }
      return json({ capture });
    }
    return json({ ok: true });
  });
  return context;
};
const ready = async page => { await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(120); };
const shot = async (page, name) => page.screenshot({ path: path.join(output, name), animations: 'disabled' });

try {
  const context = await makeContext(true); const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByTestId('collection-header').waitFor();
  await page.getByRole('progressbar', { name: 'Loading your collection' }).waitFor();
  await shot(page, '01-shimmer.png');
  await page.getByRole('button', { name: /Open Link A field guide/ }).waitFor(); await ready(page);
  const dock = page.getByTestId('floating-dock');
  const galleryTab = page.getByRole('tab', { name: 'Gallery', exact: true });
  assert.equal(await galleryTab.getAttribute('aria-selected'), 'true');
  const expandedTab = await galleryTab.boundingBox();
  assert.ok(expandedTab.height >= 44);
  const addBox = await page.getByTestId('dock-new-note').boundingBox();
  assert.ok(addBox.width >= 44 && addBox.height >= 44);
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByText('Settings.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'You', exact: true }).getAttribute('aria-selected'), 'true');
  await galleryTab.click(); await page.getByTestId('collection-header').waitFor();
  await shot(page, '02-gallery.png');
  const header = page.getByTestId('collection-header'); const before = await header.boundingBox(); const list = page.getByTestId('gallery-list');
  await list.evaluate(el => { el.scrollTop = 650; }); await page.waitForTimeout(200);
  assert.ok(await list.evaluate(el => el.scrollTop) > 0); const after = await header.boundingBox(); assert.equal(before.y, after.y); assert.equal(before.height, after.height);
  const controls = page.getByTestId('collection-expanded-controls');
  assert.equal(await controls.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  // React Native Web always reports a screen reader; preserve expanded tab labels.
  assert.equal((await galleryTab.boundingBox()).width, expandedTab.width);
  await shot(page, '03-compact-header.png');
  await list.evaluate(el => { el.scrollTop = 450; }); await page.waitForTimeout(150);
  assert.notEqual(await controls.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  await page.getByRole('button', { name: 'Show search and filters' }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Search saved items' }).evaluate(el => el === document.activeElement), true);
  await page.getByRole('textbox', { name: 'Search saved items' }).blur();
  await list.evaluate(el => { el.scrollTop = el.scrollHeight; }); await page.waitForTimeout(200);
  const footer = await page.getByText('24 finds · yours to keep', { exact: true }).boundingBox();
  assert.ok(footer.y + footer.height < (await dock.boundingBox()).y, 'last list content must clear the floating dock');
  await list.evaluate(el => { el.scrollTop = 0; });
  await page.setViewportSize({ width: 320, height: 680 }); await page.waitForTimeout(500);
  const narrowDock = await dock.boundingBox();
  assert.ok(narrowDock.x >= 0 && narrowDock.x + narrowDock.width <= 320);
  for (const tab of [galleryTab, page.getByRole('tab', { name: 'You', exact: true })]) {
    const box = await tab.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
    assert.ok(box.x >= 0 && box.x + box.width <= 320);
  }
  await shot(page, '09-narrow-floating-dock.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Filter by folder or tag' }).click();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.waitForTimeout(1000);
  assert.equal(await page.getByRole('button', { name: /^Open Link/ }).count(), 1);
  await page.getByRole('button', { name: /Open Link A field guide/ }).click();
  await page.getByText('Original source', { exact: true }).waitFor();
  assert.ok((await page.getByText('A saved article.', { exact: false }).textContent()).length > 64000);
  const related = page.getByRole('button', { name: /^Open related save Autumn research brief/ });
  await related.waitFor();
  await page.getByRole('button', { name: 'Show source details' }).click();
  await page.getByText('https://example.com/field-guide', { exact: true }).waitFor();
  const editAction = page.getByRole('button', { name: 'Edit and organize' });
  const editBox = await editAction.boundingBox(); assert.ok(editBox.width <= 48 && editBox.height >= 44);
  const sourceBox = await page.getByRole('button', { name: 'Open original source' }).boundingBox(); assert.ok(sourceBox.width <= 48 && sourceBox.height >= 44);
  await related.click(); await page.waitForURL('**/capture/document'); await page.getByRole('button', { name: 'Open or share file' }).waitFor();
  await shot(page, '08-compact-detail.png');
  await page.goto(base + '/capture/bookmark');
  await page.getByRole('button', { name: 'Edit and organize' }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).waitFor(); await page.waitForFunction(() => document.querySelector('[aria-label="Title"]')?.value === 'A field guide to small details'); await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A better title');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('A better title', { exact: true }).waitFor({ timeout: 8000 });
  await page.goto(base + '/collection'); await page.getByRole('button', { name: 'Create a note' }).click();
  await page.getByRole('textbox', { name: 'Your note', exact: true }).waitFor();
  assert.equal(await page.getByTestId('floating-dock').isVisible(), false, 'dock should stay within its tab screens');
  await page.getByRole('textbox', { name: 'Your note', exact: true }).fill('Remember this gallery idea');
  await page.getByRole('button', { name: 'Choose folder and tags' }).click();
  await page.getByRole('textbox', { name: 'Create a folder', exact: true }).fill('Weekend ideas');
  await page.getByRole('button', { name: 'Create folder', exact: true }).click();
  await page.getByRole('textbox', { name: 'Create a tag', exact: true }).fill('my idea');
  await page.getByRole('button', { name: 'Add tag', exact: true }).click();
  await shot(page, '04-organize.png');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.getByRole('button', { name: 'Open Note Remember this gallery idea', exact: true }).waitFor();
  assert.equal(captures[0].folder.name, 'Weekend ideas'); assert.deepEqual(captures[0].userTags, ['my idea']); assert.equal(writes, 2);
  await shot(page, '05-organized-save.png'); assert.deepEqual(errors, []); await context.close();
  const signedOut = await makeContext(false); const login = await signedOut.newPage();
  await login.goto(base + '/sign-in'); await login.getByText('Welcome back.', { exact: true }).waitFor(); await ready(login);
  await shot(login, '06-sign-in.png');
  assert.ok((await login.getByText('By continuing,', { exact: false }).textContent()).includes('Terms and Privacy Policy'));
  await login.goto(base); await login.getByText('Found it?', { exact: false }).waitFor(); await ready(login); await shot(login, '07-welcome.png'); await signedOut.close();
  console.log('Gallery checks passed: floating dock navigation, narrow layout, footer clearance, quick-add, shimmer, collapsing/revealing header, compact actions, related navigation, private-safe images, folder filter, full article, edit invalidation, organized note save, legal copy. Synthetic fixtures; native checks separate.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
