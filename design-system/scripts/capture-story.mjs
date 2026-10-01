#!/usr/bin/env node
// Records a story frame by frame, exactly: the page's clock is frozen and
// advanced one frame at a time (animations, timers), any <video> is seeked to
// the same moment, and each frame is saved as a JPEG. For turning live screens
// into video (design-system/film's poll), without screen-recording jitter.
//   capture-story.mjs <storybook-url> <story-id> <out-dir> [--seconds 13] [--fps 30] [--scale 2] [--globals device:iphone-17-pro]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [base, storyId, out, ...rest] = process.argv.slice(2);
const option = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
const seconds = Number(option('seconds', 13)), fps = Number(option('fps', 30)), scale = Number(option('scale', 2));
const globals = option('globals', 'device:iphone-17-pro');
const size = { width: Number(option('width', 402)), height: Number(option('height', 874)) };
if (!base || !storyId || !out) { console.error('usage: capture-story.mjs <storybook-url> <story-id> <out-dir> [--seconds n] [--fps n] [--scale n]'); process.exit(2); }

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: size, deviceScaleFactor: scale });
await page.clock.install({ time: new Date('2026-10-01T09:41:00') });
await page.goto(`${base.replace(/\/$/, '')}/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&simulator=inner&globals=${encodeURIComponent(globals)}`);
// Let it load and settle in real time, then freeze the clock and start the story over, so its entrance begins on frame one.
await page.waitForFunction(() => document.querySelector('#storybook-root')?.childElementCount > 0 && document.fonts.status === 'loaded', null, { timeout: 60000 });
await page.waitForTimeout(3000);
const now = await page.evaluate(() => Date.now());
await page.clock.pauseAt(now + 50);
await page.evaluate(id => window.__STORYBOOK_ADDONS_CHANNEL__.emit('forceRemount', { storyId: id }), storyId);
await page.waitForTimeout(800);
// Films load in real time (the clock doesn't move them); wait until they can show a frame.
await page.waitForFunction(() => [...document.querySelectorAll('video')].every(v => v.readyState >= 2), null, { timeout: 60000 });
await page.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()));

const frames = Math.round(seconds * fps);
for (let i = 0; i < frames; i++) {
  if (i > 0) await page.clock.runFor(1000 / fps);
  await page.evaluate(async t => {
    await Promise.all([...document.querySelectorAll('video')].map(v => new Promise(done => {
      const at = t % (v.duration || Infinity);
      if (Math.abs(v.currentTime - at) < 0.001) return done();
      v.addEventListener('seeked', done, { once: true }); v.currentTime = at;
    })));
  }, i / fps);
  await page.screenshot({ path: path.join(out, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if (i % 60 === 0) process.stdout.write(`${storyId} ${i}/${frames}\n`);
}
await browser.close();
