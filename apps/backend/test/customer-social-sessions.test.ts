import { afterEach, beforeEach, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createSessionStore } from '../src/customer-social-sessions.ts';
let dir: string, runtime: string;
beforeEach(() => { dir = mkdtempSync('/tmp/foundkeep-sessions-'); runtime = mkdtempSync('/tmp/foundkeep-sessions-runtime-'); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); rmSync(runtime, { recursive: true, force: true }); });
const netscape = '# Netscape HTTP Cookie File\n.instagram.com\tTRUE\t/\tTRUE\t2000000000\tsessionid\tabc123\n#HttpOnly_.instagram.com\tTRUE\t/\tTRUE\t2000000000\tcsrftoken\tcsrf9\nwww.instagram.com\tFALSE\t/\tTRUE\t2000000000\tmid\tm1\n';
function write(name: string, body: string, mode = 0o600) { const path = join(dir, name); writeFileSync(path, body); chmodSync(path, mode); return path; }

test('Netscape files scope cookies to matching hosts only', () => {
  write('instagram.txt', netscape);
  const store = createSessionStore({ directory: dir, runtimeDirectory: runtime });
  const session = store.session('instagram')!;
  expect(session.cookieHeader('www.instagram.com')).toBe('sessionid=abc123; csrftoken=csrf9; mid=m1');
  expect(session.cookieHeader('i.instagram.com')).toBe('sessionid=abc123; csrftoken=csrf9');
  expect(session.cookieHeader('instagram.com.evil.test')).toBeNull();
  expect(session.cookieHeader('scontent.cdninstagram.com')).toBeNull();
  expect(session.cookie('csrftoken')).toBe('csrf9');
  expect(session.cookieFile).toBe(join(dir, 'instagram.txt'));
});

test('raw cookie files are scoped to the platform domain and synthesized for yt-dlp', () => {
  write('linkedin.cookie', 'li_at=tok; JSESSIONID="ajax:42"\n');
  const store = createSessionStore({ directory: dir, runtimeDirectory: runtime });
  const session = store.session('linkedin')!;
  expect(session.cookieHeader('www.linkedin.com')).toBe('li_at=tok; JSESSIONID="ajax:42"');
  expect(session.cookieHeader('media.licdn.com')).toBeNull();
  expect(session.cookie('JSESSIONID')).toBe('"ajax:42"');
  const file = readFileSync(session.cookieFile!, 'utf8');
  expect(session.cookieFile).toBe(join(runtime, 'linkedin.txt'));
  expect(file).toContain('.linkedin.com\tTRUE\t/\tTRUE\t');
  expect(file).toContain('\tli_at\ttok\n');
});

test('world-readable, oversized, symlinked and unknown files are ignored', () => {
  write('instagram.txt', netscape, 0o644);
  write('reddit.cookie', 'x'.repeat(300 * 1024));
  write('notes.md', 'ignore me');
  const store = createSessionStore({ directory: dir, runtimeDirectory: runtime });
  expect(store.session('instagram')).toBeNull();
  expect(store.session('reddit')).toBeNull();
  expect(store.session('notes')).toBeNull();
  expect(store.describe()).toBe('social sessions: none');
});

test('breaker cools down on denial and login, shorter on rate limits, and spaces authenticated calls', () => {
  write('reddit.cookie', 'reddit_session=r1');
  let clock = 1_000_000;
  const store = createSessionStore({ directory: dir, runtimeDirectory: runtime, now: () => clock });
  expect(store.session('reddit')).not.toBeNull();
  expect(store.session('reddit')).toBeNull(); // within 2 s spacing
  clock += 2_000;
  store.session('reddit')!.report('ratelimited');
  clock += 9 * 60_000; expect(store.session('reddit')).toBeNull();
  clock += 61_000; expect(store.session('reddit')).not.toBeNull();
  clock += 2_000;
  store.session('reddit')!.report('login');
  clock += 29 * 60_000; expect(store.session('reddit')).toBeNull();
  clock += 61_000; expect(store.session('reddit')).not.toBeNull();
  expect(store.describe()).toBe('social sessions: reddit');
});

test('files are reloaded when they change and describe() never includes values', () => {
  const path = write('x.cookie', 'auth_token=a1; ct0=c1');
  let clock = 5_000_000;
  const store = createSessionStore({ directory: dir, runtimeDirectory: runtime, now: () => clock });
  expect(store.session('x')!.cookie('ct0')).toBe('c1');
  clock += 31_000;
  writeFileSync(path, 'auth_token=a2; ct0=c2'); chmodSync(path, 0o600);
  const future = new Date(Date.now() + 5_000); require('node:fs').utimesSync(path, future, future);
  clock += 2_000;
  expect(store.session('x')!.cookie('ct0')).toBe('c2');
  expect(store.describe()).not.toContain('c2');
});

test('missing directory yields an empty store without throwing', () => {
  const store = createSessionStore({ directory: join(dir, 'absent'), runtimeDirectory: runtime });
  expect(store.session('instagram')).toBeNull();
  expect(store.describe()).toBe('social sessions: none');
});
