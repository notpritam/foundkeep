#!/usr/bin/env node
// Serve the built design system (dist/) for the foundkeep-storybook service.
// Every response says Cache-Control: no-cache, so a browser always checks for
// a newer build (cheaply, with ETag/If-None-Match) instead of showing a story
// list from hours ago — python's http.server sent no caching rules at all.
//   /usr/bin/node design-system/scripts/serve.mjs [port] [dir]
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.argv[2] || 8814);
const ROOT = path.resolve(process.argv[3] || path.join(import.meta.dirname, '../dist'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.zip': 'application/zip', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4' };

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://storybook').pathname);
    let file = path.resolve(ROOT, '.' + pathname);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = path.join(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info?.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
    const headers = { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', etag, 'last-modified': info.mtime.toUTCString() };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    res.writeHead(200, { ...headers, 'content-length': info.size });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).pipe(res);
  } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
}).listen(PORT, '127.0.0.1', () => console.log(`FoundKeep Storybook on http://127.0.0.1:${PORT} (${ROOT})`));
