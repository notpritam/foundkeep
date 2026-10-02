#!/usr/bin/env node
// The shortlist film: captures the three shortlisted sign-in screens from the
// running design system frame by frame (../scripts/capture-story.mjs), then
// renders them side by side on a moving gradient, no words → design-system/
// downloads: sign-in-poll-1080p.mp4 and -4k.mp4 (wide), sign-in-reel-1080x1920.mp4
// and -4k.mp4 (tall, for Reels).
//   /usr/bin/node design-system/film/poll.mjs [--skip-capture]
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

const here = import.meta.dirname, frames = path.join(homedir(), '.cache/fk-poll');
const SCREENS = [['1', 'current-sign-in--sign-in-screen'], ['2', 'proposals-sign-in--with-film'], ['3', 'proposals-sign-in--with-film-on-sky']];
const capture = ([dir, id]) => new Promise((done, fail) => spawn('/usr/bin/node', [path.join(here, '../scripts/capture-story.mjs'), 'http://localhost:8814/app', id, path.join(frames, dir), '--seconds', '13'], { stdio: 'inherit' }).on('exit', code => code === 0 ? done() : fail(new Error(`${id}: ${code}`))));
if (!process.argv.includes('--skip-capture')) await Promise.all(SCREENS.map(capture));
for (const [id, name, crf] of [['SignInPoll', 'sign-in-poll-1080p', 14], ['SignInPoll4K', 'sign-in-poll-4k', 12], ['SignInReel', 'sign-in-reel-1080x1920', 14], ['SignInReel4K', 'sign-in-reel-4k', 12]]) {
  const r = spawnSync('/usr/bin/node', [path.join(here, 'node_modules/.bin/remotion'), 'render', 'src/index.ts', id, path.resolve(here, `../downloads/${name}.mp4`),
    `--public-dir=${frames}`, '--codec=h264', `--crf=${crf}`, '--x264-preset=slow', '--pixel-format=yuv420p', '--log=error'], { cwd: here, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
