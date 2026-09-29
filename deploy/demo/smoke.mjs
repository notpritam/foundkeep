#!/usr/bin/env node
// Live demo smoke check: the real dashboard and the real app's web build, both
// through the gateway, sign in as the demo account and open a save.
//   /usr/bin/node deploy/demo/smoke.mjs [--shots /tmp/dir]
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.DEMO_URL || 'http://127.0.0.1:8818';
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const { email, password } = JSON.parse(await readFile(path.join(homedir(), '.local/share/foundkeep-demo/state.json'), 'utf8'));
const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] });
const failures = [];
const check = (ok, what) => { console.log(`${ok ? '✓' : '✖'} ${what}`); if (!ok) failures.push(what); };

// Dashboard: log in, see the library, open a save.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Log in/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
  check(/\/dashboard/.test(page.url()), 'dashboard: logging in lands on the library');
  const card = page.getByText('The half-life of a good idea').first();
  check(await card.waitFor({ timeout: 15000 }).then(() => true, () => false), 'dashboard: the library shows the sample saves');
  await card.click().catch(() => {});
  check(await page.getByText('Saved in your library').first().waitFor({ timeout: 15000 }).then(() => true, () => false), 'dashboard: a save opens');
  if (shots) await page.screenshot({ path: path.join(shots, 'demo-dashboard.png') });
  await page.close();
}
// App (web build under /app): sign in with email, see the library, open a save.
{
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  // The demo must never reach production: block and count any request that tries.
  const leaks = [];
  await page.route(/^https:\/\/(dev\.)?foundkeep\.app\//, route => { leaks.push(route.request().url()); return route.abort(); });
  await page.goto(BASE + '/app/');
  await page.getByLabel('Continue with email').click({ timeout: 20000 });
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Sign in', { exact: true }).click();
  const card = page.getByText('The half-life of a good idea').first();
  check(await card.waitFor({ timeout: 20000 }).then(() => true, () => false), 'app: signing in shows the library with the sample saves');
  await page.waitForTimeout(3000);
  // What a person sees: React Native Web paints images as CSS backgrounds.
  const images = await page.evaluate(() => [...document.querySelectorAll('[style*="background-image"]')].filter(e => /\/api\/mobile\/captures\/[^/]+\/(blob|preview|file)/.test(e.style.backgroundImage) && e.style.backgroundImage.includes(location.origin)).length);
  const drawn = await page.evaluate(async () => { const urls = [...document.querySelectorAll('[style*="background-image"]')].map(e => /url\("?([^")]+)/.exec(e.style.backgroundImage)?.[1]).filter(u => u && u.includes('/api/mobile/captures/')); let ok = 0; for (const u of urls) { const r = await fetch(u); if (r.ok && (r.headers.get('content-type') || '').startsWith('image/')) ok++; } return ok; });
  check(images >= 3 && drawn >= 3, `app: the sample saves' images are drawn from the demo (${images} painted, ${drawn} load)`);
  check(!leaks.length, `app: no request reaches foundkeep.app (${leaks.length}${leaks.length ? ': ' + leaks[0].slice(0, 80) : ''})`);
  if (shots) await page.screenshot({ path: path.join(shots, 'demo-app.png') });
  await card.click().catch(() => {});
  check(await page.getByText('Original source').first().waitFor({ timeout: 15000 }).then(() => true, () => false), 'app: a save opens');
  await page.close();
}
await browser.close();
process.exit(failures.length ? 1 : 0);
