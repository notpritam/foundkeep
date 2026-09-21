import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright-core';
const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:18791').origin;
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname) || (base === 'https://dev.foundkeep.app' && process.env.ALLOW_DEV_MUTATIONS === '1'));
const output = process.env.EVIDENCE_DIR || '/tmp/foundkeep-archive-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/home/pritam/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const password = randomBytes(24).toString('base64url');
let registered = false;
try {
 const response = await context.request.post(base + '/api/auth/register', { headers: { Origin: base }, data: { email: `archive-${randomBytes(8).toString('hex')}@example.test`, name: 'Archive verification', password } });
 assert.equal(response.status(), 201); registered = true;
 const saved = await context.request.post(base + '/api/captures', { headers: { Origin: base }, data: { clientId: randomBytes(12).toString('hex'), type: 'note', noteText: 'A note to archive and restore', processingOptions: { ocr: false, summaries: false, tags: false } } });
 assert.equal(saved.status(), 201);
 const capture = (await saved.json()).capture;
 const page = await context.newPage();
 const errors = []; page.on('pageerror', error => errors.push(error.message));
 await page.goto(base + '/dashboard');
 await page.locator('.capture-open').click();
 await page.getByRole('button', { name: 'Archive save', exact: true }).waitFor();
 let failOnce = true;
 await page.route('**/api/captures/*/archive', async route => {
  if (failOnce) { failOnce = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'test_failure', message: 'Try archiving again.' }) }); }
  await route.continue();
 });
 await page.getByRole('button', { name: 'Archive save', exact: true }).click();
 await page.locator('#detail-body [role="alert"]:visible').waitFor();
 assert.equal(await page.locator('.capture-open').count(), 1);
 await page.getByRole('button', { name: 'Archive save', exact: true }).click();
 await page.locator('#capture-dialog').waitFor({ state: 'hidden' });
 await page.waitForFunction(() => document.querySelectorAll('.capture-open').length === 0);
 await page.locator('#open-archive').click();
 await page.getByRole('heading', { name: 'Archive.', exact: true }).waitFor();
 await page.locator('.capture-open').waitFor();
 assert.equal(await page.locator('#open-archive').getAttribute('aria-current'), 'page');
 await page.locator('#search').fill('restore');
 await page.waitForURL('**/dashboard?archived=true&q=restore');
 await page.locator('.capture-open').click();
 await page.locator('.expand-capture').click();
 await page.waitForURL('**/dashboard/saved/**');
 assert.equal(new URL(page.url()).searchParams.get('archived'), 'true');
 await page.getByRole('button', { name: 'Back to library', exact: true }).click();
 await page.waitForURL('**/dashboard?archived=true&q=restore');
 for (const width of [1280, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({ path: path.join(output, `archive-${width}.png`), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}`);
 }
 await page.locator('.capture-open').click();
 await page.getByRole('button', { name: 'Restore save', exact: true }).click();
 await page.locator('#capture-dialog').waitFor({ state: 'hidden' });
 await page.waitForFunction(() => document.querySelectorAll('.capture-open').length === 0);
 await page.goto(base + '/dashboard');
 await page.locator('.capture-open').waitFor();
 const after = await context.request.get(`${base}/api/captures/${capture.id}`);
 const restored = (await after.json()).capture;
 assert.equal(restored.archivedAt, null); assert.equal(restored.noteText, capture.noteText);
 assert.deepEqual(errors, []);
 console.log('PASS archive/restore, failed-write recovery, archive search, reader navigation, and desktop/mobile layouts');
} finally {
 if (registered) {
  const deleted = await context.request.delete(base + '/api/account', { headers: { Origin: base }, data: { password } });
  assert.equal(deleted.status(), 200, 'Disposable test account cleanup');
 }
 await browser.close();
}
