#!/usr/bin/env node
// Render FoundKeep's 3D objects (objects.js) to transparent WebP images for the
// app: apps/mobile/assets/images/finds/<name>.webp, plus a contact sheet.
//   /usr/bin/node design-system/assets-3d/render.mjs [name …]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const here = path.resolve(import.meta.dirname, '..');
const out = path.resolve(here, '../apps/mobile/assets/images/finds');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = url.startsWith('/samples/') ? path.join(here, 'public', url) : path.join(here, url.startsWith('/node_modules/') ? '' : 'assets-3d', url);
  const body = await readFile(file).catch(() => null);
  if (!body) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`${base}/index.html`); await page.waitForFunction(() => window.ready, null, { timeout: 30000 });
const names = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(async () => Object.keys((await import('./objects.js')).OBJECTS));
await mkdir(out, { recursive: true });
const tiles = [];
for (const name of names) {
  const data = await page.evaluate(n => window.renderObject(n, 480), name);
  await writeFile(path.join(out, `${name}.webp`), Buffer.from(data.split(',')[1], 'base64'));
  tiles.push({ name, data }); console.log(`✓ ${name}`);
}
const sheet = await browser.newPage({ viewport: { width: 1280, height: 400 } });
await sheet.setContent(`<body style="margin:0;padding:16px;display:grid;grid-template-columns:repeat(7,1fr);gap:12px;background:linear-gradient(#1678cc,#6cc0f1);font:600 12px system-ui;color:#fff">${tiles.map(t => `<figure style="margin:0;text-align:center"><img src="${t.data}" style="width:100%"><figcaption>${t.name}</figcaption></figure>`).join('')}</body>`);
await writeFile(path.join(here, 'assets-3d/contact-sheet.png'), await sheet.screenshot({ fullPage: true }));
await browser.close(); server.close();
console.log(`${tiles.length} objects → ${path.relative(process.cwd(), out)}`);
