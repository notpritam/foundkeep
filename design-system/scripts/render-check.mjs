#!/usr/bin/env node
// Render every story of a built Storybook and fail on anything a person would
// notice: a console error, an uncaught exception, a story that never renders,
// or a serious accessibility violation.
//
//   /usr/bin/node design-system/scripts/render-check.mjs http://127.0.0.1:8814/app \
//     [--globals theme:dark,textSize:2] [--only library] [--jobs 4]
//
// Accessibility (axe-core, serious and critical) fails every story except the
// ones titled */Current/*: those are today's screens, kept as the baseline,
// so their violations are reported, not fatal.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const base = (args.find(a => !a.startsWith('--') && /^https?:/.test(a)) || '').replace(/\/$/, '');
const option = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
if (!base) { console.error('usage: render-check.mjs <storybook-url> [--globals k:v,k:v] [--only text] [--jobs n]'); process.exit(2); }
const globals = option('globals') ? option('globals').split(',').join(';') : '';
const only = option('only');
const jobs = Number(option('jobs') || 4);
const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const index = await fetch(base + '/index.json').then(r => { if (!r.ok) throw new Error(`${base}/index.json: ${r.status}`); return r.json(); });
const stories = Object.values(index.entries).filter(e => e.type === 'story' && (!only || (e.title + ' ' + e.name).toLowerCase().includes(only.toLowerCase())));
if (!stories.length) { console.error('No stories matched.'); process.exit(1); }

const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });
const results = [];
async function check(story) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text().slice(0, 300)); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 300)));
  const url = `${base}/iframe.html?id=${story.id}&viewMode=story${globals ? '&globals=' + encodeURIComponent(globals) : ''}`;
  let a11y = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => document.body.classList.contains('sb-show-main') || document.body.classList.contains('sb-show-errordisplay'), null, { timeout: 30000 });
    if (await page.evaluate(() => document.body.classList.contains('sb-show-errordisplay')))
      errors.push('Storybook error: ' + (await page.locator('#error-message').innerText().catch(() => '')).slice(0, 300));
    else if (!(await page.waitForFunction(() => (document.querySelector('#storybook-root')?.childElementCount || 0) > 0, null, { timeout: 10000 }).then(() => true, () => false)))
      errors.push('Rendered nothing');
    await page.waitForTimeout(250);
    await page.addScriptTag({ content: axeSource });
    a11y = await page.evaluate(async () => {
      const r = await window.axe.run(document.querySelector('#storybook-root') || document.body, { resultTypes: ['violations'] });
      return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id} (${v.nodes.length})`);
    });
  } catch (error) { errors.push(String(error.message || error).split('\n')[0]); }
  await page.close();
  const baseline = /(^|\/)Current\//.test(story.title);
  results.push({ story, errors, a11y, failed: errors.length > 0 || (a11y.length > 0 && !baseline) });
}
const queue = [...stories];
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { while (queue.length) await check(queue.shift()); }));
await browser.close();

results.sort((x, y) => x.story.id.localeCompare(y.story.id));
for (const { story, errors, a11y, failed } of results) {
  if (!errors.length && !a11y.length) continue;
  console.log(`${failed ? '✖' : '·'} ${story.title} / ${story.name}`);
  for (const e of errors) console.log('    error  ' + e);
  if (a11y.length) console.log(`    a11y   ${a11y.join(', ')}${failed && !errors.length ? '' : /(^|\/)Current\//.test(story.title) ? '  (baseline, not fatal)' : ''}`);
}
const failed = results.filter(r => r.failed).length;
console.log(`render-check ${base}${globals ? ' [' + globals + ']' : ''}: ${results.length - failed}/${results.length} stories clean`);
process.exit(failed ? 1 : 0);
