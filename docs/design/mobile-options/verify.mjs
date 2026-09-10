import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:8934';
const output = path.resolve('.impeccable/review/mobile-options');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/home/pritam/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1180 } });
  const errors = []; const failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', res => { if (res.status() >= 400) failedAssets.push(res.url()); });
  await page.goto(base); await page.evaluate(() => document.fonts.ready);
  const screenIds = await page.locator('#screen option').evaluateAll(options => options.map(option => option.value));
  assert.equal(screenIds.length, 14);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1180 : 844 });
    for (const screen of screenIds) {
      await page.locator('#screen').selectOption(screen);
      assert.equal(await page.locator('.phone').count(), 3);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${screen} at ${width}: page must fit`);
      for (const phone of await page.locator('.phone').all()) {
        const layout = await phone.evaluate(el => { const scroll = el.querySelector('.app-scroll'); return { width: scroll.clientWidth, content: scroll.scrollWidth, screen: el.className }; });
        assert.ok(layout.content <= layout.width + 1, `${layout.screen} at ${width}: horizontal overflow ${JSON.stringify(layout)}`);
      }
      if (width === 1440 && ['welcome', 'gallery', 'sign-in', 'saved', 'organize', 'settings'].includes(screen)) await page.screenshot({ path: path.join(output, `${screen}-wide.png`), fullPage: true });
      if (screen === 'welcome') {
        for (const variant of await page.locator('.variant').all()) {
          const frame = await variant.locator('.phone').boundingBox();
          const cta = await variant.getByRole('button', { name: 'Get started', exact: true }).boundingBox();
          assert.ok(cta.y + cta.height < frame.y + frame.height - 24, `Welcome CTA must be above the home indicator at ${width}`);
        }
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1180 });
  await page.locator('#screen').selectOption('welcome');
  await page.locator('[data-variant="a"] [data-choose]').click();
  await page.reload();
  assert.equal(await page.locator('[data-variant="a"] [data-choose]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-variant="a"]').getByRole('button', { name: 'Get started', exact: true }).click();
  assert.equal(await page.locator('#screen').inputValue(), 'register');
  await page.locator('[data-variant="a"] summary').click();
  await page.locator('[data-variant="a"] input[type="email"]').fill('sample@example.com');
  await page.locator('#screen').selectOption('gallery');
  const a = page.locator('[data-variant="a"]');
  await a.locator('.search-input input').fill('slower');
  assert.equal(await a.locator('.gallery-grid .save-card:visible').count(), 1);
  await a.locator('.search-input input').fill('');
  await a.locator('[data-filter="note"]').click();
  assert.equal(await a.locator('.gallery-grid .save-card:visible').count(), 2);
  await a.locator('[data-filter="all"]').click();
  await a.locator('.app-scroll').evaluate(el => { el.scrollTop = 450; });
  await page.waitForFunction(() => document.querySelector('[data-variant="a"] .phone').classList.contains('scrolled'));
  await a.getByRole('button', { name: 'New note', exact: true }).click();
  assert.equal(await page.locator('#screen').inputValue(), 'new-note');
  await a.getByRole('textbox', { name: 'Your note', exact: true }).fill('A prototype note');
  await page.locator('#screen').selectOption('organize');
  await a.locator('[data-folder="Reading"]').click();
  assert.equal(await a.locator('[data-folder="Reading"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await a.locator('[data-folder="Inspiration"] svg').count(), 1);
  await a.getByRole('textbox', { name: 'New tag', exact: true }).fill('new idea');
  await a.locator('[data-add-tag]').click();
  assert.equal(await a.getByRole('button', { name: '#new idea', exact: true }).getAttribute('aria-pressed'), 'true');
  await a.locator('[data-new-folder]').click();
  await a.getByRole('textbox', { name: 'New folder name' }).fill('Weekend');
  await a.locator('.new-folder-form button').click();
  assert.equal(await a.locator('[data-folder="Weekend"]').count(), 1);
  await a.locator('[data-all="a"]').click();
  await page.locator('#review').click();
  assert.equal(await page.locator('#choices').evaluate(el => el.open), true);
  assert.equal(await page.locator('#choices [aria-pressed="true"]').count(), 14);
  await page.locator('[data-choice-screen="welcome"][data-choice-direction="b"]').click();
  let submitted;
  // Verify the handoff without overwriting the user's saved design choices.
  await page.route('**/choice', route => { submitted = route.request().postDataJSON(); return route.fulfill({ status: 204 }); });
  await page.locator('#send').click();
  await page.getByText('Choices saved for this Foundkeep thread.', { exact: false }).waitFor();
  assert.equal(submitted.choices.welcome, 'b'); assert.equal(Object.keys(submitted.choices).length, 14);
  await page.getByRole('button', { name: 'Close choices' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#screen').selectOption('oauth');
  assert.equal(await page.locator('.handoff-dots i').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.goto(base + '?screen=constructor&view=constructor');
  assert.equal(await page.locator('#screen').inputValue(), 'welcome');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-view="a"]').click();
  await page.screenshot({ path: path.join(output, 'welcome-phone.png'), fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
  console.log('PASS: 42 screen variants at 1440, 390 and 320 px, first-view welcome CTA, navigation, email disclosure, search, filters, scroll chrome, note editing, folder/tag controls, persistent per-screen choices, choose-all, choice submission, reduced motion, safe URL defaults and all local assets.');
} finally { await browser.close(); }
