#!/usr/bin/env node
// Renders the sign-in film into the app: an MP4 (H.264) and a poster frame.
//   /usr/bin/node design-system/film/render.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const here = import.meta.dirname, out = path.resolve(here, '../../apps/mobile/assets/video');
const remotion = path.join(here, 'node_modules/.bin/remotion');
const run = args => { const r = spawnSync('/usr/bin/node', [remotion, ...args], { cwd: here, stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status ?? 1); };
run(['render', 'src/index.ts', 'SignInFilm', path.join(out, 'sign-in-film.mp4'), '--codec=h264', '--crf=23', '--pixel-format=yuv420p', '--log=error']);
// The poster: the library with everything in it, shown before the video plays and when motion is reduced.
run(['still', 'src/index.ts', 'SignInFilm', path.join(out, 'sign-in-film.jpg'), '--frame=150', '--image-format=jpeg', '--jpeg-quality=85', '--log=error']);
