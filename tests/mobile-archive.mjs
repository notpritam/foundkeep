import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
const root = path.resolve(process.env.MOBILE_EXPORT_DIR || '/tmp/foundkeep-archive-mobile-web');
const output = process.env.EVIDENCE_DIR || '/tmp/foundkeep-archive-browser';
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
 const pathname = new URL(request.url, 'http://local').pathname;
 let file = path.join(root, pathname);
 if (!file.startsWith(root) || !(await stat(file).catch(() => null))?.isFile()) file = path.join(root, 'index.html');
 response.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.ttf') ? 'font/ttf' : 'application/octet-stream' });
 response.end(await readFile(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/home/pritam/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const account = { id: 'archive-test', email: 'archive@example.test', name: 'Archive test' };
const capture = { id: 'one', clientId: 'one', type: 'note', sourceTitle: 'Keep for later', noteText: 'Original notes remain safe.', status: 'done', archivedAt: null, createdAt: Date.now(), capturedAt: Date.now(), updatedAt: 1, tags: [], userTags: [] };
const policy = JSON.parse(await readFile('apps/web/mobile-policy.json', 'utf8'));
try {
 await context.addInitScript(() => localStorage.setItem('dev-foundkeep-device-token', 'archive-token'));
 await context.route('https://dev.foundkeep.app/**', async route => {
  const req = route.request(), url = new URL(req.url());
  const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  if (url.pathname === '/mobile-policy.json') return json(policy);
  if (url.pathname === '/api/mobile/me') return json({ account, connectionId: 'device', usage: { captures: 1, bytes: 100, maxCaptures: 10000, maxBytes: 104857600 } });
  if (url.pathname === '/api/mobile/captures') { const captures = Boolean(capture.archivedAt) === (url.searchParams.get('archived') === 'true') ? [capture] : []; return json({ captures, total: captures.length, nextCursor: null }); }
  if (url.pathname === '/api/mobile/captures/one/archive') {
   const body = req.postDataJSON(); assert.equal(body.expectedUpdatedAt, capture.updatedAt);
   capture.archivedAt = body.archived ? Date.now() : null; capture.updatedAt++;
   return json({ capture });
  }
  if (url.pathname === '/api/mobile/captures/one') return json({ capture });
  if (url.pathname.endsWith('/related')) return json({ items: [] });
  if (url.pathname === '/api/mobile/organization') return json({ folders: [], tags: [], suggestedTags: [], suggestedFolders: [] });
  return json({ ok: true });
 });
 const page = await context.newPage();
 const errors = []; page.on('pageerror', error => errors.push(error.message));
 const base = `http://127.0.0.1:${server.address().port}`;
 await page.goto(base + '/collection');
 await page.getByText('The collection.', { exact: true }).waitFor();
 await page.getByRole('button', { name: /Open Note Keep for later/i }).click();
 await page.getByRole('button', { name: 'Archive save', exact: true }).click();
 await page.getByText('Archived · your files and notes are kept', { exact: true }).waitFor();
 await page.screenshot({ path: path.join(output, 'mobile-archived-detail.png') });
 await page.goto(base + '/collection');
 await page.getByText('A home for your good finds.', { exact: true }).waitFor();
 await page.getByRole('button', { name: 'Open archive', exact: true }).click();
 await page.getByText('Archive.', { exact: true }).waitFor();
 await page.getByRole('button', { name: /Open Note Keep for later/i }).waitFor();
 for (const width of [390, 320]) {
  await page.setViewportSize({ width, height: 844 });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
  await page.waitForFunction(() => { const cell = document.querySelector('[data-testid="gallery-cell-one"]'); return cell && getComputedStyle(cell).opacity === '1'; });
  await page.getByRole('button', { name: /Open Note Keep for later/i }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, `mobile-archive-${width}.png`) });
 }
 await page.getByRole('button', { name: /Open Note Keep for later/i }).click();
 await page.getByRole('button', { name: 'Restore save', exact: true }).click();
 await page.getByRole('button', { name: 'Archive save', exact: true }).waitFor();
 await page.goto(base + '/collection');
 await page.getByRole('button', { name: /Open Note Keep for later/i }).waitFor();
 assert.equal(capture.archivedAt, null); assert.equal(capture.noteText, 'Original notes remain safe.');
 assert.deepEqual(errors, []);
 console.log('PASS compiled mobile archive/restore, archive view, retained notes, narrow-screen layouts');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
