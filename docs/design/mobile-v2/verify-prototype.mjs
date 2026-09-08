import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/home/pritam/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const screenshot = async name => { await page.waitForFunction(() => !document.querySelector('.toast')); return page.screenshot({ path: fileURLToPath(new URL(name, import.meta.url)), fullPage: true }); };
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8914');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#view-0 [data-open="a"]').click();
  await page.locator('#device-0 [data-edit]').click();
  await page.locator('#edit-title-0').fill('Updated across all three collections');
  await page.locator('#device-0 [data-save]').click();
  for (let i = 0; i < 3; i++) {
    if (await page.locator(`#view-${i}`).getByText('Updated across all three collections', { exact: true }).count() < 1) throw Error(`Edit not reflected in ${i}`);
  }
  await page.locator('#view-1 [data-open="b"]').click();
  await page.locator('#device-1 [data-child]').nth(1).click();
  await page.locator('#device-1 [data-close]').click();
  await page.locator('#offline-toggle').click();
  if (await page.locator('.sync-line').count() !== 3) throw Error('Offline state missing');
  await page.locator('#reset').click();
  await screenshot('desktop.png');
  await page.locator('[data-stage="welcome"]').click();
  await screenshot('sign-in.png');
  await page.locator('#view-0 [data-provider="Apple"]').click();
  await page.locator('#view-0 [data-action="step"]').click();
  await page.locator('#view-0 [data-action="step"]').click();
  await page.locator('#view-0').getByRole('button', { name: 'Not now', exact: true }).click();
  await page.locator('[data-stage="onboarding"]').click();
  await screenshot('onboarding.png');
  await page.locator('[data-stage="collection"]').click();
  await page.locator('#theme-toggle').click();
  await screenshot('dark.png');
  await page.locator('#view-0 .app-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await screenshot('dark-status.png');
  await page.locator('#view-0 .app-content').evaluate(el => { el.scrollTop = 0; });
  await page.locator('#theme-toggle').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('phone.png');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Overflow at ${width}`);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#view-0 [data-open="a"]').click();
  if (await page.locator('img').evaluateAll(imgs => imgs.some(x => !x.complete || x.naturalWidth === 0))) throw Error('Unloaded image');
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Passed: edit propagation, grouped images, offline state, onboarding, five widths, reduced motion, images, no page errors.');
} finally { await browser.close(); }
