#!/usr/bin/env node
// Renders the sign-in films into the app — an MP4 (H.264) and a poster frame
// each — and puts copies, with four keyframe stills and the AI video prompts,
// in design-system/downloads (served by the design system at /downloads).
//   /usr/bin/node design-system/film/render.mjs
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const here = import.meta.dirname, out = path.resolve(here, '../../apps/mobile/assets/video'), downloads = path.resolve(here, '../downloads');
const remotion = path.join(here, 'node_modules/.bin/remotion');
const run = args => { const r = spawnSync('/usr/bin/node', [remotion, ...args, '--log=error'], { cwd: here, stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status ?? 1); };
const FILMS = [['SignInFilm', 'sign-in-film'], ['SignInFilmSoft', 'sign-in-film-soft']];

await mkdir(downloads, { recursive: true });
for (const [id, name] of FILMS) {
  run(['render', 'src/index.ts', id, path.join(out, `${name}.mp4`), '--codec=h264', '--crf=23', '--pixel-format=yuv420p']);
  // The poster: the library with everything in it, shown before the film plays and with Reduce Motion.
  run(['still', 'src/index.ts', id, path.join(out, `${name}.jpg`), '--frame=150', '--image-format=jpeg', '--jpeg-quality=85']);
  await copyFile(path.join(out, `${name}.mp4`), path.join(downloads, `${name}.mp4`));
}
// One still per scene, for image-to-video tools.
for (const [frame, scene] of [[40, '1-share'], [150, '2-one-place'], [226, '3-find'], [310, '4-agent']]) run(['still', 'src/index.ts', 'SignInFilm', path.join(downloads, `sign-in-film-${scene}.png`), `--frame=${frame}`]);
await copyFile(path.join(here, 'AI-VIDEO-PROMPTS.md'), path.join(downloads, 'sign-in-film-ai-prompts.md'));
