#!/usr/bin/env node
// Screenshot every story matching a filter at a device's size and tile them
// into one image, so a person can look at a whole flow at once.
//   contact-sheet.mjs <storybook-url> <out.png> [--only Current/] [--globals theme:dark] [--width 402 --height 874] [--columns 6]
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const [base, out] = args.filter(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const only = option('only', ''), globals = option('globals', ''), width = Number(option('width', 402)), height = Number(option('height', 874)), columns = Number(option('columns', 6));
const index = await fetch(base.replace(/\/$/, '') + '/index.json').then(r => r.json());
const stories = Object.values(index.entries).filter(e => e.type === 'story' && (e.title + ' / ' + e.name).includes(only));
const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] });
const shots = [];
for (const story of stories) {
  const page = await browser.newPage({ viewport: { width, height } });
  const g = ['device:iphone-17-pro', ...globals.split(',').filter(Boolean)].join(';');
  await page.goto(`${base.replace(/\/$/, '')}/iframe.html?id=${story.id}&viewMode=story&simulator=inner&globals=${encodeURIComponent(g)}`);
  await page.waitForTimeout(2500);
  shots.push({ label: `${story.title.replace(/^.*?\//, '')} · ${story.name}`, data: (await page.screenshot()).toString('base64') });
  await page.close();
}
const sheet = await browser.newPage({ viewport: { width: columns * (width / 2 + 16) + 16, height: 400 } });
await sheet.setContent(`<body style="margin:0;padding:16px;background:#e9ebee;font:600 11px system-ui;display:grid;grid-template-columns:repeat(${columns},${width / 2}px);gap:16px">${shots.map(s => `<figure style="margin:0"><img src="data:image/png;base64,${s.data}" style="width:${width / 2}px;border-radius:10px;display:block;box-shadow:0 1px 3px #0003"><figcaption style="margin-top:6px">${s.label}</figcaption></figure>`).join('')}</body>`);
await writeFile(out, await sheet.screenshot({ fullPage: true }));
await browser.close();
console.log(`${shots.length} screens → ${out}`);
