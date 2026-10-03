#!/usr/bin/env node
// The app tour film (2026-10-03): captures the four app tours from the running design system frame
// by frame (../scripts/capture-story.mjs), then renders them side by side on a moving gradient,
// no words → design-system/downloads: app-tour-1080p.mp4 and -4k.mp4 (wide), app-tour-reel-1080x1920.mp4
// and -4k.mp4 (tall, two by two, for Reels and X).
//   /usr/bin/node design-system/film/tour.mjs [--skip-capture] [story ids…, in order]
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

const here = import.meta.dirname, frames = path.join(homedir(), '.cache/fk-tour');
const chosen = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const TOURS = chosen.length ? chosen : ['proposals-app-tour--conversation', 'proposals-app-tour--grid', 'proposals-app-tour--half', 'proposals-app-tour--trail'];
const capture = (id, i) => new Promise((done, fail) => spawn('/usr/bin/node', [path.join(here, '../scripts/capture-story.mjs'), 'http://localhost:8814/app', id, path.join(frames, String(i + 1)), '--seconds', '23.5'], { stdio: 'inherit' }).on('exit', code => code === 0 ? done() : fail(new Error(`${id}: ${code}`))));
if (!process.argv.includes('--skip-capture')) await Promise.all(TOURS.map(capture));
for (const [id, name, crf] of [['AppTourPoll', 'app-tour-1080p', 14], ['AppTourReel', 'app-tour-reel-1080x1920', 14], ['AppTourPoll4K', 'app-tour-4k', 12], ['AppTourReel4K', 'app-tour-reel-4k', 12]]) {
  const r = spawnSync('/usr/bin/node', [path.join(here, 'node_modules/.bin/remotion'), 'render', 'src/index.ts', id, path.resolve(here, `../downloads/${name}.mp4`),
    `--public-dir=${frames}`, '--codec=h264', `--crf=${crf}`, '--x264-preset=slow', '--pixel-format=yuv420p', '--log=error'], { cwd: here, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log(`✓ ${name}.mp4`);
}
