import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

test('save drafts are per tab: two tabs keep separate drafts and closing a tab drops its draft', { timeout: 30000 }, async t => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-drafts-'); let context;
  t.after(async () => { await context?.close(); await rm(profile, { recursive: true, force: true }); });
  context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: process.env.FOUNDKEEP_HEADLESS !== 'false', executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await context.route(origin + '/__draft-*', route => route.fulfill({ contentType: 'text/html', body: '<title>Draft fixture</title><p>Text</p>' }));
  const a = await context.newPage(); await a.goto(origin + '/__draft-a');
  const b = await context.newPage(); await b.goto(origin + '/__draft-b');
  const page = await context.newPage(); await page.goto(await worker.evaluate(() => chrome.runtime.getURL('src/popup.html')));
  await page.evaluate(() => chrome.storage.local.set({ atlasCustomer: { account: { id: 'account-a' }, connection: { id: 'connection-a' }, token: 'token-a', status: 'connected' } }));
  const ids = await page.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(tab => /__draft-[ab]$/.test(tab.url)).sort((x, y) => x.url.localeCompare(y.url)).map(tab => tab.id);
  });
  const staged = await page.evaluate(async ([ta, tb]) => {
    const m = await import('./save-review.js');
    const tabA = await chrome.tabs.get(ta), tabB = await chrome.tabs.get(tb);
    const da = await m.stageSaveReview({ action: 'savepage', tab: tabA, trigger: 'dock' });
    const db = await m.stageSaveReview({ action: 'savepage', tab: tabB, trigger: 'dock' });
    return [da.tab.id, db.tab.id, (await m.readSaveReview(ta)).id === da.id, (await m.readSaveReview(tb)).id === db.id];
  }, ids);
  assert.deepEqual(staged, [ids[0], ids[1], true, true]);
  const second = await page.evaluate(async ta => {
    const m = await import('./save-review.js');
    try { await m.stageSaveReview({ action: 'highlight', tab: await chrome.tabs.get(ta), trigger: 'dock' }); return 'staged'; }
    catch (error) { return error.message; }
  }, ids[0]);
  assert.match(second, /Finish or cancel the current save first/);
  await a.close();
  await page.waitForFunction(async ta => !(await (await import('./save-review.js')).readSaveReview(ta)), ids[0]);
  assert.ok(await page.evaluate(async tb => !!(await (await import('./save-review.js')).readSaveReview(tb)), ids[1]));
});
