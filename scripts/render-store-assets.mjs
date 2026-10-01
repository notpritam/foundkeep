#!/usr/bin/env node
// Chrome Web Store listing images for the version in deploy/store-version.txt.
//
// 1. Capture: the exact Store package (deploy/dist/foundkeep-store-<v>.zip,
//    from `bun run store:pack`) loaded in a fresh browser profile, signed in
//    to a stand-in backend (no real account, no network writes), on a sample
//    article: the dock open, the "Saved" toast after a one-click save, and the
//    Add details card. The dashboard library comes from the design system
//    (it must be running on :8814). The article is served at its own address,
//    so the capture copy is granted all-site access — what a customer gets from
//    "Show on every site"; the uploaded package itself is not changed.
// 2. Compose: each capture in a browser window on FoundKeep's pastel gradient,
//    with a short headline; the small and marquee promo tiles; the icon.
//    Screenshots are 24-bit PNGs (no alpha), as the Store asks.
// Output: deploy/dist/store-assets-<v>/ + ASSET_PROVENANCE.json, for `bun run store:kit`.
//   /usr/bin/node scripts/render-store-assets.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { dockWorld } from '../tests/helpers/dock-world.mjs';
import { extensionPage, fixture, signIn, summon } from '../tests/helpers/dock-launch.mjs';

const root = path.resolve(import.meta.dirname, '..');
const version = (await readFile(path.join(root, 'deploy/store-version.txt'), 'utf8')).trim();
const zip = path.join(root, `deploy/dist/foundkeep-store-${version}.zip`);
const out = path.join(root, `deploy/dist/store-assets-${version}`), raw = path.join(out, 'raw');
const ffmpeg = path.join(root, 'design-system/film/node_modules/.bin/remotion');
await mkdir(raw, { recursive: true });
const archive = await readFile(zip).catch(() => { throw new Error(`Run \`bun run store:pack\` first: ${zip} is missing.`); });
const file = (...p) => path.join(root, ...p);
const dataUrl = async (p, mime) => `data:${mime};base64,${(await readFile(p)).toString('base64')}`;
const PAGE = { width: 1000, height: 600 };

// ── 1. Capture the real extension ──
const unpacked = await mkdtemp('/tmp/foundkeep-store-ext-'), profile = await mkdtemp('/tmp/foundkeep-store-profile-');
execFileSync('unzip', ['-q', zip, '-d', unpacked]);
{ // All-site access for the capture copy only (see above).
  const manifestPath = path.join(unpacked, 'manifest.json'), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions.push('<all_urls>');
  await writeFile(manifestPath, JSON.stringify(manifest));
}
const ARTICLE = 'https://fieldnote.example/curved-furniture';
const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, viewport: PAGE, deviceScaleFactor: 2,
  args: ['--no-sandbox', `--disable-extensions-except=${unpacked}`, `--load-extension=${unpacked}`] });
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const origin = await worker.evaluate(() => new URL(chrome.runtime.getManifest().host_permissions[0]).origin);
  await signIn(context, worker, { folders: [{ id: 'folder-home', name: 'Home' }, { id: 'folder-reading', name: 'Reading list' }] });
  // A stand-in for the saved capture the card reads back.
  const server = { sourceTitle: 'The quiet power of curved furniture', noteText: null, userTags: [], folderId: null, updatedAt: 1 };
  await context.route('**/api/captures', async r => r.request().method() === 'POST' ? r.fulfill({ status: 201, json: { capture: { id: 'remote-1', status: 'done' }, duplicate: false } }) : r.fallback());
  await context.route('**/api/mobile/captures/remote-1', r => r.fulfill({ json: { capture: { id: 'remote-1', ...server } } }));
  const [inter, chair, plant] = await Promise.all([dataUrl(file('apps/site/public/assets/fonts/InterVariable.woff2'), 'font/woff2'), dataUrl(file('apps/mobile/assets/images/film/chair.jpg'), 'image/jpeg'), dataUrl(file('apps/mobile/assets/images/film/plant.jpg'), 'image/jpeg')]);
  await fixture(context, ARTICLE, articlePage({ inter, chair, plant }));
  const web = await context.newPage(); await web.goto(ARTICLE);
  const ext = await extensionPage(context, worker);
  if (!await summon(ext, ARTICLE + '*')) throw new Error('The dock did not open.');
  await web.bringToFront();
  const dock = await dockWorld(web, extensionId);
  await dock.waitFor("__foundkeepDock.state() === 'expanded'");
  await web.waitForTimeout(900);
  await web.screenshot({ path: path.join(raw, 'dock.png') });
  // One click saves; the dock confirms.
  await dock.click('[data-action="savepage"]');
  await dock.waitFor("/Saved to My library/.test(__foundkeepDock.toast() || '')", 10000);
  // Move the pointer off the dock so no tooltip covers the confirmation.
  await web.mouse.move(60, 300);
  await web.waitForTimeout(500);
  await web.screenshot({ path: path.join(raw, 'saved.png') });
  // Add details: the card opens over the page with a preview of the save.
  await dock.click('.toast [data-action="details"]');
  let card;
  for (let i = 0; i < 160 && !card; i++) { card = web.frames().find(f => f.url().includes('review.html')); if (!card) await web.waitForTimeout(50); }
  if (!card) throw new Error('The details card did not open.');
  await card.waitForSelector('#detailsForm[data-ready="true"]', { timeout: 8000 });
  await card.fill('#detailsNote', 'For the living room. The oak one, in a warm white fabric.');
  try { // Put it in a folder, as someone would.
    await card.click('#detailsFolder');
    await card.click('[role="option"]:has-text("Home")', { timeout: 3000 });
  } catch { /* the card still reads well without one */ }
  await card.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await web.mouse.move(60, 300);
  await web.waitForTimeout(900);
  await web.screenshot({ path: path.join(raw, 'details.png') });
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true }); await rm(unpacked, { recursive: true, force: true });
}

// The dashboard library, from the design system.
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });
{
  const page = await browser.newPage({ viewport: PAGE, deviceScaleFactor: 2 });
  await page.goto(`http://localhost:8814/dashboard/iframe.html?id=current-library--library&viewMode=story&simulator=inner&globals=${encodeURIComponent('device:laptop')}`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(raw, 'library.png') });
  // Agents: a connected agent, and an instruction being written for it.
  await page.goto(`http://localhost:8814/dashboard/iframe.html?id=current-account-pages--agents-page&viewMode=story&simulator=inner&globals=${encodeURIComponent('device:laptop')}`);
  await page.waitForTimeout(4000);
  await page.evaluate(() => document.getElementById('connected-agents-title')?.scrollIntoView({ block: 'start' }));
  await page.locator('.agent-instructions textarea').first().fill('Find the three recipes I saved this week and plan Friday dinner.');
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(raw, 'agents.png') });
  await page.close();
}

// ── 2. Compose ──
const [interFont, caveat, icon, mark, ...shots] = await Promise.all([
  dataUrl(file('apps/site/public/assets/fonts/InterVariable.woff2'), 'font/woff2'),
  dataUrl(file('apps/mobile/assets/fonts/Caveat-Bold.ttf'), 'font/ttf'),
  dataUrl(file('apps/extension/icons/icon32.png'), 'image/png'),
  dataUrl(file('apps/extension/icons/icon128.png'), 'image/png'),
  ...['dock', 'saved', 'details', 'library', 'agents'].map(n => dataUrl(path.join(raw, `${n}.png`), 'image/png')),
]);
const [dockShot, savedShot, detailsShot, libraryShot, agentsShot] = shots;
const cards = Object.fromEntries(await Promise.all(['reel', 'tweet', 'article', 'photo-post', 'agent-orb'].map(async n => [n, await dataUrl(file(`apps/mobile/assets/images/elements/${n}.webp`), 'image/webp')])));

const page = await browser.newPage({ deviceScaleFactor: 1 });
const css = `
  @font-face { font-family: Inter; src: url(${interFont}) format('woff2'); font-weight: 100 900; }
  @font-face { font-family: Caveat; src: url(${caveat}) format('truetype'); font-weight: 700; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body { font-family: Inter, sans-serif; color: #233E4B; -webkit-font-smoothing: antialiased; }
  .sky { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(160deg, #dcecfb 0%, #eaf2fb 45%, #f2eefb 100%); }
  .sky i { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .9; }
  h1 { font-weight: 700; letter-spacing: -0.035em; }
  .hand { font-family: Caveat; font-weight: 700; display: inline-block; transform: rotate(-4deg); letter-spacing: 0; }
  .window { position: absolute; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 40px 90px rgba(20,48,84,.26), 0 0 0 1px rgba(20,48,84,.08); }
  .bar { height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 14px; background: #eef2f5; border-bottom: 1px solid #dfe5ea; }
  .bar i { width: 11px; height: 11px; border-radius: 50%; display: block; }
  .url { flex: 1; margin: 0 14px 0 18px; height: 26px; border-radius: 13px; background: #fff; display: flex; align-items: center; padding: 0 14px; font-size: 12.5px; color: #526B76; }
  .bar img { width: 18px; height: 18px; }
  .shot { display: block; }`;
const field = (color, size, x, y) => `<i style="background:radial-gradient(closest-side, ${color}, transparent);width:${size}px;height:${size}px;left:${x}px;top:${y}px"></i>`;
const sky = (w, h) => `<div class="sky">${field('#5aa9f0', w * 0.62, -w * 0.12, -h * 0.25)}${field('#b9a8ff', w * 0.52, w * 0.62, -h * 0.3)}${field('#9fe3c8', w * 0.48, w * 0.02, h * 0.62)}${field('#ffc9ae', w * 0.44, w * 0.66, h * 0.55)}${field('#7cbcf2', w * 0.4, w * 0.32, h * 0.22)}</div>`;
const browserWindow = (shot, { x, y, w, url }) => `<div class="window" style="left:${x}px;top:${y}px;width:${w}px">
  <div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><div class="url">${url}</div><img src="${icon}" alt=""></div>
  <img class="shot" src="${shot}" style="width:${w}px;height:${w * PAGE.height / PAGE.width}px" alt=""></div>`;

async function render(name, width, height, body) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><style>${css}</style><body>${body}</body>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = path.join(out, `.${name}`);
  await page.screenshot({ path: png });
  // 24-bit PNG, no alpha channel.
  execFileSync('/usr/bin/node', [ffmpeg, 'ffmpeg', '-y', '-loglevel', 'error', '-i', png, '-pix_fmt', 'rgb24', path.join(out, name)]);
  await rm(png);
}

const SCREENS = [
  { name: 'dock-toolbar.png', shot: dockShot, url: 'fieldnote.example/curved-furniture', title: 'Save anything in one click', line: 'Pages, highlights, screenshots and notes, from a small dock on any site.' },
  { name: 'dock-review.png', shot: savedShot, url: 'fieldnote.example/curved-furniture', title: 'Saved, straight to your library', line: 'No forms first. Add details later, only if you want to.' },
  { name: 'save-review.png', shot: detailsShot, url: 'fieldnote.example/curved-furniture', title: 'Add details after you save', line: 'A note, tags or a folder, with a preview of what you kept.' },
  { name: 'library.png', shot: libraryShot, url: 'foundkeep.app/dashboard', title: 'Everything in one place', line: 'Find it again in seconds, and let your AI agent use it too.' },
  { name: 'agents.png', shot: agentsShot, url: 'foundkeep.app/dashboard/agents', title: 'Your AI agent can use it too', line: 'Connect Claude or any MCP agent to find, read and organize what you saved.' },
];
for (const s of SCREENS) await render(s.name, 1280, 800, `${sky(1280, 800)}
  <div style="position:absolute;left:0;right:0;top:46px;text-align:center">
    <h1 style="font-size:40px;line-height:1.1">${s.title}</h1>
    <p style="margin-top:12px;font-size:19px;color:#526B76">${s.line}</p>
  </div>
  ${browserWindow(s.shot, { x: 140, y: 168, w: 1000, url: s.url })}`);

// Small promo tile, 440 × 280.
await render('promo-small.png', 440, 280, `${sky(440, 280)}
  <img src="${cards.tweet}" style="position:absolute;width:108px;right:-10px;top:18px;transform:rotate(8deg);filter:drop-shadow(0 10px 16px rgba(20,48,84,.18))">
  <img src="${cards.reel}" style="position:absolute;width:74px;right:96px;top:118px;transform:rotate(-8deg);filter:drop-shadow(0 10px 16px rgba(20,48,84,.18))">
  <img src="${cards['photo-post']}" style="position:absolute;width:88px;right:12px;bottom:-10px;transform:rotate(-5deg);filter:drop-shadow(0 10px 16px rgba(20,48,84,.18))">
  <div style="position:absolute;left:34px;top:44px">
    <div style="display:flex;align-items:center;gap:9px"><img src="${mark}" style="width:34px;height:34px"><strong style="font-size:21px;letter-spacing:-0.4px">FoundKeep</strong></div>
    <h1 style="margin-top:22px;font-size:37px;line-height:1">Keep Every</h1>
    <div class="hand" style="font-size:56px;line-height:1.05;color:#f0563a;margin-left:2px">find.</div>
  </div>`);

// Marquee, 1400 × 560.
await render('promo-marquee.png', 1400, 560, `${sky(1400, 560)}
  <div style="position:absolute;left:92px;top:118px;width:520px">
    <div style="display:flex;align-items:center;gap:12px"><img src="${mark}" style="width:46px;height:46px"><strong style="font-size:28px;letter-spacing:-0.6px">FoundKeep</strong></div>
    <h1 style="margin-top:34px;font-size:62px;line-height:1">Keep Every</h1>
    <div class="hand" style="font-size:92px;line-height:1.02;color:#f0563a;margin-left:4px">find.</div>
    <p style="margin-top:18px;font-size:21px;line-height:1.45;color:#526B76">Save any page, post or idea in one click. Find it again, or let your AI agent use it.</p>
  </div>
  ${browserWindow(detailsShot, { x: 690, y: 96, w: 640, url: 'fieldnote.example/curved-furniture' })}
  <img src="${cards.article}" style="position:absolute;width:120px;left:610px;top:356px;transform:rotate(-9deg);filter:drop-shadow(0 16px 24px rgba(20,48,84,.22))">
  <img src="${cards['agent-orb']}" style="position:absolute;width:84px;right:28px;top:30px;filter:drop-shadow(0 12px 20px rgba(20,48,84,.18))">`);
await browser.close();
await copyFile(file('apps/extension/icons/icon128.png'), path.join(out, 'icon128.png'));

await writeFile(path.join(out, 'ASSET_PROVENANCE.json'), JSON.stringify({
  storeVersion: version, storeItem: 'cficnecbdbiddngllpfbacabgbcjinmk',
  archiveSha256: createHash('sha256').update(archive).digest('hex'), accountData: false,
  method: 'scripts/render-store-assets.mjs: the exact Store package in a fresh Chromium profile (capture copy granted all-site access, as "Show on every site" does), signed in to a stand-in backend with sample content; dashboard from the design system; composed on the brand gradient.',
  created: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`Store ${version} assets → ${path.relative(root, out)}`);

function articlePage({ inter, chair, plant }) {
  return `<meta charset="utf-8"><title>The quiet power of curved furniture · Fieldnote</title>
<meta name="description" content="Why rounded chairs, tables and shelves make a room feel calmer, and how to choose one that lasts.">
<meta name="author" content="Ada Example">
<style>
  @font-face { font-family: Inter; src: url(${inter}) format('woff2'); font-weight: 100 900; }
  body { margin: 0; font-family: Inter, sans-serif; color: #1f2a30; background: #fbfaf7; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 18px 56px; border-bottom: 1px solid #ece8e0; font-size: 14px; color: #6b7177; }
  header b { font-size: 19px; color: #1f2a30; letter-spacing: -0.3px; }
  header nav { display: flex; gap: 26px; }
  main { display: grid; grid-template-columns: 1.1fr 1fr; gap: 44px; padding: 40px 56px; align-items: start; }
  .kicker { font-size: 13px; font-weight: 600; color: #b5643c; }
  h1 { font-size: 40px; line-height: 1.08; letter-spacing: -1.4px; margin: 10px 0 14px; }
  .byline { font-size: 14px; color: #6b7177; margin-bottom: 22px; }
  p { font-size: 16.5px; line-height: 1.65; margin: 0 0 14px; color: #39444b; }
  figure { margin: 0; }
  figure img { width: 100%; height: 360px; object-fit: cover; border-radius: 14px; display: block; }
  figcaption { font-size: 12.5px; color: #8a8f94; margin-top: 8px; }
</style>
<header><b>Fieldnote</b><nav><span>Interiors</span><span>Design</span><span>Objects</span><span>Newsletter</span></nav></header>
<main>
  <article>
    <div class="kicker">Interiors</div>
    <h1>The quiet power of curved furniture</h1>
    <div class="byline">By Ada Example · 6 min read</div>
    <p>Walk into a room full of rounded edges and something in you relaxes. Curves slow the eye down; they make a space feel softer and more forgiving.</p>
    <p>Designers have known this for decades. A bent-wood lounge chair or an oval table changes how people move through a room and where they choose to sit.</p>
    <p>Here is how to choose a curved piece that will still feel right in ten years.</p>
  </article>
  <figure><img src="${chair}" alt="A curved oak lounge chair in a sunlit room"><figcaption>A bent-oak lounge chair, warm white upholstery.</figcaption></figure>
</main>
<img src="${plant}" alt="" style="display:none">`;
}
