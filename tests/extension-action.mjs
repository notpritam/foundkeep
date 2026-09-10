import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { actionPopup } from './helpers/action-popup.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

test('toolbar popup opens at a usable size and saves a note in the real extension', { timeout: 20000 }, async () => {
  const extension = process.env.FOUNDKEEP_TEST_EXTENSION || path.resolve('apps/extension');
  const profile = await mkdtemp('/tmp/foundkeep-action-test-');
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--window-size=1280,1000', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    await context.route('https://foundkeep.app/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Popup capture fixture</title><p>A page worth keeping.</p>' }));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const tab = await context.newPage(); await tab.goto('https://foundkeep.app/__popup-fixture');
    const popup = await actionPopup(context, tab, worker);
    await popup.waitFor('document.body.dataset.preferencesReady === "true" && document.querySelector("#savedCount").textContent === "0 saved"');
    await popup.evaluate('document.fonts.ready.then(() => true)');
    const bounds = await popup.evaluate(`(() => {
      const footer = document.querySelector('.popup-foot').getBoundingClientRect();
      const main = document.querySelector('.popup-main').getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, mainHeight: main.height, footerBottom: footer.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    })()`);
    assert.ok(bounds.width >= 360 && bounds.width <= 400, `Toolbar popup collapsed: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.height >= 450 && bounds.height <= 600, `Toolbar popup collapsed: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.mainHeight > 300, 'Capture actions and note composer need usable space');
    assert.ok(bounds.footerBottom <= bounds.height, 'Library and settings remain inside the popup');
    assert.equal(bounds.overflow, false);
    await popup.evaluate(`document.querySelector('#note').scrollIntoView({block:'center'}); document.querySelector('#note').focus()`);
    await popup.send('Input.insertText', { text: 'Saved from the actual toolbar popup' });
    const point = await popup.evaluate(`(() => { const button = document.querySelector('#save'); button.scrollIntoView({block:'nearest'}); const box = button.getBoundingClientRect(); return {x:box.x+box.width/2,y:box.y+box.height/2}; })()`);
    await popup.send('Input.dispatchMouseEvent', { type:'mousePressed', button:'left', clickCount:1, ...point });
    await popup.send('Input.dispatchMouseEvent', { type:'mouseReleased', button:'left', clickCount:1, ...point });
    await popup.waitFor('document.querySelector("#savedCount").textContent === "1 saved"');
    assert.equal(await popup.evaluate('document.querySelector("#note").value'), '');
    assert.equal(await popup.evaluate("import('./db.js').then(db => db.listCaptures()).then(rows => rows[0].noteText)"), 'Saved from the actual toolbar popup');
    if (process.env.FOUNDKEEP_POPUP_SCREENSHOT) {
      const { data } = await popup.send('Page.captureScreenshot');
      await writeFile(process.env.FOUNDKEEP_POPUP_SCREENSHOT, Buffer.from(data, 'base64'));
    }
    await popup.evaluate('document.querySelector("#openSettings").click()');
    await popup.waitFor('!document.querySelector("#view-settings").hidden');
    assert.equal(await popup.evaluate('document.querySelector("#view-main").hidden'), true);
    await popup.evaluate('document.querySelector("#backBtn").click()');
    await popup.waitFor('!document.querySelector("#view-main").hidden');
    await popup.close();
    await context.unroute('https://foundkeep.app/**');
    const webRoot = path.resolve('apps/web');
    await context.route('https://foundkeep.app/**', async route => {
      try {
        const url = new URL(route.request().url());
        const file = path.resolve(webRoot, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(webRoot + path.sep)) throw new Error('Outside web root');
        const contentType = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' }[path.extname(file)];
        await route.fulfill({ contentType, body: await readFile(file) });
      } catch { await route.fulfill({ status: 404, body: 'Not found' }); }
    });
    await tab.goto('https://foundkeep.app/');
    await tab.waitForFunction(() => document.querySelector('[data-extension-install]').textContent.includes('Connect extension'));
    assert.match(await tab.locator('.download-note').textContent(), /installed/i);
    assert.equal(await tab.locator('[data-extension-install][href*="chromewebstore.google.com"]').count(), 0);

  } finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
});
