import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.resolve('dist-store-preview');
const output = path.resolve('../../docs/app-store/screenshots/en-US/6.9-inch');
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
const account = { id: 'review', email: 'review@foundkeep.app', name: 'App Review', createdAt: now - 999_999 };
const policy = { schemaVersion: 1, revision: 1, cacheSeconds: 300, minimumVersion: '1.0.0', capture: { bookmark: true, selection: true, note: true, image: true, video: true, audio: true, document: true, file: true }, limits: { fileBytes: 52_428_800, textCharacters: 50_000, articleCharacters: 500_000, batchItems: 20, uploadTimeoutSeconds: 15 }, notice: null };

const executablePath = process.env.CHROMIUM_PATH || '/home/pritam/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const browser = await chromium.launch({ headless: true, executablePath });
const makeContext = async signedIn => {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, reducedMotion: 'reduce', colorScheme: 'light' });
  if (signedIn) await context.addInitScript(() => localStorage.setItem('foundkeep-device-token', 'store-screenshot-token'));
  await context.route('https://foundkeep.app/**', async route => {
    const url = new URL(route.request().url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/mobile-policy.json') return json(policy);
    if (url.pathname === '/api/mobile/me') return json({ account, connectionId: 'review-device', usage: { captures: captures.length, bytes: 13_081_673, maxCaptures: 1000, maxBytes: 209_715_200 } });
    if (url.pathname === '/api/mobile/captures') return json({ captures, total: captures.length, nextCursor: null });
    if (url.pathname.startsWith('/api/mobile/captures/')) {
      const id = url.pathname.split('/')[4];
      return json({ capture: captures.find(capture => capture.id === id) });
    }
    return json({ ok: true });
  });
  return context;
};
const ready = async page => { await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(120); };
const shot = async (page, name) => page.screenshot({ path: path.join(output, name), animations: 'disabled' });

try {
  const welcomeContext = await makeContext(false);
  const welcome = await welcomeContext.newPage();
  await welcome.goto(base); await ready(welcome); await welcome.getByText('Found it?').waitFor();
  await shot(welcome, '01-welcome.png'); await welcomeContext.close();

  const context = await makeContext(true);
  const page = await context.newPage();
  await page.goto(base); await page.getByText('Your collection.').waitFor(); await ready(page);
  await shot(page, '02-collection.png');
  await page.getByRole('button', { name: /Open Link A field guide/ }).click(); await page.getByText('Original source', { exact: true }).waitFor(); await ready(page);
  await shot(page, '03-source-detail.png');
  await page.getByText('New note', { exact: true }).click(); await page.getByText('A thought worth keeping').waitFor(); await ready(page);
  await shot(page, '04-new-note.png');
  await page.getByText('Settings', { exact: true }).click(); await page.getByText('Live configuration').waitFor(); await ready(page);
  await shot(page, '05-settings.png');
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(`Rendered five Foundkeep screenshots at ${output}`);
