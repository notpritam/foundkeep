#!/usr/bin/env node
// The poll video: captures the three shortlisted sign-in screens from the
// running design system frame by frame (../scripts/capture-story.mjs), then
// renders them side by side at 1920 × 1080 → design-system/downloads/sign-in-poll-1080p.mp4.
//   /usr/bin/node design-system/film/poll.mjs [--skip-capture]
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

const here = import.meta.dirname, frames = path.join(homedir(), '.cache/fk-poll');
const SCREENS = [['1', 'proposals-sign-in--first-screen'], ['2', 'proposals-sign-in--with-film'], ['3', 'proposals-sign-in--with-film-on-sky']];
const capture = ([dir, id]) => new Promise((done, fail) => spawn('/usr/bin/node', [path.join(here, '../scripts/capture-story.mjs'), 'http://localhost:8814/app', id, path.join(frames, dir), '--seconds', '13'], { stdio: 'inherit' }).on('exit', code => code === 0 ? done() : fail(new Error(`${id}: ${code}`))));
if (!process.argv.includes('--skip-capture')) await Promise.all(SCREENS.map(capture));
const r = spawnSync('/usr/bin/node', [path.join(here, 'node_modules/.bin/remotion'), 'render', 'src/index.ts', 'SignInPoll', path.resolve(here, '../downloads/sign-in-poll-1080p.mp4'),
  `--public-dir=${frames}`, '--codec=h264', '--crf=14', '--x264-preset=slow', '--pixel-format=yuv420p', '--log=error'], { cwd: here, stdio: 'inherit' });
process.exit(r.status ?? 1);
