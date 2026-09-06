import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
let browser, server, base, dataDir;
const now = Date.now();
const account = { id: 'test-account', email: 'collector@example.test', name: 'Alex', createdAt: now };
const fixtureCaptures = [
  { id: 'photo', type: 'image', sourceTitle: 'An unexpected doorway', sourceUrl: 'https://example.com/architecture', blobUrl: '/api/captures/photo/blob', tags: ['architecture', 'inspiration'] },
  { id: 'highlight', type: 'selection', sourceTitle: 'A thought on collecting', selectionText: 'A good collection starts with noticing. Leave a little room for the unexpected.', sourceUrl: 'https://example.com/field-notes', tags: ['ideas'] },
  { id: 'note', type: 'note', noteText: 'Bring a little more intention to the things we keep. Start with the details worth returning to.', tags: [] },
  { id: 'bookmark', type: 'bookmark', sourceTitle: 'A field guide to seeing', articleText: 'A few observations about everyday places, objects and the details that make them memorable.', sourceUrl: 'https://example.com/field-guide', tags: [] },
  { id: 'image-2', type: 'screenshot', sourceTitle: 'Light, material, rhythm', blobUrl: '/api/captures/image-2/blob', sourceUrl: 'https://example.com/studio', tags: [] },
  { id: 'note-2', type: 'note', noteText: 'Things to come back to: olive greens, concrete textures, and this particular afternoon light.', tags: [] },
].map((capture, index) => ({ clientId: capture.id, status: 'done', capturedAt: now - index * 86400000, ...capture }));
before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'atlas-customer-web-'));
  const code = `import { createApp } from './apps/backend/src/app.ts'; import { openDb } from './apps/backend/src/db.ts'; import { config } from './apps/backend/src/config.ts'; let app; const server = Bun.serve({hostname:'127.0.0.1',port:0,fetch:req=>app.fetch(req,{clientIp:'127.0.0.1'})}); config.customerOrigin=server.url.origin; app=createApp(openDb()); console.log('READY '+server.url.origin);`;
  server = spawn(process.env.BUN_BIN || process.env.BUN_PATH || 'bun', ['--eval', code], { cwd: process.cwd(), env: { ...process.env, ATLAS_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((resolve, reject) => {
    let output = ''; const timeout = setTimeout(() => reject(new Error(`Customer test server timed out: ${output}`)), 10000);
    server.stdout.on('data', chunk => { output += chunk; const match = output.match(/READY (http:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    server.stderr.on('data', chunk => { output += chunk; });
    server.on('error', error => { clearTimeout(timeout); reject(error); }); server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Customer test server exited ${code}: ${output}`)); });
  });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); server?.kill(); await rm(dataDir, { recursive: true, force: true }); });

async function pageFor(t, { mock = true, captures = fixtureCaptures, extensionAccount = null, extensionInstalled = true, width = 1440, handler } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
  t.after(() => context.close());
  const requests = []; const model = { account, captures: [...captures], connections: extensionAccount?.id === account.id ? [{ id: 'connected-browser', name: 'Chrome', createdAt: now, lastSeenAt: now }] : [], usage: null };
  if (mock) await context.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const body = request.postDataJSON(); requests.push({ path: url.pathname, query: url.searchParams, method: request.method(), body });
    const response = handler ? await handler({ request, url, body, model }) : undefined;
    if (response) return route.fulfill({ status: response.status || 200, contentType: 'application/json', body: JSON.stringify(response.body) });
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.endsWith('/blob')) return route.fulfill({ contentType: 'image/webp', path: path.resolve('apps/web/assets/studio-architecture-640.webp') });
    if (url.pathname === '/api/me') return json({ account: model.account, connections: model.connections, usage: { captures: model.captures.length, bytes: 1432020, maxCaptures: 1000, maxBytes: 209715200 } });
    if (url.pathname === '/api/captures' && request.method() === 'GET') {
      const items = model.captures.filter(capture => (!url.searchParams.get('type') || capture.type === url.searchParams.get('type')) && (!url.searchParams.get('q') || JSON.stringify(capture).toLowerCase().includes(url.searchParams.get('q').toLowerCase())));
      return json({ captures: items, nextCursor: null, total: items.length });
    }
    if (url.pathname === '/api/captures' && request.method() === 'POST') { const capture = { id: 'new-note', status: 'pending', ...body }; model.captures.unshift(capture); return json({ capture, duplicate: false }); }
    if (url.pathname.startsWith('/api/captures/')) {
      const id = url.pathname.split('/').at(-1);
      if (request.method() === 'DELETE') { model.captures = model.captures.filter(item => item.id !== id); return json({ ok: true }); }
      const capture = model.captures.find(item => item.id === id);
      return capture ? json({ capture }) : route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) });
    }
    if (url.pathname === '/api/pairing') return json({ code: 'test-single-use-pairing-code', expiresAt: now + 300000 });
    if (url.pathname === '/api/auth/password') { model.connections = []; return json({ ok: true, recoveryCode: 'new-test-recovery-code' }); }
    if (url.pathname === '/api/auth/register' || url.pathname === '/api/auth/recover') return json({ account, recoveryCode: 'test-recovery-code' });
    if (url.pathname === '/api/auth/login') return json({ account });
    if (url.pathname === '/api/account/export') return json({ captures: model.captures });
    if (url.pathname.startsWith('/api/connections/')) { model.connections = []; return json({ ok: true }); }
    return json({ ok: true });
  });
  await context.route('**/customer-config.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ extensionIds: ['mjfcgmboaijfcaanepdipbgmipnccnpn'], storeUrl: null }) }));
  await context.addInitScript(({ extensionAccount, extensionInstalled, account }) => {
    window.__extensionMessages = [];
    if (!extensionInstalled) return;
    let connected = extensionAccount;
    window.chrome = { runtime: { sendMessage(id, message, callback) {
      window.__extensionMessages.push({ id, message });
      if (message.kind === 'atlas-ping') callback({ ok: true, version: '1.4.0', account: connected });
      if (message.kind === 'atlas-connect') { connected = account; callback({ ok: true, account }); }
    } } };
  }, { extensionAccount, extensionInstalled, account });
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No unhandled browser errors'));
  return { page, requests, model, context };
}
async function openLibrary(page) { await page.goto(`${base}/dashboard.html`); await page.locator('#new-note:not([disabled])').waitFor(); await page.locator('#capture-grid[aria-busy="false"]').waitFor({ state: 'attached' }); }

test('real API: signup, notes, logout, login, recovery and account deletion', async t => {
  const { page } = await pageFor(t, { mock: false });
  await page.goto(`${base}/auth.html?mode=signup`);
  await page.locator('#name').fill('Browser QA'); await page.locator('#email').fill(`browser-${now}@example.test`); await page.locator('#password').fill('A-long-test-password-2096');
  await page.locator('#auth-submit').click(); await page.locator('#recovery-save').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#continue-dashboard').isDisabled(), true);
  const originalRecovery = await page.locator('#new-recovery-code').textContent(); assert.ok(originalRecovery.length > 20);
  const downloaded = page.waitForEvent('download'); await page.locator('#download-recovery').click(); assert.equal((await downloaded).suggestedFilename(), 'atlas-recovery-code.txt');
  await page.locator('#recovery-saved').check(); await page.locator('#continue-dashboard').click(); await page.waitForURL('**/dashboard.html');
  await page.locator('#new-note:not([disabled])').click(); await page.locator('#note-text').fill('This note was saved through the real API.');
  const saved = page.waitForResponse(response => response.url().endsWith('/api/captures') && response.request().method() === 'POST');
  await page.locator('#save-note').click(); assert.equal((await saved).status(), 201);
  await page.locator('.capture-open').waitFor(); assert.match(await page.locator('#capture-grid').textContent(), /real API/);
  await page.locator('.capture-open').click(); await page.locator('#detail-actions').waitFor({ state: 'visible' }); assert.match(await page.locator('#detail-body').textContent(), /real API/);
  await page.locator('#delete-capture').click(); await page.locator('#confirm-accept').click(); await page.locator('#library-state').waitFor({ state: 'visible' });
  await page.locator('#open-account').click(); await page.locator('#logout').click(); await page.locator('#confirm-accept').click(); await page.waitForURL('**/auth.html?mode=login');
  await page.locator('#email').fill(`browser-${now}@example.test`); await page.locator('#password').fill('A-long-test-password-2096'); await page.locator('#auth-submit').click(); await page.waitForURL('**/dashboard.html');
  await page.locator('#new-note:not([disabled])').waitFor(); await page.locator('#open-account').click(); await page.locator('#logout').click(); await page.locator('#confirm-accept').click(); await page.waitForURL('**/auth.html?mode=login');
  await page.locator('[data-mode="recover"]').click(); await page.locator('#email').fill(`browser-${now}@example.test`); await page.locator('#recovery-code').fill(originalRecovery); await page.locator('#password').fill('A-new-recovered-password-2096'); await page.locator('#auth-submit').click(); await page.locator('#recovery-save').waitFor({ state: 'visible' });
  assert.notEqual(await page.locator('#new-recovery-code').textContent(), originalRecovery); await page.locator('#recovery-saved').check(); await page.locator('#continue-dashboard').click(); await page.waitForURL('**/dashboard.html');
  await page.locator('#new-note:not([disabled])').waitFor(); await page.locator('#open-account').click(); await page.locator('#open-delete-account').click(); await page.locator('#delete-password').fill('An-incorrect-password-2096'); await page.locator('#delete-acknowledged').check(); await page.locator('#delete-account-submit').click();
  await page.locator('#delete-account-error').waitFor({ state: 'visible' }); assert.equal(await page.locator('#session-dialog').isVisible(), false, 'Wrong password must not expire a valid session');
  await page.locator('#delete-password').fill('A-new-recovered-password-2096'); await page.locator('#delete-account-submit').click(); await page.waitForURL('**/auth.html?mode=signup&deleted=1');
});

test('library search, filter and detail render capture text safely', async t => {
  const malicious = { id: 'unsafe', type: 'note', noteText: '<img src=x onerror="window.__xss=true">', sourceTitle: '<script>alert(1)</script>', sourceUrl: 'javascript:window.__xss=true', blobUrl: 'https://evil.example/private', tags: ['<img src=x>'], capturedAt: now, status: 'done' };
  const { page } = await pageFor(t, { captures: [malicious, ...fixtureCaptures] });
  await openLibrary(page); await page.locator('[data-type="note"]').click(); await page.locator('.capture-open').first().click();
  await page.locator('#detail-actions').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#detail-body script,#detail-body img,#detail-body a').count(), 0);
  assert.match(await page.locator('#detail-body').textContent(), /<script>/);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  await page.keyboard.press('Escape'); await page.locator('#search').fill('no-such-capture'); await page.getByRole('heading', { name: 'No finds this time.' }).waitFor();
  await page.getByRole('button', { name: 'Clear filters' }).click(); await page.locator('.capture-open').nth(6).waitFor();
  await page.keyboard.press('/'); assert.equal(await page.evaluate(() => document.activeElement.id), 'search');
});

test('a failed note save retains its text and idempotency key for retry', async t => {
  let fail = true;
  const { page, requests } = await pageFor(t, { captures: [], handler: ({ url, request }) => {
    if (url.pathname === '/api/captures' && request.method() === 'POST' && fail) { fail = false; return { status: 503, body: { message: 'Temporary service failure. Try again.' } }; }
  } });
  await openLibrary(page); await page.locator('#new-note').click(); await page.locator('#note-text').fill('Keep this draft.'); await page.locator('#save-note').click();
  await page.locator('#note-error').waitFor({ state: 'visible' }); assert.equal(await page.locator('#note-text').inputValue(), 'Keep this draft.');
  await page.locator('#save-note').click(); await page.locator('#note-dialog').waitFor({ state: 'hidden' });
  const writes = requests.filter(request => request.path === '/api/captures' && request.method === 'POST'); assert.equal(writes.length, 2); assert.equal(writes[0].body.clientId, writes[1].body.clientId); assert.equal(typeof writes[1].body.capturedAt, 'number');
});

test('extension account switch requires confirmation before issuing or sending a pairing code', async t => {
  const { page, requests } = await pageFor(t, { captures: [], extensionAccount: { id: 'old-account', email: 'previous@example.test', name: 'Previous' } });
  await openLibrary(page); await page.locator('#connect-extension').click(); await page.locator('#confirm-dialog').waitFor({ state: 'visible' });
  assert.match(await page.locator('#confirm-description').textContent(), /previous@example.test/);
  assert.equal(requests.filter(request => request.path === '/api/pairing').length, 0);
  await page.locator('#confirm-cancel').click(); assert.equal((await page.evaluate(() => window.__extensionMessages.filter(item => item.message.kind === 'atlas-connect'))).length, 0);
  await page.locator('#connect-extension').click(); await page.locator('#confirm-accept').click(); await page.waitForFunction(() => document.querySelector('#extension-status').textContent.includes('Your next capture'));
  const messages = await page.evaluate(() => window.__extensionMessages.filter(item => item.message.kind === 'atlas-connect')); assert.equal(messages.length, 1); assert.equal(messages[0].id, 'mjfcgmboaijfcaanepdipbgmipnccnpn'); assert.equal(messages[0].message.code, 'test-single-use-pairing-code');
  assert.equal(await page.evaluate(() => localStorage.length), 0);
});

test('manual installation and session expiry have usable recovery paths', async t => {
  let expired = false;
  const { page } = await pageFor(t, { captures: [], extensionInstalled: false, handler: ({ url }) => expired && url.pathname.startsWith('/api/') ? { status: 401, body: { message: 'Log in again.' } } : undefined });
  await openLibrary(page); await page.locator('#connect-extension').click(); await page.locator('#manual-install[open]').waitFor();
  assert.match(await page.locator('#manual-install').textContent(), /Developer mode/);
  expired = true; await page.locator('#refresh-library').click(); await page.locator('#session-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.capture-card').count(), 0); await page.keyboard.press('Escape'); assert.equal(await page.locator('#session-dialog').isVisible(), true);
  assert.equal(await page.locator('#session-dialog a').first().getAttribute('href'), '/auth.html?mode=login');
});

test('account settings confirm revoke/export/logout and require saving a rotated recovery code', async t => {
  const { page, model, requests } = await pageFor(t);
  model.connections = [{ id: 'browser-1', name: 'Office Chrome', createdAt: now, lastSeenAt: now }];
  await openLibrary(page); await page.locator('#open-account').click(); await page.getByRole('button', { name: 'Revoke Office Chrome' }).click();
  await page.locator('#confirm-cancel').click(); assert.equal(requests.some(request => request.path === '/api/connections/browser-1'), false);
  await page.getByRole('button', { name: 'Revoke Office Chrome' }).click(); await page.locator('#confirm-accept').click(); await page.locator('.device-empty').waitFor();
  await page.locator('#export-account').click(); const download = page.waitForEvent('download'); await page.locator('#confirm-accept').click(); assert.match((await download).suggestedFilename(), /^atlas-export-.*\.json$/);
  await page.locator('#current-password').fill('Current-password-123'); await page.locator('#new-password').fill('New-password-123456'); await page.locator('#change-password').click(); await page.locator('#confirm-accept').click();
  await page.locator('#password-recovery-dialog').waitFor({ state: 'visible' }); assert.equal(await page.locator('#finish-password-recovery').isDisabled(), true); await page.keyboard.press('Escape'); assert.equal(await page.locator('#password-recovery-dialog').isVisible(), true);
  await page.locator('#password-recovery-saved').check(); await page.locator('#finish-password-recovery').click(); assert.equal(await page.locator('#password-recovery-code').textContent(), '');
  await page.locator('#logout').click(); await page.locator('#confirm-cancel').click(); assert.equal(requests.some(request => request.path === '/api/auth/logout'), false);
});

test('library pagination retries without dropping loaded captures', async t => {
  let failed = false;
  const { page } = await pageFor(t, { handler: ({ url, request }) => {
    if (url.pathname !== '/api/captures' || request.method() !== 'GET') return;
    if (url.searchParams.get('cursor')) {
      if (!failed) { failed = true; return { status: 503, body: { message: 'Please retry.' } }; }
      return { body: { captures: fixtureCaptures.slice(3), nextCursor: null, total: 6 } };
    }
    return { body: { captures: fixtureCaptures.slice(0, 3), nextCursor: 'page-two', total: 6 } };
  } });
  await openLibrary(page); assert.equal(await page.locator('.capture-card').count(), 3);
  await page.locator('#load-more').click(); await page.locator('#page-message').waitFor({ state: 'visible' }); assert.equal(await page.locator('.capture-card').count(), 3);
  await page.locator('#load-more').click(); await page.locator('.capture-card').nth(5).waitFor(); assert.equal(await page.locator('#load-more').isVisible(), false);
});

test('customer screens fit phone and desktop; save visual review evidence', async t => {
  const { page, model } = await pageFor(t, { extensionAccount: account });
  await mkdir('.impeccable/review', { recursive: true });
  for (const [surface, route] of [['auth', '/auth.html?mode=signup'], ['dashboard', '/dashboard.html']]) {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(base + route); await page.evaluate(() => document.fonts.ready);
      if (surface === 'dashboard') { await page.locator('#capture-grid[aria-busy="false"]').waitFor({ state: 'attached' }); await page.evaluate(() => { for (const image of document.images) image.loading = 'eager'; }); await page.waitForFunction(() => [...document.images].every(image => image.complete)); }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${surface} overflows at ${width}`);
      if (width !== 320) await page.screenshot({ path: `.impeccable/review/customer-${surface}-${width === 1440 ? 'desktop' : 'mobile'}.png`, fullPage: true });
    }
  }
  await mkdir('deploy/dist/store-assets', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openLibrary(page); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'deploy/dist/store-assets/customer-dashboard.png', fullPage: false });
  model.captures = []; model.connections = [];
  await openLibrary(page); await page.waitForFunction(() => document.querySelector('#extension-status').textContent.includes('Connected as'));
  await page.screenshot({ path: 'deploy/dist/store-assets/customer-browser-setup.png', fullPage: false });
});
