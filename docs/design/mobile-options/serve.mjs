import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8934);
const choiceFile = process.env.FOUNDKEEP_CHOICE_FILE || path.join(process.env.BB_THREAD_STORAGE || '/tmp', 'foundkeep-mobile-direction-choices.json');
const allowedScreens = new Set(['welcome', 'sign-in', 'register', 'onboarding', 'gallery', 'saved', 'new-note', 'organize', 'settings', 'batch', 'empty', 'recover', 'recovery-code', 'oauth']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (req.method === 'POST' && url.pathname === '/choice') {
      if (!req.headers['content-type']?.startsWith('application/json')) { res.writeHead(415).end(); return; }
      if (req.headers.origin && req.headers.host && new URL(req.headers.origin).host !== req.headers.host && new URL(req.headers.origin).host !== req.headers['x-forwarded-host']) { res.writeHead(403).end(); return; }
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) { res.writeHead(413).end(); return; } }
      const { choices } = JSON.parse(body);
      if (!choices || Array.isArray(choices) || typeof choices !== 'object' || !Object.keys(choices).length || Object.entries(choices).some(([screen, variant]) => !allowedScreens.has(screen) || !['a', 'b', 'c'].includes(variant))) { res.writeHead(400).end(); return; }
      await mkdir(path.dirname(choiceFile), { recursive: true });
      const temp = `${choiceFile}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify({ choices, updatedAt: new Date().toISOString(), preview: 'mobile-options' }, null, 2), { mode: 0o600 });
      await rename(temp, choiceFile);
      res.writeHead(204, { 'cache-control': 'no-store' }).end(); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root, `.${requested}`);
    if (!file.startsWith(root + path.sep) || !types[path.extname(file)] || !(file === path.join(root, 'index.html') || file === path.join(root, 'styles.css') || file === path.join(root, 'app.js') || file.startsWith(path.join(root, 'assets') + path.sep))) { res.writeHead(404).end(); return; }
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)], 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self' https://*.getbb.app" });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Foundkeep mobile options at port ${server.address().port}. Choices: ${choiceFile}`));
export { server };
