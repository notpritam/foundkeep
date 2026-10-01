#!/usr/bin/env node
// Renders the sign-in films. For each: a 4K master (3456 × 3840, near-lossless
// H.264) to download; a 4K copy light enough to stream (the design system's
// previews play it); and the app's copy (1080 × 1200) downsampled from the
// master — small text stays sharper that way than rendered small — plus a poster.
// Copies, a still per scene and the AI video prompts go to design-system/downloads
// (served by the design system at /downloads).
//   /usr/bin/node design-system/film/render.mjs
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const here = import.meta.dirname, out = path.resolve(here, '../../apps/mobile/assets/video'), downloads = path.resolve(here, '../downloads');
const bin = name => path.join(here, 'node_modules/.bin', name);
const run = (args, tool = 'remotion') => { const r = spawnSync('/usr/bin/node', [bin('remotion'), ...(tool === 'ffmpeg' ? ['ffmpeg', ...args] : [...args, '--log=error'])], { cwd: here, stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status ?? 1); };
const FILMS = [['SignInFilm', 'sign-in-film'], ['SignInFilmSoft', 'sign-in-film-soft']];

await mkdir(downloads, { recursive: true });
for (const [id, name] of FILMS) {
  const master = path.join(downloads, `${name}-4k.mp4`);
  run(['render', 'src/index.ts', `${id}4K`, master, '--codec=h264', '--crf=8', '--x264-preset=slow', '--pixel-format=yuv420p', '--concurrency=8']);
  // The app's copy: downsampled from the master (Lanczos), tuned for flat graphics and text.
  run(['-y', '-loglevel', 'error', '-i', master, '-vf', 'scale=1080:1200:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(out, `${name}.mp4`)], 'ffmpeg');
  // The poster: the library with everything in it, shown before the film plays and with Reduce Motion.
  run(['still', 'src/index.ts', id, path.join(out, `${name}.jpg`), '--frame=150', '--image-format=jpeg', '--jpeg-quality=92']);
  await copyFile(path.join(out, `${name}.mp4`), path.join(downloads, `${name}.mp4`));
  // A 4K copy light enough to stream, for the design system's previews and the shareable videos.
  run(['-y', '-loglevel', 'error', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(downloads, `${name}-4k-web.mp4`)], 'ffmpeg');
}
// One still per scene, for image-to-video tools.
for (const [frame, scene] of [[40, '1-share'], [150, '2-one-place'], [226, '3-find'], [310, '4-agent']]) run(['still', 'src/index.ts', 'SignInFilm', path.join(downloads, `sign-in-film-${scene}.png`), `--frame=${frame}`]);
await copyFile(path.join(here, 'AI-VIDEO-PROMPTS.md'), path.join(downloads, 'sign-in-film-ai-prompts.md'));
