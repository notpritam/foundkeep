import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadCustomerRemoteMedia, runRemoteMediaProcess, type RemoteMediaRunner } from '../src/customer-remote-media.ts';

const HELPER_PATH = fileURLToPath(new URL('../scripts/customer-remote-media.py', import.meta.url));
let directory: string;
let fixture: string;
let audioFixture: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'foundkeep-remote-test-'));
  fixture = join(directory, 'fixture.mp4');
  const process = Bun.spawn(['/usr/bin/ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=96x64:rate=5', '-t', '1', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', fixture], { stdout: 'ignore', stderr: 'ignore' });
  expect(await process.exited).toBe(0);
  audioFixture = join(directory, 'fixture.m4a');
  const audio = Bun.spawn(['/usr/bin/ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'aac', '-threads', '1', audioFixture], { stdout: 'ignore', stderr: 'ignore' });
  expect(await audio.exited).toBe(0);
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

// Only the extractor is faked; ffmpeg and ffprobe run for real through the
// same seam so their arguments and output stay under test.
const downloaded: RemoteMediaRunner = async (spec, signal) => {
  if (!spec.args.includes(HELPER_PATH)) return runRemoteMediaProcess(spec, signal);
  await copyFile(fixture, join(spec.cwd, 'video.mp4'));
  return JSON.stringify({ status: 'downloaded', title: '<b>Public video</b>\u0000', description: 'Caption\r\nline', author: 'Alice', subtitles: [{ language: 'en', automatic: false, text: 'WEBVTT\n\n00:00.000 --> 00:01.000\nHello' }] });
};

test('returns an actual probed MP4, hash, source evidence and idempotent cleanup', async () => {
  const result = await downloadCustomerRemoteMedia('https://www.youtube.com/watch?v=test', {}, { runExtractor: downloaded });
  expect(result.status).toBe('downloaded');
  if (result.status !== 'downloaded') return;
  const bytes = await readFile(result.absolutePath);
  expect(result.mime).toBe('video/mp4');
  expect(result.bytes).toBe(bytes.length);
  expect(result.sha256).toBe(createHash('sha256').update(bytes).digest('base64url'));
  expect(result.sourceUrl).toBe('https://www.youtube.com/watch?v=test');
  expect(result.title).toBe('Public video');
  expect(result.subtitles[0]?.text).toContain('Hello');
  expect(result.durationSeconds).toBe(1);
  await result.dispose();
  await result.dispose();
  expect(await Bun.file(result.absolutePath).exists()).toBe(false);
});

test('rejects malformed output bytes and cleans all temporary artifacts', async () => {
  let temporary = '';
  const result = await downloadCustomerRemoteMedia('https://example.com/video.mp4', {}, { runExtractor: async ({ cwd }) => {
    temporary = cwd;
    await writeFile(join(cwd, 'video.mp4'), 'not an mp4');
    await writeFile(join(cwd, 'video.part'), 'partial');
    return '{"status":"downloaded"}';
  } });
  expect(result.status).toBe('error');
  expect(await readdir(temporary).catch(() => null)).toBe(null);
});

test('rejects oversized files even when the extractor claims success', async () => {
  const result = await downloadCustomerRemoteMedia('https://example.com/video.mp4', { maxBytes: 32 }, { runExtractor: downloaded });
  expect(result.status).toBe('too_large');
});

test('rejects symlink output and invalid extractor JSON', async () => {
  expect((await downloadCustomerRemoteMedia('https://example.com/video.mp4', {}, { runExtractor: async ({ cwd }) => {
    await symlink(fixture, join(cwd, 'video.mp4'));
    return '{"status":"downloaded"}';
  } })).status).toBe('error');
  expect((await downloadCustomerRemoteMedia('https://example.com/video.mp4', {}, { runExtractor: async () => 'not JSON' })).status).toBe('error');
});

test('initial unsafe sources never reach an extractor', async () => {
  for (const url of ['http://127.1/video.mp4', 'http://169.254.169.254/video.mp4', 'https://[::ffff:127.0.0.1]/v.mp4', 'file:///etc/passwd', 'https://user:password@example.com/video.mp4', 'https://example.com:444/video.mp4']) {
    const result = await downloadCustomerRemoteMedia(url, {}, { runExtractor: async () => { throw new Error('must not run'); } });
    expect(result.status).toBe('unsupported');
  }
});

test('retains explicit unavailability without exposing extractor errors or CDN URLs', async () => {
  const result = await downloadCustomerRemoteMedia('https://x.com/alice/status/123', {}, { runExtractor: async () => JSON.stringify({ status: 'unavailable', message: 'secret-cdn-url' }) });
  expect(result).toEqual({ status: 'unavailable', reason: 'Public video is unavailable without authentication or additional platform support.' });
});

test('cancel and timeout kill the real child and clean partial files', async () => {
  for (const cancelled of [true, false]) {
    const controller = new AbortController();
    let temporary = '';
    const result = await downloadCustomerRemoteMedia('https://example.com/video.mp4', { signal: controller.signal, deadlineMs: cancelled ? 5_000 : 100 }, { runExtractor: async (spec, signal) => {
      temporary = spec.cwd;
      if (cancelled) setTimeout(() => controller.abort(), 100);
      return runRemoteMediaProcess({ ...spec, executable: '/usr/bin/python3', args: ['-I', '-c', 'import time; open("video.part","w").write("partial"); time.sleep(30)'] }, signal);
    } });
    expect(result.status).toBe(cancelled ? 'cancelled' : 'timeout');
    expect(await readdir(temporary).catch(() => null)).toBe(null);
  }
});

test('process runner isolates configuration and caps stdout', async () => {
  process.env.FOUNDKEEP_REMOTE_TEST_SECRET = 'do-not-inherit';
  const spec = { executable: '/usr/bin/python3', args: ['-I', '-c', 'import os,json; print(json.dumps(dict(os.environ)))'], cwd: directory, stdin: '' };
  try {
    const env = JSON.parse(await runRemoteMediaProcess(spec, new AbortController().signal));
    expect(env.FOUNDKEEP_REMOTE_TEST_SECRET).toBeUndefined();
    expect(env.HTTP_PROXY).toBeUndefined();
    expect(env.HOME).toBe(directory);
    expect(env.PYTHONPATH).toBeUndefined();
    await expect(runRemoteMediaProcess({ ...spec, args: ['-I', '-c', 'print("x" * 300000)'] }, new AbortController().signal)).rejects.toThrow();
  } finally { delete process.env.FOUNDKEEP_REMOTE_TEST_SECRET; }
});


test('the helper only ever gets a private per-download copy of the jar, then the tracks are muxed and probed', async () => {
  const sessions = await mkdtemp(join(tmpdir(), 'foundkeep-sessions-'));
  const cookieFile = join(sessions, 'reddit.txt');
  const jar = '# Netscape HTTP Cookie File\n.reddit.com\tTRUE\t/\tTRUE\t2000000000\tsession\tsecret\n';
  await writeFile(cookieFile, jar);
  await chmod(cookieFile, 0o600);
  const before = await stat(cookieFile);
  const commands: string[][] = [];
  const runner: RemoteMediaRunner = async (spec, signal) => {
    commands.push([spec.executable, ...spec.args]);
    if (spec.args.includes(HELPER_PATH)) {
      const input = JSON.parse(spec.stdin);
      // yt-dlp rewrites whatever jar it is handed, so the operator's own file
      // never travels; the copy dies with the temp directory.
      expect(input.cookieFile).toBe(join(spec.cwd, 'cookies.txt'));
      expect(await readFile(input.cookieFile, 'utf8')).toBe(jar);
      expect((await stat(input.cookieFile)).mode & 0o777).toBe(0o600);
      // Only the same-host MP4/M4A candidate survives the caller-side filter.
      expect(input.audioUrls).toEqual(['https://v.redd.it/abc/DASH_AUDIO_128.mp4']);
      await copyFile(fixture, join(spec.cwd, 'video.mp4'));
      await writeFile(join(spec.cwd, 'audio.m4a'), 'audio track');
      return JSON.stringify({ status: 'downloaded', subtitles: [], audio: true });
    }
    if (spec.args.includes('/usr/bin/ffmpeg')) { await copyFile(fixture, join(spec.cwd, 'muxed.mp4')); return ''; }
    return runRemoteMediaProcess(spec, signal);
  };
  const audioUrls = ['https://v.redd.it/abc/DASH_AUDIO_128.mp4', 'https://evil.test/DASH_audio.mp4', 'https://v.redd.it/abc/DASH_audio.txt'];
  const result = await downloadCustomerRemoteMedia('https://v.redd.it/abc/DASH_720.mp4', { cookieFile, audioUrls }, { runExtractor: runner, sessionsDirectory: sessions });
  expect(result.status).toBe('downloaded');
  expect(await readFile(cookieFile, 'utf8')).toBe(jar);
  expect((await stat(cookieFile)).mtimeMs).toBe(before.mtimeMs);
  const ffmpeg = commands.find(c => c.includes('/usr/bin/ffmpeg'))!;
  expect(ffmpeg.slice(0, 2)).toEqual(['/usr/bin/prlimit', `--fsize=${50 * 1024 * 1024}`]);
  expect(ffmpeg).toContain('-c');
  expect(ffmpeg).toContain('copy');
  expect(ffmpeg).toContain('-protocol_whitelist');
  // Both inputs are demuxer-pinned, exactly as the ffprobe line is.
  expect(ffmpeg.join(' ')).toContain('-f mov -i video.mp4 -f mov -i audio.m4a');
  expect(ffmpeg.at(-1)).toBe('muxed.mp4');
  const probe = commands.find(c => c.includes('/usr/bin/ffprobe'))!;
  expect(probe.at(-1)!.endsWith('muxed.mp4')).toBe(true);
  if (result.status === 'downloaded') {
    expect(result.absolutePath.endsWith('muxed.mp4')).toBe(true);
    await result.dispose();
  }
  await rm(sessions, { recursive: true, force: true });
});

test('a jar is forwarded only from a real directory inside a usable session root', async () => {
  const sessions = await mkdtemp(join(tmpdir(), 'foundkeep-sessions-'));
  const outside = await mkdtemp(join(tmpdir(), 'foundkeep-outside-'));
  const cookieFile = join(sessions, 'reddit.txt');
  for (const path of [cookieFile, join(outside, 'reddit.txt')]) {
    await writeFile(path, '# Netscape HTTP Cookie File\n');
    await chmod(path, 0o600);
  }
  await symlink(outside, join(sessions, 'linked'));
  const attempt = async (cookie: string, sessionsDirectory: string, expected: 'copy' | 'none') => {
    const result = await downloadCustomerRemoteMedia('https://v.redd.it/abc/DASH_720.mp4', { cookieFile: cookie }, { sessionsDirectory, runExtractor: async (spec) => {
      expect(JSON.parse(spec.stdin).cookieFile).toBe(expected === 'copy' ? join(spec.cwd, 'cookies.txt') : undefined);
      return JSON.stringify({ status: 'unavailable' });
    } });
    expect(result.status).toBe('unavailable');
  };
  // An unset-but-empty session directory is not a root that contains everything.
  await attempt(cookieFile, '', 'none');
  await attempt(cookieFile, '/', 'none');
  // A symlinked directory inside the root does not put its target inside it.
  await attempt(join(sessions, 'linked', 'reddit.txt'), sessions, 'none');
  for (const outsider of ['/etc/passwd', join(sessions, '..', 'escape.txt'), 'reddit.txt']) await attempt(outsider, sessions, 'none');
  await chmod(cookieFile, 0o644);
  await attempt(cookieFile, sessions, 'none');
  await chmod(cookieFile, 0o600);
  await attempt(cookieFile, sessions, 'copy');
  await rm(sessions, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

test('a failed mux is an error, never a silent fallback to the video track', async () => {
  for (const broken of ['throw', 'missing', 'empty'] as const) {
    let temporary = '';
    const result = await downloadCustomerRemoteMedia('https://v.redd.it/abc/DASH_720.mp4', {}, { runExtractor: async (spec, signal) => {
      if (spec.args.includes(HELPER_PATH)) {
        temporary = spec.cwd;
        await copyFile(fixture, join(spec.cwd, 'video.mp4'));
        await writeFile(join(spec.cwd, 'audio.m4a'), 'audio track');
        return JSON.stringify({ status: 'downloaded', subtitles: [], audio: true });
      }
      if (spec.args.includes('/usr/bin/ffmpeg')) {
        if (broken === 'throw') throw new Error('mux failed');
        if (broken === 'empty') await writeFile(join(spec.cwd, 'muxed.mp4'), '');
        return '';
      }
      return runRemoteMediaProcess(spec, signal);
    } });
    expect(result.status).toBe('error');
    expect(await readdir(temporary).catch(() => null)).toBe(null);
  }
});

test('an absent or empty audio track is an error rather than a mux of nothing', async () => {
  const result = await downloadCustomerRemoteMedia('https://v.redd.it/abc/DASH_720.mp4', {}, { runExtractor: async ({ cwd, args }) => {
    if (!args.includes(HELPER_PATH)) throw new Error('must not run');
    await copyFile(fixture, join(cwd, 'video.mp4'));
    return JSON.stringify({ status: 'downloaded', subtitles: [], audio: true });
  } });
  expect(result.status).toBe('error');
});

test('a real ffmpeg mux carries both tracks into the single probed file', async () => {
  const result = await downloadCustomerRemoteMedia('https://v.redd.it/abc/DASH_720.mp4', {}, { runExtractor: async (spec, signal) => {
    if (!spec.args.includes(HELPER_PATH)) return runRemoteMediaProcess(spec, signal);
    await copyFile(fixture, join(spec.cwd, 'video.mp4'));
    await copyFile(audioFixture, join(spec.cwd, 'audio.m4a'));
    return JSON.stringify({ status: 'downloaded', subtitles: [], audio: true });
  } });
  expect(result.status).toBe('downloaded');
  if (result.status !== 'downloaded') return;
  expect(result.absolutePath.endsWith('muxed.mp4')).toBe(true);
  const probe = JSON.parse(await runRemoteMediaProcess({ executable: '/usr/bin/ffprobe', args: ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'json', result.absolutePath], cwd: directory, stdin: '' }, new AbortController().signal));
  expect(probe.streams.map((stream: { codec_name: string }) => stream.codec_name).sort()).toEqual(['aac', 'h264']);
  await result.dispose();
});
