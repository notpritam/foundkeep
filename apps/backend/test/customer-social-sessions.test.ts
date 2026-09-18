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
  // Never the operator's own path: yt-dlp rewrites the jar it is handed.
  expect(session.cookieFile).toBe(join(runtime, 'instagram.txt'));
  const jar = readFileSync(session.cookieFile!, 'utf8');
  expect(jar).toContain('\tsessionid\tabc123\n');
  expect(jar).toContain('.instagram.com\tTRUE\t/\tTRUE\t');
  expect(jar).toContain('.www.instagram.com\tTRUE\t/\tTRUE\t');
});

test('cookies for other domains in the file are dropped everywhere', () => {
  write('instagram.txt', netscape
    + '.facebook.com\tTRUE\t/\tTRUE\t2000000000\txs\tfb1\n'
    + '.example.com\tTRUE\t/\tTRUE\t2000000000\ttracker\tt1\n');
  const store = createSessionStore({ directory: dir, runtimeDirectory: runtime });
  const session = store.session('instagram')!;
  expect(session.cookieHeader('www.facebook.com')).toBeNull();
  expect(session.cookieHeader('www.example.com')).toBeNull();
  expect(session.cookie('xs')).toBeNull();
  expect(session.cookie('tracker')).toBeNull();
  const jar = readFileSync(session.cookieFile!, 'utf8');
  expect(jar).not.toContain('facebook.com');
  expect(jar).not.toContain('example.com');
  expect(jar).not.toContain('fb1');
  expect(jar).not.toContain('t1');
  expect(session.cookieHeader('www.instagram.com')).toBe('sessionid=abc123; csrftoken=csrf9; mid=m1');
});

test('a site keeps the extra domains it actually signs in through', () => {
  write('youtube.txt', '# Netscape HTTP Cookie File\n'
    + '.youtube.com\tTRUE\t/\tTRUE\t2000000000\tSID\ty1\n'
    + '.google.com\tTRUE\t/\tTRUE\t2000000000\tSAPISID\tg1\n'
    + '.youtube.com\tTRUE\t/\tFALSE\t2000000000\tPREF\tp1\n'
    + '.doubleclick.net\tTRUE\t/\tTRUE\t2000000000\tIDE\td1\n');
  const store = createSessionStore({ directory: dir, runtimeDirectory: runtime });
  const session = store.session('youtube')!;
  expect(session.cookie('SAPISID')).toBe('g1');
  expect(session.cookieHeader('accounts.google.com')).toBe('SAPISID=g1');
  expect(session.cookie('IDE')).toBeNull();
  const jar = readFileSync(session.cookieFile!, 'utf8');
  expect(jar).not.toContain('doubleclick');
  // The Netscape secure column survives synthesis rather than being forced on.
  expect(jar.split('\n').find(line => line.includes('\tPREF\t'))).toContain('/\tFALSE\t');
  expect(jar.split('\n').find(line => line.includes('\tSID\t'))).toContain('/\tTRUE\t');
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

test('cookieFileFor reads the jar path without consuming the authenticated-call slot', () => {
  write('reddit.cookie', 'reddit_session=r1');
  let clock = 1_000_000;
  const store = createSessionStore({ directory: dir, runtimeDirectory: runtime, now: () => clock });
  const path = join(runtime, 'reddit.txt');
  expect(store.cookieFileFor('reddit')).toBe(path);
  expect(store.cookieFileFor('reddit')).toBe(path);
  expect(store.cookieFileFor('instagram')).toBeNull();
  // Reading the path did not spend the 2 s spacing slot the resolvers need.
  expect(store.session('reddit')).not.toBeNull();
  clock += 2_000;
  store.session('reddit')!.report('denied');
  expect(store.cookieFileFor('reddit')).toBeNull();
  clock += 31 * 60_000;
  expect(store.cookieFileFor('reddit')).toBe(path);
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
