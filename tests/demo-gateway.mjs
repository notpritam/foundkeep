// The live demo's gateway signs private image requests in as the demo account.
// A library screen asks for many images at once: that must be one sign-in,
// not one per image (each sign-in adds a connected device and spends the
// backend's sign-in rate limit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

test('many images at once share one demo sign-in', { timeout: 20000 }, async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fk-gateway-'));
  await writeFile(path.join(dir, 'state.json'), JSON.stringify({ email: 'demo@example.test', password: 'x' }));
  await writeFile(path.join(dir, 'index.html'), '<html><head></head><body></body></html>');
  let logins = 0, refuse = false;
  const tokens = new Set();
  const site = createServer((req, res) => {
    if (req.url === '/api/mobile/login') {
      logins++;
      if (refuse) { res.writeHead(429).end('{"error":"rate_limited"}'); return; }
      const token = 'token-' + logins; tokens.add(token);
      setTimeout(() => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ token })), 50);
      return;
    }
    const ok = tokens.has(String(req.headers.authorization || '').replace('Bearer ', ''));
    res.writeHead(ok ? 200 : 401, { 'content-type': ok ? 'image/jpeg' : 'application/json' }).end(ok ? 'jpeg' : '{}');
  });
  const sitePort = await listen(site);
  const probe = createServer(); const port = await listen(probe); probe.close();
  const gateway = spawn('/usr/bin/node', [path.join(root, 'deploy/demo/gateway.mjs')], { env: { ...process.env, DEMO_GATEWAY_PORT: String(port), DEMO_SITE_URL: `http://127.0.0.1:${sitePort}`, DEMO_APP_DIR: dir, DEMO_STATE: path.join(dir, 'state.json') }, stdio: 'pipe' });
  t.after(async () => { gateway.kill(); site.close(); await rm(dir, { recursive: true, force: true }); });
  await new Promise(resolve => gateway.stdout.once('data', resolve));

  const image = i => fetch(`http://127.0.0.1:${port}/api/mobile/captures/c${i}/blob?v=1`).then(r => r.status);
  const statuses = await Promise.all(Array.from({ length: 8 }, (_, i) => image(i)));
  assert.deepEqual(statuses, Array(8).fill(200), 'every image is served');
  assert.equal(logins, 1, 'one sign-in for all of them');

  // A refused sign-in never replaces a token that still works.
  refuse = true;
  assert.equal(await image(9), 200);
  assert.equal(logins, 1);
});
