#!/usr/bin/env node
// Photographs a design decision's variants as they were, for the design log.
// Variants Pritam didn't pick are removed from the working tree once a pick is
// built, but they stay in git: this checks the archived commit out into a
// temporary worktree (sharing today's node_modules), builds that day's
// Storybook, screenshots the stories whose ids start with the given prefixes,
// and composes them into one captioned contact sheet (JPEG) in <out-dir>,
// with a manifest of what is in it. The worktree is removed afterwards.
//   design-log.mjs <commit> <out-dir> --app proposals-sign-in --hub proposals- [--title "…"] [--columns 6] [--wait 3500]
// A story can be left out with --skip <id>[,<id>…]; an app story that fills the
// page (a gallery, a board) is shot wide and whole with --wide <id>[,<id>…].
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [commit, outDir, ...rest] = process.argv.slice(2);
const list = name => rest.flatMap((v, i) => rest[i - 1] === `--${name}` ? v.split(',') : []);
const option = (name, fallback) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : fallback; };
if (!commit || !outDir) { console.error('usage: design-log.mjs <commit> <out-dir> --app <prefix> --hub <prefix> [--skip id,…] [--title …]'); process.exit(2); }
const appPrefixes = list('app'), hubPrefixes = list('hub'), skip = new Set(list('skip')), wide = new Set(list('wide'));
const columns = Number(option('columns', 6)), wait = Number(option('wait', 3500)), title = option('title', '');

const repo = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();
const sha = spawnSync('git', ['-C', repo, 'rev-parse', '--short', commit], { encoding: 'utf8' }).stdout.trim();
if (!sha) { console.error(`unknown commit ${commit}`); process.exit(2); }
const tree = `/tmp/fk-design-log-${sha}`;
const git = (...args) => { const run = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' }); if (run.status !== 0) throw new Error(run.stderr); };

try {
  if (!existsSync(tree)) git('worktree', 'add', '--detach', tree, sha);
  // Today's installs stand in for that day's (the design system's dependencies have barely moved).
  for (const dir of ['', 'design-system', 'design-system/app', 'design-system/dashboard']) {
    const from = path.join(repo, dir, 'node_modules'), to = path.join(tree, dir, 'node_modules');
    if (existsSync(from) && existsSync(path.join(tree, dir)) && !existsSync(to)) symlinkSync(from, to);
  }
  const ds = path.join(tree, 'design-system');
  const build = (cwd, out) => {
    const run = spawnSync('/usr/bin/node', [path.join(cwd, 'node_modules/.bin/storybook'), 'build', '-o', out, '--quiet'], { cwd, encoding: 'utf8', env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' } });
    if (run.status !== 0) throw new Error(`build failed in ${cwd}\n${(run.stdout + run.stderr).slice(-2000)}`);
  };
  build(ds, 'dist');
  if (appPrefixes.length && existsSync(path.join(ds, 'app'))) build(path.join(ds, 'app'), '../dist/app');
  const dist = path.join(ds, 'dist');

  // A plain static server on a free port, for the length of the run.
  const server = createServer((req, res) => {
    let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404).end(); return; }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf' }[path.extname(file)];
    res.writeHead(200, type ? { 'content-type': type } : {}); createReadStream(file).pipe(res);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stories = (index, prefixes, kind) => !prefixes.length || !existsSync(index) ? [] : Object.values(JSON.parse(readFileSync(index, 'utf8')).entries)
    .filter(e => e.type === 'story' && prefixes.some(p => e.id.startsWith(p)) && !skip.has(e.id)).map(e => ({ ...e, kind }));
  const shots = [...stories(path.join(dist, 'app/index.json'), appPrefixes, 'app'), ...stories(path.join(dist, 'index.json'), hubPrefixes, 'hub')];
  if (!shots.length) throw new Error('no stories matched');
  const work = path.join(tree, '.design-log'); mkdirSync(work, { recursive: true });
  const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] });
  const queue = [...shots];
  await Promise.all(Array.from({ length: 4 }, async () => {
    const page = await browser.newPage();
    for (let shot; (shot = queue.shift());) {
      shot.file = path.join(work, `${shot.id}.png`);
      if (shot.kind === 'app') {
        // A story drawn in a phone (parameters.simulator) is shot as the phone's screen; anything else wide and whole.
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(`${base}/app/iframe.html?id=${shot.id}&viewMode=story`);
        const phone = !wide.has(shot.id) && await page.evaluate(async id => {
          try { const preview = window.__STORYBOOK_PREVIEW__; await preview.ready?.(); return !!(await preview.storyStoreValue.loadStory({ storyId: id })).parameters.simulator; } catch { return true; }
        }, shot.id);
        shot.wide = !phone;
        if (phone) {
          await page.setViewportSize({ width: 402, height: 874 });
          await page.goto(`${base}/app/iframe.html?id=${shot.id}&viewMode=story&simulator=inner&globals=device:iphone-17-pro`);
          await page.waitForTimeout(wait);
          await page.screenshot({ path: shot.file });
        } else {
          await page.waitForTimeout(wait);
          await page.screenshot({ path: shot.file, fullPage: true });
        }
      } else {
        // The extension's components and the design system's pages: tight to what the story draws.
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${base}/iframe.html?id=${shot.id}&viewMode=story`);
        await page.waitForTimeout(wait);
        const root = page.locator('#storybook-root > *').first();
        const box = await root.boundingBox().catch(() => null);
        shot.wide = !box || box.width > 700;
        if (box && box.width > 4 && box.height > 4) await root.screenshot({ path: shot.file }); else await page.screenshot({ path: shot.file, fullPage: true });
      }
      process.stdout.write(`  ${shot.id}${shot.wide ? ' (wide)' : ''}\n`);
    }
    await page.close();
  }));

  // One sheet: phones in a grid, then any hub pages full width, each captioned with its story's name.
  mkdirSync(outDir, { recursive: true });
  const img = f => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const caption = s => `${s.title.split('/').slice(1).join(' / ')} · ${s.name}`.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const phones = shots.filter(s => s.kind === 'app' && !s.wide), tiles = shots.filter(s => s.kind === 'hub' && !s.wide), pages = shots.filter(s => s.wide);
  const width = 1680, cell = Math.floor((width - 48 - (columns - 1) * 16) / columns);
  const sheet = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  await sheet.setContent(`<body style="margin:0;padding:24px;background:#f4f5f7;font:13px/1.35 -apple-system,Inter,system-ui,sans-serif;color:#1d1d1f">
    ${title ? `<h1 style="font-size:22px;margin:0 0 4px">${title}</h1>` : ''}<p style="margin:0 0 18px;color:#6e6e73">As it was at ${sha}, before the variants were retired.</p>
    <div style="display:grid;grid-template-columns:repeat(${columns},${cell}px);gap:16px">${phones.map(s => `<figure style="margin:0"><img style="width:${cell}px;border-radius:14px;display:block" src="${img(s.file)}"><figcaption style="margin-top:6px">${caption(s)}</figcaption></figure>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:start;margin-top:${phones.length ? 24 : 0}px">${tiles.map(s => `<figure style="margin:0;background:#fff;border:1px solid #e3e5e8;border-radius:12px;padding:12px"><img style="max-width:100%;display:block;margin:0 auto" src="${img(s.file)}"><figcaption style="margin-top:8px">${caption(s)}</figcaption></figure>`).join('')}</div>
    ${pages.map(s => `<figure style="margin:24px 0 0"><figcaption style="margin-bottom:6px">${caption(s)}</figcaption><img style="width:100%;border-radius:10px;display:block;border:1px solid #e3e5e8" src="${img(s.file)}"></figure>`).join('')}
  </body>`);
  await sheet.screenshot({ path: path.join(outDir, 'sheet.jpg'), type: 'jpeg', quality: 80, fullPage: true });
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ commit: sha, stories: shots.map(s => ({ id: s.id, title: s.title, name: s.name })) }, null, 2) + '\n');
  await browser.close(); server.close();
  console.log(`${outDir}/sheet.jpg — ${shots.length} stories from ${sha}`);
} finally {
  // The shared installs are only linked in: unlink them first, so removing the worktree can never reach them.
  for (const dir of ['', 'design-system', 'design-system/app', 'design-system/dashboard']) {
    const link = path.join(tree, dir, 'node_modules');
    try { if (lstatSync(link).isSymbolicLink()) unlinkSync(link); } catch {}
  }
  spawnSync('git', ['-C', repo, 'worktree', 'remove', '--force', tree]);
  if (existsSync(tree)) rmSync(tree, { recursive: true, force: true });
}
