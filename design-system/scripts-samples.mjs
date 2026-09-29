// One-off: sample captures for the preview proposals, rendered from the same
// article fixture the extension captures use (scripts/design/lib/fixtures.mjs).
import path from 'node:path';
import { articlePage } from '../scripts/design/lib/fixtures.mjs';
const { chromium } = await import('../node_modules/playwright-core/index.mjs');
const repo = path.resolve('..');
const out = name => path.resolve('public/samples', name);
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.setContent(await articlePage(repo), { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out('region.jpg'), type: 'jpeg', quality: 82, clip: { x: 272, y: 108, width: 780, height: 400 } });
await page.screenshot({ path: out('fullpage.jpg'), type: 'jpeg', quality: 72, fullPage: true });
await page.locator('figure svg').first().screenshot({ path: out('image.jpg'), type: 'jpeg', quality: 85 });
await browser.close();
