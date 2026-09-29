// The Dashboard Storybook's theme switch must reach the dashboard's own
// ThemeProvider, not only the data-theme attribute: components that read
// useTheme() (Settings' appearance choice, the mind map's palette, the header
// toggle) otherwise stay light in a dark story. Needs the built Storybook on
// :8814 (design-system/scripts/build-all.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.FOUNDKEEP_STORYBOOK_URL || 'http://127.0.0.1:8814';

test('a dark dashboard story is dark for components that read the theme', { timeout: 60000 }, async t => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] });
  t.after(() => browser.close());
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/dashboard/iframe.html?id=current-account-pages--account-settings&viewMode=story&simulator=inner&globals=${encodeURIComponent(`device:desktop;theme:${theme}`)}`);
    const choice = page.locator('[role="group"][aria-label="Appearance"] button[aria-pressed="true"]');
    await choice.waitFor({ timeout: 20000 });
    assert.match(await choice.innerText(), new RegExp(theme, 'i'), `the Appearance choice shows ${theme}`);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
    await page.close();
  }
});
