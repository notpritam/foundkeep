# Social Resolvers with Operator Sessions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve full posts (text, author, date, images, video, linked article) from Reddit, Instagram, LinkedIn, Bluesky, YouTube and other social links the way X posts are preserved today, using anonymous endpoints first and an operator-supplied cookie session where a platform blocks server access.

**Architecture:** A per-platform resolver registry (`customer-social.ts`) returns the same manifest shape the X path already uses, so the existing preservation pipeline (`customer-preservation.ts`) only changes its gating and messages. A session store (`customer-social-sessions.ts`) loads per-platform cookie files, scopes cookies by host on every redirect hop, and trips a breaker on denials. The hardened public reader gains headers/cookies; the yt-dlp sandbox gains an optional cookie file and a direct video+audio download that TS muxes with ffmpeg.

**Tech Stack:** Bun + TypeScript (backend, `bun test`), `linkedom` for HTML, Python 3.14 + pinned yt-dlp 2026.08.19 (`scripts/customer-remote-media.py`, `unittest`), `/usr/bin/ffmpeg` + `/usr/bin/ffprobe` under `prlimit`.

**Spec:** `docs/superpowers/specs/2026-09-18-social-resolvers-design.md` (read it first; background in `2026-09-18-social-media-resolvers.md`).

## Global Constraints

- All work is in `apps/backend` unless a path says otherwise. Run tests from `apps/backend`: `bun test <file>` for one file, `bun test` for all (baseline: 392 pass, ~40 s). Python: `/home/pritam/.local/share/foundkeep-media-runtime/yt-dlp-2026.8.19/bin/python3 -m unittest scripts/test_customer_remote_media.py` (baseline: 15 pass).
- Public network rules never weaken: pinned DNS, public addresses only, bounded bytes and time, no proxy, yt-dlp version pin `2026.08.19`, no plugins, no `cookiesfrombrowser`.
- Cookie values, cookie file contents and authenticated response bodies are never logged, never placed in job `error` text, never returned by any API.
- Media URLs are allow-listed per platform CDN before download; anything else is dropped and marks the manifest `incomplete`.
- User-facing strings follow the existing tone: short, neutral, no exclamation marks. Platform names: `X`, `Reddit`, `Instagram`, `LinkedIn`, `Bluesky`, `YouTube`, `This site`.
- Existing test style: Bun `test`/`expect`, fake `PublicReader` functions, fixtures under `test/fixtures/`. New fixtures go under `test/fixtures/social/`.
- Commit after every task on branch `feat/social-resolvers` with the message given in the task. Do not push.
- `PATH` must include `/home/pritam/.bun/bin` and `/usr/bin` (`export PATH=/home/pritam/.bun/bin:/usr/bin:$PATH`) — the login shell profile is broken for non-interactive use.

---

## File map

| File | Responsibility |
|---|---|
| `src/customer-social-sessions.ts` (new) | Load `<platform>.txt` (Netscape) / `<platform>.cookie` (raw header) files, host-scoped cookie headers, synthesized Netscape file for yt-dlp, breaker + spacing, `describe()` for the startup log. |
| `src/customer-public-resource.ts` (modify) | `headers`, per-hop `cookies(host)`, typed `PublicResourceError` with status. |
| `src/customer-preview.ts` (modify) | `requestPinned` accepts extra headers (never overriding `Host`/`Accept-Encoding`). |
| `src/customer-social.ts` (new) | `socialPost` canonicaliser for every platform, `SocialManifest`, `platformLabel`, resolver registry, `resolveSocialPost`, generic resolver. |
| `src/customer-source.ts` (modify) | export `blockedRoute`. |
| `src/customer-twitter.ts` (modify) | `TwitterManifest.media[]` gains optional `audioUrls`. |
| `src/customer-remote-preservation.ts` (modify) | more hosts in `remoteVideoCandidate`; `preserveRemoteVideo` forwards `cookieFile`/`audioUrls`. |
| `src/customer-remote-media.ts` + `scripts/customer-remote-media.py` (modify) | optional `cookieFile` (validated) and `audioUrls`; ffmpeg mux of `video.mp4` + `audio.m4a`. |
| `src/customer-preservation.ts`, `src/customer-preservation-routes.ts`, `src/customer.ts`, `src/index.ts` (modify) | gate on `socialPost`, platform-aware messages, transcript asset from video path, sessions wired in, startup log line. |
| `src/customer-reddit.ts`, `src/customer-instagram.ts`, `src/customer-linkedin.ts`, `src/customer-bluesky.ts`, `src/customer-youtube.ts` (new) | one resolver each, exporting `resolve<Platform>` and pure parsers. |
| `docs/SOCIAL-SESSIONS-SETUP.md` (new) | operator instructions. |

Shared interfaces (defined in Task 3, used everywhere):

```ts
// src/customer-social.ts
export type SocialPlatform = 'x' | 'reddit' | 'instagram' | 'linkedin' | 'bluesky' | 'youtube' | 'generic';
/** `site` is the session file name for the host (x, reddit, instagram, linkedin, bluesky, youtube, tiktok, threads, facebook, pinterest, tumblr, vimeo, twitch, dailymotion). */
export type SocialPost = { platform: SocialPlatform; site: string; id: string; url: string };
export type SocialMedia = { kind: 'image' | 'video'; url: string; audioUrls?: string[] };
export type SocialManifest = {
  text: string; author: string; publishedAt: string | null; media: SocialMedia[]; links: string[];
  metadataAvailable: boolean; incomplete?: boolean;
  /** The platform refused server access (login wall, 401/403/429); pipeline adds a neutral note. */
  restricted?: boolean;
};
export type SocialResolverDeps = { read: PublicReader; session: (site: string) => PlatformSession | null; source: (url: string) => Promise<SourceSnapshot> };
export type SocialResolver = (post: SocialPost, hints: SocialContext, signal: AbortSignal, deps: SocialResolverDeps) => Promise<SocialManifest>;
```

```ts
// src/customer-social-sessions.ts
export type SessionOutcome = 'ok' | 'denied' | 'ratelimited' | 'login';
export type PlatformSession = {
  site: string;
  /** Cookies whose domain matches `host` (exact or dot-suffix), as a Cookie header value; null when none match. */
  cookieHeader(host: string): string | null;
  /** Absolute path to a Netscape cookies.txt for yt-dlp (source file or a synthesized one). */
  cookieFile: string | null;
  /** Raw value of one cookie (e.g. csrftoken, JSESSIONID) or null. */
  cookie(name: string): string | null;
  report(outcome: SessionOutcome): void;
};
export type SessionStore = { session(site: string): PlatformSession | null; describe(): string };
```

```ts
// src/customer-public-resource.ts
export type PublicReadOptions = {
  maxBytes: number; signal: AbortSignal; accept?: string;
  headers?: Record<string, string>;
  /** Evaluated per redirect hop with the hop's hostname. */
  cookies?: (host: string) => string | null;
};
export type PublicResource = { url: string; mime: string; data: Buffer; status: number };
export class PublicResourceError extends Error { readonly status: number; readonly url: string }
export type PublicReader = (url: string, options: PublicReadOptions) => Promise<PublicResource>;
```

---

### Task 0: Branch and baseline

**Files:** none

- [ ] **Step 1: Create the branch and commit pending work**

```bash
cd /home/pritam/personal/apps/foundkeep-scenic-landing
git checkout -b feat/social-resolvers
git add apps/mobile/share-extension/Info.plist apps/mobile/scripts/config.test.mjs apps/mobile/scripts/verify-ios-project.mjs
git commit -m "fix(ios): show the share extension in every host app (activation dictionary v2)"
git add docs/superpowers/specs/2026-09-18-social-media-resolvers.md docs/superpowers/specs/2026-09-18-social-resolvers-design.md docs/superpowers/plans/2026-09-18-social-resolvers.md
git commit -m "docs: social resolvers research, design and plan"
```

- [ ] **Step 2: Confirm baseline**

Run: `cd apps/backend && export PATH=/home/pritam/.bun/bin:/usr/bin:$PATH && bun test 2>&1 | tail -4`
Expected: `392 pass`, `0 fail`.

---

### Task 1: Session store

**Files:**
- Create: `src/customer-social-sessions.ts`
- Test: `test/customer-social-sessions.test.ts`

**Interfaces:**
- Consumes: `config.dataDir` from `src/config.ts`.
- Produces: `createSessionStore(options?: { directory?: string; runtimeDirectory?: string; now?: () => number }): SessionStore`, `socialSessions: SessionStore` (default instance), types `PlatformSession`, `SessionStore`, `SessionOutcome` as in the file map.

- [ ] **Step 1: Write the failing tests**

```ts
// test/customer-social-sessions.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test test/customer-social-sessions.test.ts`
Expected: FAIL — cannot resolve `../src/customer-social-sessions.ts`.

- [ ] **Step 3: Implement the store**

```ts
// src/customer-social-sessions.ts
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { config } from './config.ts';

export type SessionOutcome = 'ok' | 'denied' | 'ratelimited' | 'login';
export type PlatformSession = {
  site: string;
  cookieHeader(host: string): string | null;
  cookieFile: string | null;
  cookie(name: string): string | null;
  report(outcome: SessionOutcome): void;
};
export type SessionStore = { session(site: string): PlatformSession | null; describe(): string };

type Cookie = { domain: string; hostOnly: boolean; name: string; value: string };
type Loaded = { site: string; cookies: Cookie[]; cookieFile: string | null; mtimeMs: number };

/** Registrable domain per site. Raw `.cookie` files are scoped to `.<domain>`. */
export const SITE_DOMAINS: Record<string, string> = {
  x: 'x.com', reddit: 'reddit.com', instagram: 'instagram.com', linkedin: 'linkedin.com', bluesky: 'bsky.app',
  youtube: 'youtube.com', tiktok: 'tiktok.com', threads: 'threads.net', facebook: 'facebook.com',
  pinterest: 'pinterest.com', tumblr: 'tumblr.com', vimeo: 'vimeo.com', twitch: 'twitch.tv', dailymotion: 'dailymotion.com',
};
const MAX_FILE = 256 * 1024, RELOAD_MS = 30_000, SPACING_MS = 2_000;
const COOLDOWN: Record<Exclude<SessionOutcome, 'ok'>, number> = { denied: 30 * 60_000, login: 30 * 60_000, ratelimited: 10 * 60_000 };

function privateRegularFile(path: string): { mtimeMs: number } | null {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE || (stat.mode & 0o077) !== 0) return null;
    return { mtimeMs: stat.mtimeMs };
  } catch { return null; }
}
function parseNetscape(body: string): Cookie[] {
  const cookies: Cookie[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) continue;
    const parts = line.replace(/^#HttpOnly_/, '').split('\t');
    if (parts.length < 7) continue;
    const domain = parts[0]!.toLowerCase(), name = parts[5]!, value = parts.slice(6).join('\t');
    if (!domain || !name) continue;
    cookies.push({ domain: domain.replace(/^\./, ''), hostOnly: !domain.startsWith('.') && parts[1]!.toUpperCase() !== 'TRUE', name, value });
  }
  return cookies;
}
function parseRaw(body: string, domain: string): Cookie[] {
  return body.split('\n')[0]!.split(';').map(part => part.trim()).filter(Boolean).flatMap(part => {
    const at = part.indexOf('=');
    if (at <= 0) return [];
    return [{ domain, hostOnly: false, name: part.slice(0, at).trim(), value: part.slice(at + 1).trim() }];
  });
}
function matches(cookie: Cookie, host: string) {
  const h = host.toLowerCase();
  return cookie.hostOnly ? h === cookie.domain : h === cookie.domain || h.endsWith('.' + cookie.domain);
}

export function createSessionStore(options: { directory?: string; runtimeDirectory?: string; now?: () => number } = {}): SessionStore {
  const directory = options.directory ?? process.env.FOUNDKEEP_SOCIAL_SESSIONS_DIR ?? join(homedir(), '.config', 'foundkeep', 'social-sessions');
  const runtime = options.runtimeDirectory ?? join(config.dataDir, 'social-sessions');
  const now = options.now ?? Date.now;
  const loaded = new Map<string, Loaded>();
  const cooldownUntil = new Map<string, number>(), lastIssued = new Map<string, number>();
  let scannedAt = -Infinity;

  function synthesize(site: string, cookies: Cookie[], mtimeMs: number): string | null {
    try {
      mkdirSync(runtime, { recursive: true, mode: 0o700 });
      const path = join(runtime, `${site}.txt`);
      const expiry = Math.floor(now() / 1000) + 365 * 86_400;
      const lines = cookies.map(c => `.${c.domain}\tTRUE\t/\tTRUE\t${expiry}\t${c.name}\t${c.value}`);
      writeFileSync(path, `# Netscape HTTP Cookie File\n${lines.join('\n')}\n`, { mode: 0o600 });
      chmodSync(path, 0o600);
      return path;
    } catch { return null; }
  }
  function scan() {
    if (now() - scannedAt < RELOAD_MS) return;
    scannedAt = now();
    let names: string[] = [];
    try { names = readdirSync(directory); } catch { loaded.clear(); return; }
    const seen = new Set<string>();
    for (const name of names) {
      const match = name.match(/^([a-z]+)\.(txt|cookie)$/);
      if (!match) continue;
      const site = match[1]!, kind = match[2]!;
      if (kind === 'cookie' && loaded.get(site)?.cookieFile?.startsWith(directory)) continue; // .txt wins
      const path = join(directory, name), stat = privateRegularFile(path);
      if (!stat) continue;
      seen.add(site);
      const previous = loaded.get(site);
      if (previous && previous.mtimeMs === stat.mtimeMs && (kind === 'txt' || !previous.cookieFile?.startsWith(directory))) continue;
      let cookies: Cookie[];
      try { cookies = kind === 'txt' ? parseNetscape(readFileSync(path, 'utf8')) : parseRaw(readFileSync(path, 'utf8'), SITE_DOMAINS[site] ?? `${site}.com`); }
      catch { continue; }
      if (!cookies.length) continue;
      loaded.set(site, { site, cookies, cookieFile: kind === 'txt' ? path : synthesize(site, cookies, stat.mtimeMs), mtimeMs: stat.mtimeMs });
    }
    for (const site of [...loaded.keys()]) if (!seen.has(site)) loaded.delete(site);
  }
  return {
    session(site) {
      scan();
      const entry = loaded.get(site);
      if (!entry) return null;
      const at = now();
      if ((cooldownUntil.get(site) ?? 0) > at) return null;
      if (at - (lastIssued.get(site) ?? -Infinity) < SPACING_MS) return null;
      lastIssued.set(site, at);
      return {
        site,
        cookieFile: entry.cookieFile,
        cookieHeader: host => { const list = entry.cookies.filter(c => matches(c, host)); return list.length ? list.map(c => `${c.name}=${c.value}`).join('; ') : null; },
        cookie: name => entry.cookies.find(c => c.name === name)?.value ?? null,
        report: outcome => { if (outcome !== 'ok') cooldownUntil.set(site, now() + COOLDOWN[outcome]); },
      };
    },
    describe() {
      scan();
      const sites = [...loaded.keys()].sort();
      return `social sessions: ${sites.length ? sites.join(', ') : 'none'}`;
    },
  };
}
export const socialSessions = createSessionStore();
```

Notes for the implementer: the `.txt`-wins rule must hold regardless of `readdir` order — sort `names` so `.txt` entries are processed before `.cookie` for the same site (`names.sort((a, b) => (a.endsWith('.txt') ? 0 : 1) - (b.endsWith('.txt') ? 0 : 1))`) and skip a `.cookie` file when a `.txt` for the same site was accepted in this scan. The "changed file" test bumps mtime; make sure the comparison uses `mtimeMs` from `lstatSync`.

- [ ] **Step 4: Run the tests**

Run: `bun test test/customer-social-sessions.test.ts`
Expected: 6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/customer-social-sessions.ts test/customer-social-sessions.test.ts
git commit -m "feat(social): operator session store with host-scoped cookies and breaker"
```

---

### Task 2: Public reader headers, cookies and typed status errors

**Files:**
- Modify: `src/customer-public-resource.ts`
- Modify: `src/customer-preview.ts:101-118` (`requestPinned`)
- Test: `test/customer-public-resource.test.ts` (create)

**Interfaces:**
- Produces: `PublicReadOptions` with `headers` and `cookies`, `PublicResource.status`, `PublicResourceError` (fields `status`, `url`), `requestPinned(target, signal, accept?, headers?)`.
- Existing callers (`customer-twitter.ts`, preservation image download) keep working unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
// test/customer-public-resource.test.ts
import { expect, test } from 'bun:test';
import { createPublicReader, PublicResourceError } from '../src/customer-public-resource.ts';
const body = (text: string) => (async function* () { yield new TextEncoder().encode(text); })();
test('headers and per-hop cookies reach the transport, and cookies re-scope on redirect', async () => {
  const seen: { host: string; headers: Record<string, string> }[] = [];
  const read = createPublicReader({
    resolve: async () => [{ address: '1.1.1.1', family: 4 }],
    transport: async (target, _signal, _accept, headers) => {
      seen.push({ host: target.url.host, headers: headers ?? {} });
      if (target.url.host === 'www.reddit.com') return { status: 302, headers: new Headers({ location: 'https://cdn.example.net/file.json' }), body: body(''), cancel() {} };
      return { status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: body('{"ok":true}'), cancel() {} };
    },
  });
  const result = await read('https://www.reddit.com/r/a/s/xyz', {
    maxBytes: 1024, signal: new AbortController().signal, accept: 'application/json',
    headers: { 'User-Agent': 'FoundKeep/1.0 test', Host: 'evil.test', 'Accept-Encoding': 'gzip' },
    cookies: host => (host === 'www.reddit.com' ? 'reddit_session=r1' : null),
  });
  expect(result.status).toBe(200);
  expect(result.url).toBe('https://cdn.example.net/file.json');
  expect(seen[0]!.headers).toEqual({ 'User-Agent': 'FoundKeep/1.0 test', Cookie: 'reddit_session=r1' });
  expect(seen[1]!.headers).toEqual({ 'User-Agent': 'FoundKeep/1.0 test' });
});
test('non-200 responses throw a typed error carrying status and final url', async () => {
  const read = createPublicReader({ resolve: async () => [{ address: '1.1.1.1', family: 4 }], transport: async () => ({ status: 403, headers: new Headers(), body: body('denied'), cancel() {} }) });
  const error = await read('https://www.instagram.com/p/abc/', { maxBytes: 10, signal: new AbortController().signal }).catch(e => e);
  expect(error).toBeInstanceOf(PublicResourceError);
  expect(error.status).toBe(403);
  expect(error.url).toBe('https://www.instagram.com/p/abc/');
  expect(error.message).not.toContain('denied');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/customer-public-resource.test.ts`
Expected: FAIL — `PublicResourceError` is not exported / `headers` not forwarded.

- [ ] **Step 3: Implement**

In `src/customer-preview.ts`, change `requestPinned` to accept and merge extra headers, never allowing `Host` or `Accept-Encoding` to be overridden:

```ts
const PROTECTED_HEADERS = new Set(['host', 'accept-encoding']);
export async function requestPinned(target: PreviewTarget, signal: AbortSignal, accept?: string, headers?: Record<string, string>): Promise<PreviewUpstream> {
  const base = previewRequestOptions(target);
  const merged: Record<string, string> = { ...(base.headers as Record<string, string>), ...(accept ? { Accept: accept } : {}) };
  for (const [key, value] of Object.entries(headers ?? {})) if (!PROTECTED_HEADERS.has(key.toLowerCase()) && /^[\x20-\x7e]*$/.test(value) && value.length <= 8192) merged[key] = value;
  return new Promise((resolve, reject) => {
    const request = (target.url.protocol === "https:" ? httpsRequest : httpRequest)(
      { ...base, headers: merged, signal },
      response => { /* unchanged body */ },
    );
    /* unchanged */
  });
}
```

Update the `transport` type in `PreviewOptions` and in `createPublicReader`/`createSourceFetcher` deps to `(target, signal, accept?, headers?) => Promise<PreviewUpstream>`.

In `src/customer-public-resource.ts`:

```ts
export type PublicReadOptions = { maxBytes: number; signal: AbortSignal; accept?: string; headers?: Record<string, string>; cookies?: (host: string) => string | null };
export type PublicResource = { url: string; mime: string; data: Buffer; status: number };
export class PublicResourceError extends Error {
  constructor(readonly status: number, readonly url: string) { super('The public source is unavailable.'); }
}
export type PublicReader = (url: string, options: PublicReadOptions) => Promise<PublicResource>;
```

Inside the hop loop, build headers per hop and pass them; throw the typed error on non-200 after redirects:

```ts
const hopHost = url.hostname.replace(/^\[|\]$/g, '');
const cookie = options.cookies?.(hopHost);
const headers: Record<string, string> = { ...(options.headers ?? {}) };
delete headers.Cookie; delete headers.cookie;
if (cookie) headers.Cookie = cookie;
response = await Promise.race([(deps.transport || requestPinned)({ ...addresses[0]!, url }, signal, options.accept || '*/*', headers), aborted]);
// redirect handling unchanged
if (response.status !== 200) throw new PublicResourceError(response.status, url.href);
if (!['', 'identity'].includes(response.headers.get('content-encoding') || '')) throw Error('The public source is unavailable.');
// … return { url: url.href, mime, data, status: response.status }
```

- [ ] **Step 4: Run the tests and the two existing suites that use the reader**

Run: `bun test test/customer-public-resource.test.ts test/customer-twitter.test.ts test/customer-source.test.ts test/customer-preview.test.ts`
Expected: all pass (existing tests untouched).

- [ ] **Step 5: Commit**

```bash
git add src/customer-public-resource.ts src/customer-preview.ts src/customer-source.ts test/customer-public-resource.test.ts
git commit -m "feat(reader): optional headers, per-hop cookies and typed status errors"
```

---

### Task 3: Social registry, canonicalisers, generic resolver

**Files:**
- Create: `src/customer-social.ts`
- Modify: `src/customer-twitter.ts` (`TwitterManifest.media` item type gains `audioUrls?: string[]`)
- Modify: `src/customer-source.ts` (add `export` to `blockedRoute`)
- Modify: `src/customer-remote-preservation.ts:19-26` (`remoteVideoCandidate` hosts)
- Test: `test/customer-social.test.ts`

**Interfaces:**
- Consumes: `twitterPost`, `resolveTwitterPost`, `SocialContext` from `customer-twitter.ts`; `fetchCustomerSource`, `blockedRoute`, `SourceSnapshot` from `customer-source.ts`; `remoteVideoCandidate` from `customer-remote-preservation.ts`; `PlatformSession`, `socialSessions` from Task 1; `PublicReader`, `readPublicResource` from Task 2.
- Produces: everything in the "Shared interfaces" block plus `socialPost`, `platformLabel`, `resolveSocialPost`, `resolveGeneric`, `registerSocialResolver(platform, resolver)`, `mediaHost(url, allowed: string[]): string | null` (helper used by every resolver: returns the https URL string when the host equals or is a subdomain of an allowed domain, no credentials, ≤ 4096 chars; else null), `isoDate(seconds: unknown): string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// test/customer-social.test.ts
import { expect, test } from 'bun:test';
import { socialPost, platformLabel, resolveSocialPost, mediaHost } from '../src/customer-social.ts';
test('canonicalises supported post links and rejects lookalikes and non-posts', () => {
  expect(socialPost('https://twitter.com/nasa/status/12345/photo/1')).toEqual({ platform: 'x', site: 'x', id: '12345', url: 'https://x.com/nasa/status/12345' });
  expect(socialPost('https://old.reddit.com/r/space/comments/1abc2d/title_here/?utm_source=share')).toEqual({ platform: 'reddit', site: 'reddit', id: '1abc2d', url: 'https://www.reddit.com/r/space/comments/1abc2d/' });
  expect(socialPost('https://www.reddit.com/r/space/s/AbCdEf123')).toEqual({ platform: 'reddit', site: 'reddit', id: 's:AbCdEf123', url: 'https://www.reddit.com/r/space/s/AbCdEf123' });
  expect(socialPost('https://redd.it/1abc2d')).toEqual({ platform: 'reddit', site: 'reddit', id: '1abc2d', url: 'https://www.reddit.com/comments/1abc2d/' });
  expect(socialPost('https://www.instagram.com/reel/C0dE_f-1/?igsh=x')).toEqual({ platform: 'instagram', site: 'instagram', id: 'C0dE_f-1', url: 'https://www.instagram.com/p/C0dE_f-1/' });
  expect(socialPost('https://www.linkedin.com/posts/jane-doe_ai-activity-7123456789012345678-AbCd?utm=1')).toEqual({ platform: 'linkedin', site: 'linkedin', id: '7123456789012345678', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/' });
  expect(socialPost('https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/')).toEqual({ platform: 'linkedin', site: 'linkedin', id: '7123456789012345678', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/' });
  expect(socialPost('https://bsky.app/profile/alice.bsky.social/post/3kabc')).toEqual({ platform: 'bluesky', site: 'bluesky', id: 'alice.bsky.social/3kabc', url: 'https://bsky.app/profile/alice.bsky.social/post/3kabc' });
  expect(socialPost('https://youtu.be/dQw4w9WgXcQ?si=abc')).toEqual({ platform: 'youtube', site: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  expect(socialPost('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ platform: 'youtube', site: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  expect(socialPost('https://www.tiktok.com/@user/video/7300000000000000000?is_from_webapp=1')).toEqual({ platform: 'generic', site: 'tiktok', id: 'https://www.tiktok.com/@user/video/7300000000000000000', url: 'https://www.tiktok.com/@user/video/7300000000000000000' });
  expect(socialPost('https://www.threads.net/@user/post/Cabc123')).toMatchObject({ platform: 'generic', site: 'threads' });
  for (const url of ['https://x.com.evil.test/a/status/1', 'https://www.reddit.com/r/space/', 'https://www.instagram.com/someuser/', 'https://www.linkedin.com/in/jane/', 'https://example.com/post/1', 'https://user@bsky.app/profile/a/post/b', 'file:///tmp/a'])
    expect(socialPost(url)).toBeNull();
});
test('labels are user-facing platform names', () => {
  expect(platformLabel('x')).toBe('X'); expect(platformLabel('linkedin')).toBe('LinkedIn'); expect(platformLabel('generic')).toBe('This site');
});
test('media host allow-list accepts subdomains only', () => {
  expect(mediaHost('https://i.redd.it/a.jpg', ['redd.it'])).toBe('https://i.redd.it/a.jpg');
  expect(mediaHost('https://redd.it.evil.test/a.jpg', ['redd.it'])).toBeNull();
  expect(mediaHost('http://i.redd.it/a.jpg', ['redd.it'])).toBeNull();
});
test('generic resolver turns page metadata into a manifest and flags login walls', async () => {
  const snapshot = (over: Partial<import('../src/customer-source.ts').SourceSnapshot>) => async (url: string) => ({ url, requestedUrl: url, fetchedAt: 1, contentHash: 'h', text: '', title: null, description: null, imageUrl: null, author: null, publishedAt: null, siteName: null, ...over });
  const ok = await resolveSocialPost('https://www.tiktok.com/@user/video/7300000000000000000', { version: 1, images: [], links: [], articleText: '' }, new AbortController().signal, {
    source: snapshot({ title: 'A clip', description: 'What it shows', text: 'What it shows', author: 'user', imageUrl: 'https://p16-sign.tiktokcdn.com/a.jpg', contentKind: 'video', extractionStatus: 'metadata-only' }),
    session: () => null,
  });
  expect(ok).toMatchObject({ text: 'A clip\n\nWhat it shows', author: 'user', metadataAvailable: true });
  expect(ok.media).toEqual([{ kind: 'video', url: 'https://www.tiktok.com/@user/video/7300000000000000000' }, { kind: 'image', url: 'https://p16-sign.tiktokcdn.com/a.jpg' }]);
  const walled = await resolveSocialPost('https://www.facebook.com/reel/123', { version: 1, images: [], links: [], articleText: '' }, new AbortController().signal, {
    source: snapshot({ url: 'https://www.facebook.com/login/?next=x', extractionStatus: 'unavailable' }), session: () => null,
  });
  expect(walled).toMatchObject({ metadataAvailable: false, restricted: true });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/customer-social.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/customer-twitter.ts`: change `media: { kind: "image" | "video"; url: string }[]` to `media: { kind: "image" | "video"; url: string; audioUrls?: string[] }[]`.
`src/customer-source.ts`: `export function blockedRoute(url:string)`.
`src/customer-remote-preservation.ts`: extend the host list in `remoteVideoCandidate`:

```ts
|| is('reddit.com') && /\/comments\//.test(u.pathname) || is('redd.it') || is('v.redd.it')
|| is('linkedin.com') && /^\/(?:posts\/|feed\/update\/)/.test(u.pathname)
|| is('tiktok.com') || is('threads.net') || is('threads.com') || is('facebook.com') && /\/(?:reel|videos|watch|share)\b/.test(u.pathname + u.search) || is('fb.watch')
|| is('pinterest.com') && /^\/pin\//.test(u.pathname) || is('vimeo.com') || is('twitch.tv') && /\/clip\//.test(u.pathname) || is('dailymotion.com') && /^\/video\//.test(u.pathname)
|| is('dms.licdn.com') || is('cdninstagram.com') || is('fbcdn.net')
```

`src/customer-social.ts`:

```ts
import { twitterPost, resolveTwitterPost, type SocialContext, type TwitterManifest } from './customer-twitter.ts';
import { readPublicResource, type PublicReader } from './customer-public-resource.ts';
import { fetchCustomerSource, blockedRoute, type SourceSnapshot } from './customer-source.ts';
import { remoteVideoCandidate } from './customer-remote-preservation.ts';
import { socialSessions, type PlatformSession } from './customer-social-sessions.ts';

export type SocialPlatform = 'x' | 'reddit' | 'instagram' | 'linkedin' | 'bluesky' | 'youtube' | 'generic';
export type SocialPost = { platform: SocialPlatform; site: string; id: string; url: string };
export type SocialMedia = { kind: 'image' | 'video'; url: string; audioUrls?: string[] };
export type SocialManifest = TwitterManifest & { restricted?: boolean };
export type SocialResolverDeps = { read: PublicReader; session: (site: string) => PlatformSession | null; source: (url: string) => Promise<SourceSnapshot> };
export type SocialResolver = (post: SocialPost, hints: SocialContext, signal: AbortSignal, deps: SocialResolverDeps) => Promise<SocialManifest>;

const LABELS: Record<SocialPlatform, string> = { x: 'X', reddit: 'Reddit', instagram: 'Instagram', linkedin: 'LinkedIn', bluesky: 'Bluesky', youtube: 'YouTube', generic: 'This site' };
export const platformLabel = (platform: SocialPlatform) => LABELS[platform];
export const EMPTY_MANIFEST = (): SocialManifest => ({ text: '', author: '', publishedAt: null, media: [], links: [], metadataAvailable: false });

function parse(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try { const u = new URL(raw); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !u.port ? u : null; } catch { return null; }
}
const host = (u: URL, domain: string) => u.hostname === domain || u.hostname.endsWith('.' + domain);
const GENERIC_SITES: [string, string, RegExp][] = [
  ['tiktok', 'tiktok.com', /^\/(?:@[^/]+\/(?:video|photo)\/\d+|t\/[\w-]+|[\w-]{6,})\/?$/], ['threads', 'threads.net', /^\/@[^/]+\/post\/[\w-]+\/?$/], ['threads', 'threads.com', /^\/@[^/]+\/post\/[\w-]+\/?$/],
  ['facebook', 'facebook.com', /^\/(?:reel\/\d+|share\/[rv]\/[\w-]+|[^/]+\/(?:videos|posts)\/[\w.-]+|watch\/?|photo\/?)/], ['facebook', 'fb.watch', /^\/[\w-]+\/?$/],
  ['pinterest', 'pinterest.com', /^\/pin\/\d+\/?$/], ['pinterest', 'pin.it', /^\/[\w-]+\/?$/], ['tumblr', 'tumblr.com', /^\/(?:[^/]+\/)?(?:post\/)?\d+/], ['vimeo', 'vimeo.com', /^\/(?:\d+|[^/]+\/\d+)\/?$/],
  ['twitch', 'twitch.tv', /\/clip\/[\w-]+/], ['twitch', 'clips.twitch.tv', /^\/[\w-]+\/?$/], ['dailymotion', 'dailymotion.com', /^\/video\/[\w-]+\/?$/],
];
const TRACKING = /^(utm_|igsh$|igshid$|si$|is_from_webapp$|sender_device$|share_id$|ref$|s$|t$|fbclid$|rdt$)/;
export function socialPost(raw: string | null | undefined): SocialPost | null {
  const u = parse(raw);
  if (!u) return null;
  const x = twitterPost(raw);
  if (x) return { platform: 'x', site: 'x', id: x.id, url: x.url };
  if (host(u, 'youtube.com') || host(u, 'youtu.be')) {
    const id = host(u, 'youtu.be') ? u.pathname.slice(1).split('/')[0] : u.pathname === '/watch' ? u.searchParams.get('v') : u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? { platform: 'youtube', site: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if (host(u, 'reddit.com') || host(u, 'redd.it')) {
    if (host(u, 'redd.it')) { const id = u.pathname.match(/^\/([a-z0-9]{2,10})\/?$/i)?.[1]; return id ? { platform: 'reddit', site: 'reddit', id, url: `https://www.reddit.com/comments/${id}/` } : null; }
    const share = u.pathname.match(/^\/r\/([\w]+)\/s\/([\w]+)\/?$/);
    if (share) return { platform: 'reddit', site: 'reddit', id: `s:${share[2]}`, url: `https://www.reddit.com/r/${share[1]}/s/${share[2]}` };
    const post = u.pathname.match(/^\/(?:r\/(\w+)\/|user\/\w+\/)?comments\/([a-z0-9]{2,10})(?:\/|$)/i);
    return post ? { platform: 'reddit', site: 'reddit', id: post[2]!, url: post[1] ? `https://www.reddit.com/r/${post[1]}/comments/${post[2]}/` : `https://www.reddit.com/comments/${post[2]}/` } : null;
  }
  if (host(u, 'instagram.com')) { const id = u.pathname.match(/^\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([\w-]{5,40})\/?$/)?.[1]; return id ? { platform: 'instagram', site: 'instagram', id, url: `https://www.instagram.com/p/${id}/` } : null; }
  if (host(u, 'linkedin.com')) {
    const id = u.pathname.match(/^\/posts\/[^/]*?-(\d{15,25})-[\w-]{4}\/?$/)?.[1] || u.pathname.match(/^\/feed\/update\/urn:li:(?:activity|ugcPost|share):(\d{15,25})\/?$/)?.[1];
    return id ? { platform: 'linkedin', site: 'linkedin', id, url: `https://www.linkedin.com/feed/update/urn:li:activity:${id}/` } : null;
  }
  if (host(u, 'bsky.app')) { const m = u.pathname.match(/^\/profile\/([\w.:-]+)\/post\/([\w]+)\/?$/); return m ? { platform: 'bluesky', site: 'bluesky', id: `${m[1]}/${m[2]}`, url: `https://bsky.app/profile/${m[1]}/post/${m[2]}` } : null; }
  for (const [site, domain, pattern] of GENERIC_SITES) if (host(u, domain) && pattern.test(u.pathname)) {
    const clean = new URL(u.href); clean.hash = '';
    for (const key of [...clean.searchParams.keys()]) if (TRACKING.test(key)) clean.searchParams.delete(key);
    return { platform: 'generic', site, id: clean.href, url: clean.href };
  }
  return null;
}
export function mediaHost(url: unknown, allowed: string[]): string | null {
  const u = parse(url);
  return u && u.protocol === 'https:' && allowed.some(domain => host(u, domain)) ? u.href : null;
}
export const isoDate = (seconds: unknown) => typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
export const isRestrictedStatus = (status: number) => status === 401 || status === 403 || status === 429;

export const resolveGeneric: SocialResolver = async (post, hints, signal, deps) => {
  let snapshot: SourceSnapshot | null = null;
  try { snapshot = await deps.source(post.url); } catch { /* unavailable page */ }
  signal.throwIfAborted();
  const restricted = !!snapshot && blockedRoute(snapshot.url);
  const media: SocialMedia[] = [];
  if (remoteVideoCandidate(post.url, snapshot)) media.push({ kind: 'video', url: post.url });
  if (snapshot?.imageUrl && !restricted) media.push({ kind: 'image', url: snapshot.imageUrl });
  const text = [snapshot?.title, snapshot?.text || snapshot?.description].filter((x, i, a) => x && a.indexOf(x) === i).join('\n\n');
  return { text: restricted ? '' : text, author: snapshot?.author || '', publishedAt: snapshot?.publishedAt || null, media, links: hints.links.slice(0, 3),
    metadataAvailable: !!snapshot && !restricted && snapshot.extractionStatus !== 'unavailable', restricted, incomplete: media.length === 0 };
};
const resolvers: Partial<Record<SocialPlatform, SocialResolver>> = {
  x: async (post, hints, signal, deps) => resolveTwitterPost(post.url, hints, signal, deps.read),
  generic: resolveGeneric,
};
export function registerSocialResolver(platform: SocialPlatform, resolver: SocialResolver) { resolvers[platform] = resolver; }
export async function resolveSocialPost(url: string, hints: SocialContext, signal: AbortSignal, deps: Partial<SocialResolverDeps> = {}): Promise<SocialManifest> {
  const post = socialPost(url);
  if (!post) throw Error('Use a public social post link.');
  const resolver = resolvers[post.platform] ?? resolveGeneric;
  return resolver(post, hints, signal, { read: deps.read ?? readPublicResource, session: deps.session ?? (site => socialSessions.session(site)), source: deps.source ?? fetchCustomerSource });
}
```

Note: the generic test expects `text` = `title + "\n\n" + description` when `text === description`; the dedupe filter above does that. Image allow-listing for generic uses the snapshot's already-validated `imageUrl`.

- [ ] **Step 4: Run tests**

Run: `bun test test/customer-social.test.ts test/customer-twitter.test.ts test/customer-remote-processing.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/customer-social.ts src/customer-twitter.ts src/customer-source.ts src/customer-remote-preservation.ts test/customer-social.test.ts
git commit -m "feat(social): post canonicaliser, resolver registry and generic metadata resolver"
```

---

### Task 4: Pipeline generalisation

**Files:**
- Modify: `src/customer-preservation.ts` (`enqueuePreservation`, `current`, tick body, `createPreservationService` options)
- Modify: `src/customer-preservation-routes.ts:50-60`
- Modify: `src/customer.ts:957`
- Modify: `src/index.ts` (log `socialSessions.describe()` at startup, after `openDb()`)
- Modify: `src/customer-remote-preservation.ts` (`preserveRemoteVideo` forwards `cookieFile`/`audioUrls`)
- Test: `test/customer-preservation.test.ts`, `test/customer-preservation-routes.test.ts`

**Interfaces:**
- Consumes: `socialPost`, `platformLabel`, `resolveSocialPost`, `SocialManifest` (Task 3); `SessionStore`, `socialSessions` (Task 1).
- Produces: `createPreservationService(db, { …, resolve?: (url, hints, signal) => Promise<SocialManifest>, sessions?: SessionStore })`; `preserveRemoteVideo(url, root, signal, download, options?: { cookieFile?: string; audioUrls?: string[] })`; `RemoteMediaOptions` gains `cookieFile?: string; audioUrls?: string[]` (typed here, implemented in Task 5 — until then `downloadCustomerRemoteMedia` ignores them).

- [ ] **Step 1: Write the failing tests** (append to `test/customer-preservation.test.ts`)

```ts
test('any recognised social post is preserved with platform-aware notes and a transcript asset', async () => {
  const reddit = 'https://www.reddit.com/r/space/comments/1abc2d/';
  db.query("INSERT INTO customer_captures(id,account_id,client_id,type,status,source_url,selection_text,storage_bytes,captured_at,created_at,updated_at) VALUES('r',?,'r','page','done',?,'',100,1,1,1)").run(owner, reddit);
  enqueuePreservation(db, owner, 'r', 'https://old.reddit.com/r/space/comments/1abc2d/some_title/?utm_source=share');
  expect((db.query("SELECT source_url FROM customer_preservation_jobs WHERE capture_id='r'").get() as any).source_url).toBe(reddit);
  const seen: any[] = [];
  const s = createPreservationService(db, {
    root,
    resolve: async () => ({ text: 'Title\n\nBody', author: 'u/mina', publishedAt: '2026-09-01T00:00:00.000Z', metadataAvailable: false, restricted: true, media: [{ kind: 'video' as const, url: 'https://v.redd.it/abc/DASH_720.mp4', audioUrls: ['https://v.redd.it/abc/DASH_AUDIO_128.mp4'] }], links: [] }),
    read: async (url) => ({ url, mime: 'image/png', data: png, status: 200 }),
    remote: async (url, options) => { seen.push({ url, cookieFile: options.cookieFile, audioUrls: options.audioUrls }); return { status: 'unavailable' as const, reason: 'x' }; },
    sessions: { session: () => ({ site: 'reddit', cookieFile: '/tmp/reddit.txt', cookieHeader: () => null, cookie: () => null, report() {} }), describe: () => '' },
  });
  await s.tick();
  const result = preservationDetails(db, owner, 'r')!;
  expect(result.status).toBe('partial');
  expect(result.error).toContain('Reddit did not expose the full public post.');
  expect(result.error).toContain('Reddit restricted server access');
  expect(result.error).not.toContain('X did not');
  expect(seen).toEqual([{ url: 'https://v.redd.it/abc/DASH_720.mp4', cookieFile: '/tmp/reddit.txt', audioUrls: ['https://v.redd.it/abc/DASH_AUDIO_128.mp4'] }]);
});
test('video subtitles and description become a transcript asset', async () => {
  const s = service({
    resolve: async () => ({ ...manifest, media: [{ kind: 'video' as const, url: 'https://video.twimg.com/a.mp4' }] }),
    remote: async () => ({ status: 'downloaded' as const, absolutePath: '', sourceUrl: 'https://video.twimg.com/a.mp4', mime: 'video/mp4' as const, bytes: 0, sha256: '', durationSeconds: 1, title: 'Clip', description: 'About the clip', author: 'Mina', subtitles: [{ language: 'en', automatic: true, text: 'WEBVTT\n\nhello' }], dispose: async () => {} }),
  });
  enqueuePreservation(db, owner, capture, url);
  await s.tick();
  const kinds = preservationDetails(db, owner, capture)!.assets.map(a => a.kind);
  expect(kinds).toContain('transcript');
});
```

The second test needs `preserveRemoteVideo` to succeed with an empty `absolutePath`; instead stub `preserveRemoteVideo`'s file write by passing a real temporary MP4-ish file: write `const clip = join(root, 'clip.bin'); await writeFile(clip, Buffer.from('ftyp-fake'));` and set `absolutePath: clip`, `bytes: 9`, `sha256: createHash('sha256').update('ftyp-fake').digest('base64url')`. `writeCustomerFile` accepts any bytes with the declared mime; check its behaviour in `src/customer-files.ts` and adjust the stub so `file.bytes === remote.bytes` and `file.sha256 === remote.sha256`.

In `test/customer-preservation-routes.test.ts` add:

```ts
test('preservation can be requested for any supported social post and rejects other pages', async () => {
  // Insert a capture with source 'https://www.instagram.com/p/C0dE_f-1/' → POST /captures/:id/preservation → 202
  // Insert a capture with source 'https://example.com/article' → POST → 400 unsupported_source with message 'Use a public social post link.'
});
```

Write it in the same style as the existing tests in that file (same app factory and auth helper).

- [ ] **Step 2: Run to verify failure**

Run: `bun test test/customer-preservation.test.ts test/customer-preservation-routes.test.ts`
Expected: the new tests FAIL (job not created for Reddit / wrong message).

- [ ] **Step 3: Implement**

`src/customer-preservation.ts`:

```ts
import { socialPost, platformLabel, resolveSocialPost, type SocialManifest } from './customer-social.ts';
import { socialSessions, type SessionStore } from './customer-social-sessions.ts';
// enqueuePreservation: const post = socialPost(source); if (!post) return; … VALUES(…, post.url, …)
// createPreservationService options: resolve?: (url: string, hints: SocialContext, signal: AbortSignal) => Promise<SocialManifest>; sessions?: SessionStore
// current(job): return row && socialPost(row.source_url)?.url === job.source_url ? row : null;
// tick():
const post = socialPost(job.source_url), label = platformLabel(post?.platform ?? 'x'), sessions = options.sessions ?? socialSessions;
const manifest = await (options.resolve || resolveSocialPost)(job.source_url, context, signal);
// visible-article title: `Article captured from ${label}`
// video branch:
const session = sessions.session(post?.site ?? 'x');
const result = await preserveRemoteVideo(item.url, root, signal, download, { cookieFile: session?.cookieFile ?? undefined, audioUrls: item.audioUrls });
if (!result.file) { issues.push('A video copy was unavailable.'); continue; }
commit(job, { key, source: item.url, kind: 'video', position: 10 + index, title: result.fileName || 'Saved video.mp4', mime: result.file.mime, file: result.file });
if (result.text) commit(job, { key: 'transcript:' + item.url, source: item.url, kind: 'transcript', position: 20 + index, title: 'Video subtitles and description', mime: 'text/plain', text: result.text });
// after links:
if (!manifest.metadataAvailable) issues.push(`${label} did not expose the full public post. The captured text and available files are kept.`);
if (manifest.restricted) issues.push(`${label} restricted server access; the captured text and available files are kept.`);
```

`src/customer-remote-preservation.ts`: `export async function preserveRemoteVideo(url, root, signal, download = downloadCustomerRemoteMedia, options: { cookieFile?: string; audioUrls?: string[] } = {})` and call `download(url, { signal, deadlineMs: 120_000, ...options })`. In `src/customer-remote-media.ts` add `cookieFile?: string; audioUrls?: string[]` to `RemoteMediaOptions` (no behaviour yet).

`src/customer-preservation-routes.ts`: replace both `twitterPost` uses with `socialPost` and the message with `"Use a public social post link."`.
`src/customer.ts:957`: `const socialContextJson = socialPost(sourceUrl) ? JSON.stringify(socialContext) : null;` (import from `./customer-social.ts`; keep the `twitterPost` import only if still used elsewhere in the file).
`src/index.ts`: after `const db = openDb();` add `console.log(socialSessions.describe());` (import from `./customer-social-sessions.ts`).

- [ ] **Step 4: Run the full suite**

Run: `bun test`
Expected: all pass (392 + new).

- [ ] **Step 5: Commit**

```bash
git add src/customer-preservation.ts src/customer-preservation-routes.ts src/customer.ts src/index.ts src/customer-remote-preservation.ts src/customer-remote-media.ts test/customer-preservation.test.ts test/customer-preservation-routes.test.ts
git commit -m "feat(preservation): preserve any recognised social post with platform-aware notes"
```

---

### Task 5: Video path — cookie file, direct audio track, ffmpeg mux

**Files:**
- Modify: `src/customer-remote-media.ts`
- Modify: `scripts/customer-remote-media.py`
- Test: `test/customer-remote-media.test.ts`, `scripts/test_customer_remote_media.py`

**Interfaces:**
- Consumes: `RemoteMediaOptions.cookieFile`, `.audioUrls` (Task 4 typing).
- Produces: helper stdin JSON `{ url, maxBytes, maxDurationSeconds, cookieFile?: string, audioUrls?: string[] }`; helper stdout gains `"audio": true` when `audio.m4a` was written; TS muxes to `muxed.mp4` and validates it with the existing ftyp + ffprobe checks.

- [ ] **Step 1: Write the failing Python tests** (append to `scripts/test_customer_remote_media.py`)

```python
    def test_cookiefile_is_only_used_when_a_private_regular_file_is_supplied(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'youtube.txt'
            path.write_text('# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t2000000000\tSID\tabc\n')
            os.chmod(path, 0o600)
            options = media.extractor_options(1024, 60, cookie_file=str(path))
            self.assertEqual(options['cookiefile'], str(path))
            self.assertIsNone(options['cookiesfrombrowser'])
            os.chmod(path, 0o644)
            with self.assertRaises(media.BoundaryError):
                media.validate_cookie_file(str(path))
            with self.assertRaises(media.BoundaryError):
                media.validate_cookie_file('relative.txt')

    def test_direct_download_fetches_first_working_audio_track_on_the_same_host(self):
        calls = []
        class Response:
            def __init__(self, body, status=200):
                self.body, self.status, self.headers = io.BytesIO(body), status, {'Content-Length': str(len(body))}
            def read(self, n=-1): return self.body.read(n)
            def __enter__(self): return self
            def __exit__(self, *a): pass
        def fake_open(request, timeout):
            calls.append(request.full_url)
            if request.full_url.endswith('DASH_AUDIO_128.mp4'):
                raise media.urllib.error.HTTPError(request.full_url, 403, 'denied', {}, None)
            return Response(b'\x00\x00\x00\x18ftypisom' + b'a' * 100)
        with tempfile.TemporaryDirectory() as tmp, patch.object(media, 'open_direct', side_effect=fake_open):
            os.chdir(tmp)
            result = media.direct_download('https://v.redd.it/abc/DASH_720.mp4', 10_000, ['https://v.redd.it/abc/DASH_AUDIO_128.mp4', 'https://v.redd.it/abc/DASH_audio.mp4', 'https://evil.test/DASH_audio.mp4'])
            self.assertEqual(result, {'status': 'downloaded', 'subtitles': [], 'audio': True})
            self.assertTrue((Path(tmp) / 'audio.m4a').exists())
            self.assertEqual(calls, ['https://v.redd.it/abc/DASH_720.mp4', 'https://v.redd.it/abc/DASH_AUDIO_128.mp4', 'https://v.redd.it/abc/DASH_audio.mp4'])
```

- [ ] **Step 2: Run to verify failure**

Run: `/home/pritam/.local/share/foundkeep-media-runtime/yt-dlp-2026.8.19/bin/python3 -m unittest scripts/test_customer_remote_media.py -k cookiefile -k audio`
Expected: FAIL — `extractor_options() got an unexpected keyword argument`, `direct_download` missing.

- [ ] **Step 3: Implement the helper changes**

```python
MAX_AUDIO_BYTES = 16 * 1024 * 1024

def validate_cookie_file(path):
    if not isinstance(path, str) or not os.path.isabs(path) or len(path) > 4096:
        raise BoundaryError('Invalid cookie file')
    try:
        stat = os.lstat(path)
    except OSError as error:
        raise BoundaryError('Missing cookie file') from error
    import stat as statmod
    if not statmod.S_ISREG(stat.st_mode) or statmod.S_ISLNK(stat.st_mode) or (stat.st_mode & 0o077) or stat.st_size > 256 * 1024:
        raise BoundaryError('Cookie file must be a private regular file')
    return path

def extractor_options(maximum, duration, cookie_file=None):
    return {
        ... existing keys ...,
        'cookiefile': validate_cookie_file(cookie_file) if cookie_file else None, 'cookiesfrombrowser': None,
        ...
    }

def open_direct(request, timeout):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), PublicRedirectHandler(), ResponseBudgetHandler(Budget()))
    return opener.open(request, timeout=timeout)

def direct_download(source, maximum, audio_urls):
    request = urllib.request.Request(source, headers={'Accept': 'video/mp4', 'Accept-Encoding': 'identity', 'User-Agent': 'Foundkeep-Public-Media/1.0'})
    with open_direct(request, 10) as response:
        write_response(response, Path('video.mp4'), maximum)
    audio = False
    video_host = urllib.parse.urlsplit(source).hostname
    for candidate in (audio_urls or [])[:3]:
        try:
            url = public_url(candidate)
            parts = urllib.parse.urlsplit(url)
            if parts.hostname != video_host or not parts.path.lower().endswith(('.mp4', '.m4a')):
                continue
            request = urllib.request.Request(url, headers={'Accept': 'audio/mp4,video/mp4', 'Accept-Encoding': 'identity', 'User-Agent': 'Foundkeep-Public-Media/1.0'})
            with open_direct(request, 10) as response:
                write_response(response, Path('audio.m4a'), min(maximum, MAX_AUDIO_BYTES))
            audio = True
            break
        except (BoundaryError, urllib.error.URLError, OSError):
            Path('audio.m4a').unlink(missing_ok=True)
            continue
    return {'status': 'downloaded', 'subtitles': [], 'audio': audio}
```

In `main()`: read `cookie_file = options.get('cookieFile')` (validate only when present, via `validate_cookie_file`), `audio_urls = options.get('audioUrls')` (must be a list of ≤ 3 strings or absent, else `BoundaryError`). Direct `.mp4` branch calls `direct_download(source, maximum, audio_urls)`; extractor branch calls `extract(source, maximum, duration, cookie_file)` which passes `cookie_file` into `extractor_options`. Keep the existing `write_response` and budget behaviour. Note `urllib.error` must be imported.

- [ ] **Step 4: Run the Python tests**

Run: `/home/pritam/.local/share/foundkeep-media-runtime/yt-dlp-2026.8.19/bin/python3 -m unittest scripts/test_customer_remote_media.py`
Expected: 17 pass.

- [ ] **Step 5: Write the failing TS test** (append to `test/customer-remote-media.test.ts`; follow the file's existing fake-runner pattern that returns helper stdout and pre-writes `video.mp4` into the temp `cwd`)

```ts
test('cookie file is validated before it reaches the helper, and audio tracks are muxed then probed', async () => {
  const sessions = mkdtempSync('/tmp/foundkeep-sessions-');
  const cookieFile = join(sessions, 'reddit.txt'); writeFileSync(cookieFile, '# Netscape HTTP Cookie File\n'); chmodSync(cookieFile, 0o600);
  const commands: string[][] = [];
  const runner: RemoteMediaRunner = async (spec) => {
    commands.push([spec.executable, ...spec.args]);
    if (spec.executable.endsWith('python') || spec.args.includes(HELPER_PATH)) {
      const input = JSON.parse(spec.stdin);
      expect(input.cookieFile).toBe(cookieFile);
      expect(input.audioUrls).toEqual(['https://v.redd.it/abc/DASH_AUDIO_128.mp4']);
      writeFileSync(join(spec.cwd, 'video.mp4'), sampleMp4); writeFileSync(join(spec.cwd, 'audio.m4a'), sampleM4a);
      return JSON.stringify({ status: 'downloaded', subtitles: [], audio: true });
    }
    if (spec.args.includes('/usr/bin/ffmpeg')) { writeFileSync(join(spec.cwd, 'muxed.mp4'), sampleMp4); return ''; }
    return JSON.stringify({ format: { duration: '3.0' }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 640, height: 360 }, { codec_type: 'audio', codec_name: 'aac' }] });
  };
  const result = await downloadCustomerRemoteMedia('https://v.redd.it/abc/DASH_720.mp4', { cookieFile, audioUrls: ['https://v.redd.it/abc/DASH_AUDIO_128.mp4'] }, { runExtractor: runner, sessionsDirectory: sessions });
  expect(result.status).toBe('downloaded');
  const ffmpeg = commands.find(c => c.includes('/usr/bin/ffmpeg'))!;
  expect(ffmpeg.slice(0, 2)).toEqual(['/usr/bin/prlimit', `--fsize=${50 * 1024 * 1024}`]);
  expect(ffmpeg).toContain('-c'); expect(ffmpeg).toContain('copy'); expect(ffmpeg.at(-1)).toBe('muxed.mp4');
  const probe = commands.find(c => c.includes('/usr/bin/ffprobe'))!;
  expect(probe.at(-1)!.endsWith('muxed.mp4')).toBe(true);
  chmodSync(cookieFile, 0o644);
  const insecure = await downloadCustomerRemoteMedia('https://v.redd.it/abc/DASH_720.mp4', { cookieFile }, { runExtractor: async (spec) => { expect(JSON.parse(spec.stdin).cookieFile).toBeUndefined(); return JSON.stringify({ status: 'unavailable' }); }, sessionsDirectory: sessions });
  expect(insecure.status).toBe('unavailable');
  const outside = await downloadCustomerRemoteMedia('https://v.redd.it/abc/DASH_720.mp4', { cookieFile: '/etc/passwd' }, { runExtractor: async (spec) => { expect(JSON.parse(spec.stdin).cookieFile).toBeUndefined(); return JSON.stringify({ status: 'unavailable' }); }, sessionsDirectory: sessions });
  expect(outside.status).toBe('unavailable');
});
```

Use the file's existing sample MP4 bytes constant (or a small valid `ftyp` header buffer as the other tests do) for `sampleMp4`/`sampleM4a`, and reuse its `HELPER_PATH` if defined; otherwise compute it the same way `customer-remote-media.ts` does.

- [ ] **Step 6: Implement the TS side**

```ts
export type RemoteMediaOptions = { signal?: AbortSignal; maxBytes?: number; maxDurationSeconds?: number; deadlineMs?: number; cookieFile?: string; audioUrls?: string[] };
export async function downloadCustomerRemoteMedia(rawUrl, options = {}, dependencies: { runExtractor?: RemoteMediaRunner; sessionsDirectory?: string } = {}) {
  // …
  const sessionsDirectory = dependencies.sessionsDirectory ?? process.env.FOUNDKEEP_SOCIAL_SESSIONS_DIR ?? join(homedir(), '.config', 'foundkeep', 'social-sessions');
  const runtimeDirectory = join(config.dataDir, 'social-sessions');
  const cookieFile = await safeCookieFile(options.cookieFile, [sessionsDirectory, runtimeDirectory]);
  const audioUrls = (options.audioUrls ?? []).slice(0, 3).map(previewSourceUrl).filter((u): u is URL => !!u && u.hostname === source.hostname && /\.(mp4|m4a)$/i.test(u.pathname)).map(u => u.href);
  // stdin: JSON.stringify({ url: source.href, maxBytes, maxDurationSeconds: maxDuration, ...(cookieFile ? { cookieFile } : {}), ...(audioUrls.length ? { audioUrls } : {}) })
  // after parsing metadata and before the ftyp check:
  let absolutePath = join(directory, 'video.mp4');
  if (metadata.audio === true) {
    const audio = join(directory, 'audio.m4a');
    const audioStat = await lstat(audio);
    if (!audioStat.isFile() || audioStat.isSymbolicLink() || !audioStat.size) return failure('error');
    await runRemoteMediaProcess({ executable: '/usr/bin/prlimit', args: [`--fsize=${maxBytes}`, '--as=536870912', '--cpu=30', '--nofile=32', '--', '/usr/bin/ffmpeg', '-v', 'error', '-nostdin', '-threads', '1', '-protocol_whitelist', 'file', '-i', 'video.mp4', '-i', 'audio.m4a', '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', 'muxed.mp4'], cwd: directory, stdin: '' }, controller.signal);
    absolutePath = join(directory, 'muxed.mp4');
  }
  // existing lstat/ftyp/ffprobe checks now run on `absolutePath`
}
async function safeCookieFile(path: string | undefined, roots: string[]): Promise<string | undefined> {
  if (!path || !isAbsolute(path) || !roots.some(root => path.startsWith(root + '/'))) return undefined;
  try { const stat = await lstat(path); return stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0 && stat.size <= 256 * 1024 ? path : undefined; } catch { return undefined; }
}
```

- [ ] **Step 7: Run tests**

Run: `bun test test/customer-remote-media.test.ts test/customer-remote-processing.test.ts test/customer-preservation.test.ts`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add src/customer-remote-media.ts scripts/customer-remote-media.py scripts/test_customer_remote_media.py test/customer-remote-media.test.ts
git commit -m "feat(media): optional session cookie file, direct audio track and ffmpeg mux"
```

---

### Task 6: Reddit resolver

**Files:**
- Create: `src/customer-reddit.ts`
- Create: `test/fixtures/social/reddit-gallery.json`, `test/fixtures/social/reddit-video.json`
- Test: `test/customer-reddit.test.ts`

**Interfaces:**
- Consumes: `SocialResolver`, `SocialPost`, `mediaHost`, `isoDate`, `isRestrictedStatus`, `EMPTY_MANIFEST` (Task 3); `PublicResourceError` (Task 2); `PlatformSession` (Task 1).
- Produces: `export const resolveReddit: SocialResolver`; `export function parseRedditListing(json: unknown, id: string): SocialManifest` (pure).

- [ ] **Step 1: Fixtures** — write two minimal listings in the real shape (`[ { kind:'Listing', data:{ children:[ { kind:'t3', data:{…} } ] } }, {…comments…} ]`):

`reddit-gallery.json` post data: `id:"1abc2d"`, `subreddit:"space"`, `author:"mina"`, `title:"Three views of the eclipse"`, `selftext:"Taken from the roof.\n\nMore in comments."`, `created_utc:1756684800`, `is_gallery:true`, `gallery_data:{items:[{media_id:"m1"},{media_id:"m2"}]}`, `media_metadata:{m1:{status:"valid",e:"Image",m:"image/jpg",s:{u:"https://preview.redd.it/m1.jpg?width=1000&format=pjpg&auto=webp&s=sig"}},m2:{status:"valid",e:"Image",m:"image/png",s:{u:"https://preview.redd.it/m2.png?s=sig"}}}`, `url:"https://www.reddit.com/gallery/1abc2d"`, `over_18:false`.

`reddit-video.json` post data: `id:"1vid3o"`, `subreddit:"aviation"`, `author:"kai"`, `title:"Crosswind landing"`, `selftext:""`, `created_utc:1756771200`, `is_video:true`, `secure_media:{reddit_video:{fallback_url:"https://v.redd.it/xyz789/DASH_720.mp4?source=fallback",has_audio:true,dash_url:"https://v.redd.it/xyz789/DASHPlaylist.mpd",duration:23}}`, `url:"https://v.redd.it/xyz789"`, `preview:{images:[{source:{url:"https://external-preview.redd.it/thumb.jpg?s=sig"}}]}`, plus `crosspost_parent_list:[]`.

- [ ] **Step 2: Write the failing tests**

```ts
// test/customer-reddit.test.ts
import { expect, test } from 'bun:test';
import { parseRedditListing, resolveReddit } from '../src/customer-reddit.ts';
import { PublicResourceError } from '../src/customer-public-resource.ts';
const load = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).json();
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
const deps = (read: any, session: any = () => null) => ({ read, session, source: async () => { throw Error('unused'); } });
test('galleries become ordered images with title and body text', async () => {
  const m = parseRedditListing(await load('reddit-gallery.json'), '1abc2d');
  expect(m).toMatchObject({ text: 'Three views of the eclipse\n\nTaken from the roof.\n\nMore in comments.', author: 'u/mina · r/space', publishedAt: '2025-09-01T00:00:00.000Z', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'image', url: 'https://preview.redd.it/m1.jpg?width=1000&format=pjpg&auto=webp&s=sig' }, { kind: 'image', url: 'https://preview.redd.it/m2.png?s=sig' }]);
});
test('reddit-hosted video carries audio track candidates on the same host', async () => {
  const m = parseRedditListing(await load('reddit-video.json'), '1vid3o');
  expect(m.media[0]).toEqual({ kind: 'video', url: 'https://v.redd.it/xyz789/DASH_720.mp4', audioUrls: ['https://v.redd.it/xyz789/DASH_AUDIO_128.mp4', 'https://v.redd.it/xyz789/DASH_AUDIO_64.mp4', 'https://v.redd.it/xyz789/DASH_audio.mp4'] });
  expect(m.media[1]).toEqual({ kind: 'image', url: 'https://external-preview.redd.it/thumb.jpg?s=sig' });
});
test('link posts expose the outbound article and never off-platform media', () => {
  const m = parseRedditListing([{ data: { children: [{ data: { id: 'l1', subreddit: 'news', author: 'a', title: 'Story', selftext: '', created_utc: 1, post_hint: 'link', url: 'https://example.org/story', preview: { images: [{ source: { url: 'https://evil.test/x.jpg' } }] } } }] } }], 'l1');
  expect(m.links).toEqual(['https://example.org/story']); expect(m.media).toEqual([]); expect(m.incomplete).toBe(true);
});
test('wrong id, removed or empty listings are unavailable', () => {
  expect(() => parseRedditListing([{ data: { children: [{ data: { id: 'other' } }] } }], 'l1')).toThrow();
  expect(() => parseRedditListing({}, 'l1')).toThrow();
});
test('resolver fetches .json with raw_json, resolves share links, and retries with the session on IP blocks', async () => {
  const calls: any[] = [];
  const listing = await load('reddit-gallery.json');
  let denied = true;
  const read = async (url: string, options: any) => {
    calls.push({ url, cookie: options.cookies?.('www.reddit.com') ?? null, accept: options.accept });
    if (url.endsWith('/s/AbC')) return { url: 'https://www.reddit.com/r/space/comments/1abc2d/three_views/?share_id=AbC', mime: 'text/html', data: Buffer.from('<html></html>'), status: 200 };
    if (denied && !options.cookies?.('www.reddit.com')) throw new PublicResourceError(403, url);
    return { url, mime: 'application/json', data: Buffer.from(JSON.stringify(listing)), status: 200 };
  };
  const reports: string[] = [];
  const session = () => ({ site: 'reddit', cookieFile: null, cookieHeader: () => 'reddit_session=r1', cookie: () => null, report: (o: string) => reports.push(o) });
  const m = await resolveReddit({ platform: 'reddit', site: 'reddit', id: 's:AbC', url: 'https://www.reddit.com/r/space/s/AbC' }, hints, new AbortController().signal, deps(read, session));
  expect(m.metadataAvailable).toBe(true);
  expect(calls[0]).toMatchObject({ url: 'https://www.reddit.com/r/space/s/AbC', cookie: null });
  expect(calls[1]).toMatchObject({ url: 'https://www.reddit.com/r/space/comments/1abc2d/.json?raw_json=1', cookie: null, accept: 'application/json' });
  expect(calls[2]).toMatchObject({ url: 'https://www.reddit.com/r/space/comments/1abc2d/.json?raw_json=1', cookie: 'reddit_session=r1' });
  expect(reports).toEqual(['ok']);
  denied = true;
  const noSession = await resolveReddit({ platform: 'reddit', site: 'reddit', id: '1abc2d', url: 'https://www.reddit.com/r/space/comments/1abc2d/' }, hints, new AbortController().signal, deps(read));
  expect(noSession).toMatchObject({ metadataAvailable: false, restricted: true });
});
```

- [ ] **Step 3: Run to verify failure** — `bun test test/customer-reddit.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement**

```ts
// src/customer-reddit.ts
import { PublicResourceError, type PublicReader } from './customer-public-resource.ts';
import { EMPTY_MANIFEST, isoDate, isRestrictedStatus, mediaHost, type SocialManifest, type SocialMedia, type SocialResolver } from './customer-social.ts';
import { previewSourceUrl } from './customer-preview.ts';
const IMAGE_HOSTS = ['redd.it', 'i.imgur.com'], VIDEO_HOSTS = ['v.redd.it'];
const UA = { 'User-Agent': 'FoundKeep/1.0 (+https://foundkeep.app)' };
const outbound = (raw: unknown) => { const u = previewSourceUrl(raw); return u && !/(^|\.)(reddit\.com|redd\.it)$/.test(u.hostname) ? u.href : null; };
export function parseRedditListing(json: unknown, id: string): SocialManifest {
  const post = (json as any)?.[0]?.data?.children?.find((c: any) => c?.data?.id === id)?.data;
  if (!post) throw Error('The public post is unavailable.');
  const source = Array.isArray(post.crosspost_parent_list) && post.crosspost_parent_list[0] ? post.crosspost_parent_list[0] : post;
  const media: SocialMedia[] = []; let incomplete = false;
  const image = (raw: unknown) => { const url = mediaHost(raw, IMAGE_HOSTS); if (url) media.push({ kind: 'image', url }); else incomplete = true; };
  if (source.is_gallery && source.gallery_data?.items && source.media_metadata) {
    for (const item of source.gallery_data.items.slice(0, 8)) { const meta = source.media_metadata[item?.media_id]; if (meta?.status === 'valid' && (meta.s?.u || meta.s?.gif)) image(meta.s.u || meta.s.gif); else incomplete = true; }
  }
  const video = source.secure_media?.reddit_video ?? source.media?.reddit_video;
  if (video?.fallback_url) {
    const fallback = mediaHost(String(video.fallback_url).split('?')[0], VIDEO_HOSTS);
    if (fallback) { const base = fallback.replace(/\/[^/]+$/, ''); media.push({ kind: 'video', url: fallback, ...(video.has_audio === false ? {} : { audioUrls: [`${base}/DASH_AUDIO_128.mp4`, `${base}/DASH_AUDIO_64.mp4`, `${base}/DASH_audio.mp4`] }) }); } else incomplete = true;
    const thumb = source.preview?.images?.[0]?.source?.url; if (thumb) image(thumb);
  } else if (!media.length) {
    const direct = mediaHost(source.url_overridden_by_dest ?? source.url, IMAGE_HOSTS);
    if (direct && /\.(jpe?g|png|webp|gif)$/i.test(new URL(direct).pathname)) media.push({ kind: 'image', url: direct });
    else if (source.post_hint === 'image') { const thumb = source.preview?.images?.[0]?.source?.url; if (thumb) image(thumb); }
  }
  const links: string[] = [];
  if (!source.is_self && !media.length) { const link = outbound(source.url_overridden_by_dest ?? source.url); if (link) links.push(link); else incomplete = true; }
  const title = typeof post.title === 'string' ? post.title.trim() : '', body = typeof source.selftext === 'string' ? source.selftext.trim() : '';
  return { text: [title, body].filter(Boolean).join('\n\n').slice(0, 50_000), author: [post.author ? `u/${String(post.author).slice(0, 50)}` : '', post.subreddit ? `r/${String(post.subreddit).slice(0, 50)}` : ''].filter(Boolean).join(' · '),
    publishedAt: isoDate(post.created_utc), media: media.slice(0, 8), links: links.slice(0, 3), metadataAvailable: true, incomplete: incomplete || !media.length && !links.length && !body };
}
async function fetchListing(url: string, read: PublicReader, signal: AbortSignal, cookies?: (host: string) => string | null) {
  const resource = await read(url, { maxBytes: 2 * 1024 * 1024, signal, accept: 'application/json', headers: UA, cookies });
  return JSON.parse(resource.data.toString('utf8'));
}
export const resolveReddit: SocialResolver = async (post, hints, signal, deps) => {
  let canonical = post.url, id = post.id;
  if (id.startsWith('s:')) {
    const landing = await deps.read(post.url, { maxBytes: 512 * 1024, signal, accept: 'text/html', headers: UA }).catch(() => null);
    const match = landing?.url.match(/\/r\/(\w+)\/comments\/([a-z0-9]{2,10})/i);
    if (!match) return { ...EMPTY_MANIFEST(), links: hints.links };
    canonical = `https://www.reddit.com/r/${match[1]}/comments/${match[2]}/`; id = match[2]!;
  }
  const endpoint = `${canonical}.json?raw_json=1`;
  const attempt = async (session: ReturnType<typeof deps.session>) => {
    try { const manifest = parseRedditListing(await fetchListing(endpoint, deps.read, signal, session ? h => session.cookieHeader(h) : undefined), id); session?.report('ok'); return manifest; }
    catch (error) {
      signal.throwIfAborted();
      const status = error instanceof PublicResourceError ? error.status : 0;
      if (session) session.report(status === 429 ? 'ratelimited' : isRestrictedStatus(status) ? 'denied' : 'ok');
      return isRestrictedStatus(status) ? 'restricted' as const : null;
    }
  };
  let result = await attempt(null);
  if (result === 'restricted') { const session = deps.session('reddit'); const retry = session ? await attempt(session) : 'restricted'; result = retry; }
  if (result === 'restricted') return { ...EMPTY_MANIFEST(), restricted: true, links: hints.links };
  if (!result) return { ...EMPTY_MANIFEST(), links: hints.links };
  result.links = [...new Set([...result.links, ...hints.links])].slice(0, 3);
  return result;
};
```

- [ ] **Step 5: Run tests** — `bun test test/customer-reddit.test.ts` → pass.

- [ ] **Step 6: Commit**

```bash
git add src/customer-reddit.ts test/customer-reddit.test.ts test/fixtures/social/reddit-gallery.json test/fixtures/social/reddit-video.json
git commit -m "feat(social): Reddit resolver with galleries, video audio tracks and session retry"
```

---

### Task 7: Instagram resolver

**Files:**
- Create: `src/customer-instagram.ts`
- Create: `test/fixtures/social/instagram-embed.html`, `test/fixtures/social/instagram-media-info.json`
- Test: `test/customer-instagram.test.ts`

**Interfaces:**
- Consumes: as Task 6.
- Produces: `export const resolveInstagram: SocialResolver`; pure `shortcodeToMediaId(code: string): string`, `parseInstagramEmbed(html: string, code: string): SocialManifest`, `parseInstagramMediaInfo(json: unknown, code: string): SocialManifest`.

- [ ] **Step 1: Fixtures**

`instagram-embed.html`: an embed page containing (a) `<script>…("init",[],[{"contextJSON":"{\"gql_data\":{\"shortcode_media\":{\"shortcode\":\"C0dE_f-1\",\"__typename\":\"GraphSidecar\",\"display_url\":\"https://scontent.cdninstagram.com/v/t51/1.jpg\",\"is_video\":false,\"taken_at_timestamp\":1756684800,\"owner\":{\"username\":\"mina\",\"full_name\":\"Mina K\"},\"edge_media_to_caption\":{\"edges\":[{\"node\":{\"text\":\"Rooftop eclipse\"}}]},\"edge_sidecar_to_children\":{\"edges\":[{\"node\":{\"display_url\":\"https://scontent.cdninstagram.com/v/t51/1.jpg\",\"is_video\":false}},{\"node\":{\"display_url\":\"https://scontent.cdninstagram.com/v/t51/2.jpg\",\"is_video\":true,\"video_url\":\"https://scontent.cdninstagram.com/v/t66/2.mp4\"}}]}}}}"}]],</script>` and (b) the plain HTML fallback markup `<div class="Caption"><a class="CaptionUsername">mina</a> Rooftop eclipse</div><img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/t51/1.jpg">`.

`instagram-media-info.json`: `{ "items": [ { "pk": "3200000000000000000", "code": "C0dE_f-1", "taken_at": 1756684800, "media_type": 8, "user": { "username": "mina", "full_name": "Mina K" }, "caption": { "text": "Rooftop eclipse" }, "carousel_media": [ { "media_type": 1, "image_versions2": { "candidates": [ { "width": 1080, "url": "https://scontent.cdninstagram.com/v/t51/1.jpg" } ] } }, { "media_type": 2, "image_versions2": { "candidates": [ { "width": 1080, "url": "https://scontent.cdninstagram.com/v/t51/2.jpg" } ] }, "video_versions": [ { "width": 720, "url": "https://scontent.cdninstagram.com/v/t66/2.mp4" } ] } ] } ] }`.

- [ ] **Step 2: Write the failing tests**

```ts
// test/customer-instagram.test.ts
import { expect, test } from 'bun:test';
import { parseInstagramEmbed, parseInstagramMediaInfo, resolveInstagram, shortcodeToMediaId } from '../src/customer-instagram.ts';
import { PublicResourceError } from '../src/customer-public-resource.ts';
const text = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).text();
const json = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).json();
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
const post = { platform: 'instagram' as const, site: 'instagram', id: 'C0dE_f-1', url: 'https://www.instagram.com/p/C0dE_f-1/' };
test('shortcodes decode to media ids the way Instagram does', () => {
  expect(shortcodeToMediaId('B')).toBe('1'); expect(shortcodeToMediaId('C0dE_f-1')).toBe(shortcodeToMediaId('C0dE_f-1abcdefg'));
  expect(shortcodeToMediaId('CqZ_2lSLWJt')).toBe('3072011180130436189');
});
test('embed page yields caption, author, carousel images and video', async () => {
  const m = parseInstagramEmbed(await text('instagram-embed.html'), 'C0dE_f-1');
  expect(m).toMatchObject({ text: 'Rooftop eclipse', author: 'Mina K (@mina)', publishedAt: '2025-09-01T00:00:00.000Z', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/1.jpg' }, { kind: 'video', url: 'https://scontent.cdninstagram.com/v/t66/2.mp4' }, { kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/2.jpg' }]);
});
test('embed page without the JSON blob falls back to the caption markup', () => {
  const m = parseInstagramEmbed('<div class="Caption"><a class="CaptionUsername">mina</a> Plain caption</div><img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/t51/x.jpg">', 'C0dE_f-1');
  expect(m).toMatchObject({ text: 'Plain caption', author: '@mina', media: [{ kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/x.jpg' }], metadataAvailable: true, incomplete: true });
});
test('media info API yields the full carousel with videos first per slide', async () => {
  const m = parseInstagramMediaInfo(await json('instagram-media-info.json'), 'C0dE_f-1');
  expect(m.media).toEqual([{ kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/1.jpg' }, { kind: 'video', url: 'https://scontent.cdninstagram.com/v/t66/2.mp4' }, { kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/2.jpg' }]);
  expect(m.author).toBe('Mina K (@mina)');
  expect(() => parseInstagramMediaInfo({ items: [{ code: 'other' }] }, 'C0dE_f-1')).toThrow();
});
test('resolver uses the embed page anonymously, then the media API with the session, with the right headers', async () => {
  const embed = await text('instagram-embed.html'), info = await json('instagram-media-info.json');
  const calls: any[] = [];
  const read = async (url: string, options: any) => {
    calls.push({ url, headers: options.headers, cookie: options.cookies?.('www.instagram.com') ?? null });
    if (url.includes('/embed/captioned/')) return { url: 'https://www.instagram.com/accounts/login/?next=/p/C0dE_f-1/embed/captioned/', mime: 'text/html', data: Buffer.from('<html>Log in</html>'), status: 200 };
    return { url, mime: 'application/json', data: Buffer.from(JSON.stringify(info)), status: 200 };
  };
  const reports: string[] = [];
  const session = () => ({ site: 'instagram', cookieFile: '/tmp/instagram.txt', cookieHeader: (h: string) => (h.endsWith('instagram.com') ? 'sessionid=s1; csrftoken=c1' : null), cookie: (n: string) => (n === 'csrftoken' ? 'c1' : null), report: (o: string) => reports.push(o) });
  const m = await resolveInstagram(post, hints, new AbortController().signal, { read, session, source: async () => { throw Error('unused'); } });
  expect(m.media).toHaveLength(3); expect(m.metadataAvailable).toBe(true); expect(reports).toEqual(['ok']);
  expect(calls[0].url).toBe('https://www.instagram.com/p/C0dE_f-1/embed/captioned/');
  expect(calls[1].url).toBe(`https://www.instagram.com/api/v1/media/${shortcodeToMediaId('C0dE_f-1')}/info/`);
  expect(calls[1].headers).toMatchObject({ 'x-ig-app-id': '936619743392459', 'x-csrftoken': 'c1', 'x-requested-with': 'XMLHttpRequest', referer: 'https://www.instagram.com/p/C0dE_f-1/' });
  expect(calls[1].cookie).toBe('sessionid=s1; csrftoken=c1');
  const walled = await resolveInstagram(post, hints, new AbortController().signal, { read, session: () => null, source: async () => { throw Error('unused'); } });
  expect(walled).toMatchObject({ metadataAvailable: false, restricted: true });
  const denied = await resolveInstagram(post, hints, new AbortController().signal, { read: async (url: string, o: any) => { if (url.includes('/api/v1/')) throw new PublicResourceError(401, url); return read(url, o); }, session, source: async () => { throw Error('unused'); } });
  expect(denied.restricted).toBe(true); expect(reports.at(-1)).toBe('denied');
});
test('embed page that works anonymously does not touch the session', async () => {
  const embed = await text('instagram-embed.html'); let sessionCalls = 0;
  const m = await resolveInstagram(post, hints, new AbortController().signal, { read: async (url: string) => ({ url, mime: 'text/html', data: Buffer.from(embed), status: 200 }), session: () => { sessionCalls++; return null; }, source: async () => { throw Error('unused'); } });
  expect(m.media).toHaveLength(3); expect(sessionCalls).toBe(0);
});
```

- [ ] **Step 3: Run to verify failure** — `bun test test/customer-instagram.test.ts` → FAIL.

- [ ] **Step 4: Implement**

```ts
// src/customer-instagram.ts
import { parseHTML } from 'linkedom';
import { PublicResourceError } from './customer-public-resource.ts';
import { blockedRoute } from './customer-source.ts';
import { EMPTY_MANIFEST, isoDate, isRestrictedStatus, mediaHost, type SocialManifest, type SocialMedia, type SocialResolver } from './customer-social.ts';
const CDN = ['cdninstagram.com', 'fbcdn.net'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
export function shortcodeToMediaId(code: string): string {
  let id = 0n;
  for (const char of code.slice(0, 11)) { const index = ALPHABET.indexOf(char); if (index < 0) throw Error('Invalid shortcode.'); id = id * 64n + BigInt(index); }
  return id.toString();
}
const author = (name: unknown, handle: unknown) => { const n = typeof name === 'string' ? name.trim().slice(0, 200) : '', h = typeof handle === 'string' ? handle.trim().slice(0, 50) : ''; return n && h ? `${n} (@${h})` : h ? `@${h}` : n; };
function pushNode(media: SocialMedia[], node: any, flags: { incomplete: boolean }) {
  const video = node?.is_video ? mediaHost(node.video_url, CDN) : null, image = mediaHost(node?.display_url, CDN);
  if (node?.is_video) { if (video) media.push({ kind: 'video', url: video }); else flags.incomplete = true; }
  if (image) media.push({ kind: 'image', url: image }); else if (!node?.is_video) flags.incomplete = true;
}
export function parseInstagramEmbed(html: string, code: string): SocialManifest {
  const flags = { incomplete: false }; const media: SocialMedia[] = [];
  const blob = html.match(/"init",\[\],\[(.*?)\]\],/s)?.[1];
  if (blob) {
    try {
      const context = JSON.parse(JSON.parse(blob).contextJSON);
      const node = context?.gql_data?.shortcode_media ?? context?.gql_data?.xdt_shortcode_media;
      if (node && (!node.shortcode || node.shortcode === code)) {
        const children = node.edge_sidecar_to_children?.edges?.map((e: any) => e?.node).filter(Boolean) ?? [];
        for (const child of (children.length ? children : [node]).slice(0, 8)) pushNode(media, child, flags);
        return { text: String(node.edge_media_to_caption?.edges?.[0]?.node?.text ?? '').slice(0, 50_000), author: author(node.owner?.full_name, node.owner?.username), publishedAt: isoDate(node.taken_at_timestamp), media: media.slice(0, 8), links: [], metadataAvailable: true, incomplete: flags.incomplete };
      }
    } catch { /* fall through to markup */ }
  }
  const { document } = parseHTML(html);
  const caption = document.querySelector('.Caption'), user = caption?.querySelector('.CaptionUsername')?.textContent?.trim() || '';
  caption?.querySelector('.CaptionUsername')?.remove();
  const image = mediaHost(document.querySelector('img.EmbeddedMediaImage')?.getAttribute('src'), CDN);
  if (image) media.push({ kind: 'image', url: image });
  const text = (caption?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50_000);
  if (!text && !image) throw Error('The public post is unavailable.');
  return { text, author: author('', user), publishedAt: null, media, links: [], metadataAvailable: true, incomplete: true };
}
export function parseInstagramMediaInfo(json: unknown, code: string): SocialManifest {
  const item = (json as any)?.items?.[0];
  if (!item || item.code !== code) throw Error('The public post is unavailable.');
  const flags = { incomplete: false }; const media: SocialMedia[] = [];
  for (const slide of (Array.isArray(item.carousel_media) && item.carousel_media.length ? item.carousel_media : [item]).slice(0, 8)) {
    const video = mediaHost(slide?.video_versions?.[0]?.url, CDN), image = mediaHost(slide?.image_versions2?.candidates?.[0]?.url, CDN);
    if (slide?.video_versions?.length) { if (video) media.push({ kind: 'video', url: video }); else flags.incomplete = true; }
    if (image) media.push({ kind: 'image', url: image }); else if (!slide?.video_versions?.length) flags.incomplete = true;
  }
  return { text: String(item.caption?.text ?? '').slice(0, 50_000), author: author(item.user?.full_name, item.user?.username), publishedAt: isoDate(item.taken_at), media: media.slice(0, 8), links: [], metadataAvailable: true, incomplete: flags.incomplete };
}
export const resolveInstagram: SocialResolver = async (post, hints, signal, deps) => {
  let restricted = false;
  try {
    const page = await deps.read(`https://www.instagram.com/p/${post.id}/embed/captioned/`, { maxBytes: 2 * 1024 * 1024, signal, accept: 'text/html', headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (blockedRoute(page.url)) restricted = true; else return withHints(parseInstagramEmbed(page.data.toString('utf8'), post.id), hints);
  } catch (error) { signal.throwIfAborted(); restricted = error instanceof PublicResourceError && isRestrictedStatus(error.status); }
  const session = deps.session('instagram');
  if (!session) return { ...EMPTY_MANIFEST(), restricted, links: hints.links };
  try {
    const info = await deps.read(`https://www.instagram.com/api/v1/media/${shortcodeToMediaId(post.id)}/info/`, { maxBytes: 4 * 1024 * 1024, signal, accept: 'application/json',
      headers: { 'User-Agent': BROWSER_UA, 'x-ig-app-id': '936619743392459', 'x-asbd-id': '359341', 'x-ig-www-claim': '0', 'x-requested-with': 'XMLHttpRequest', ...(session.cookie('csrftoken') ? { 'x-csrftoken': session.cookie('csrftoken')! } : {}), referer: `https://www.instagram.com/p/${post.id}/`, origin: 'https://www.instagram.com', 'Accept-Language': 'en-US,en;q=0.9' },
      cookies: host => session.cookieHeader(host) });
    if (blockedRoute(info.url)) { session.report('login'); return { ...EMPTY_MANIFEST(), restricted: true, links: hints.links }; }
    const manifest = parseInstagramMediaInfo(JSON.parse(info.data.toString('utf8')), post.id); session.report('ok'); return withHints(manifest, hints);
  } catch (error) {
    signal.throwIfAborted();
    const status = error instanceof PublicResourceError ? error.status : 0;
    session.report(status === 429 ? 'ratelimited' : isRestrictedStatus(status) ? 'denied' : 'ok');
    return { ...EMPTY_MANIFEST(), restricted: restricted || isRestrictedStatus(status), links: hints.links };
  }
};
const withHints = (m: SocialManifest, hints: { images: string[]; links: string[] }) => { const seen = new Set(m.media.map(x => x.url)); for (const url of hints.images) { const ok = mediaHost(url, CDN); if (ok && !seen.has(ok) && m.media.length < 8) { m.media.push({ kind: 'image', url: ok }); seen.add(ok); } } m.links = [...new Set([...m.links, ...hints.links])].slice(0, 3); return m; };
```

- [ ] **Step 5: Run tests** — `bun test test/customer-instagram.test.ts` → pass.

- [ ] **Step 6: Commit**

```bash
git add src/customer-instagram.ts test/customer-instagram.test.ts test/fixtures/social/instagram-embed.html test/fixtures/social/instagram-media-info.json
git commit -m "feat(social): Instagram resolver via embed page and session media API"
```

---

### Task 8: LinkedIn resolver

**Files:**
- Create: `src/customer-linkedin.ts`
- Create: `test/fixtures/social/linkedin-guest.html`, `test/fixtures/social/linkedin-voyager.json`
- Test: `test/customer-linkedin.test.ts`

**Interfaces:**
- Consumes: as Task 6.
- Produces: `export const resolveLinkedIn: SocialResolver`; pure `parseLinkedInGuest(html: string, id: string): SocialManifest`, `parseLinkedInVoyager(json: unknown, id: string): SocialManifest`.

Voyager caveat: the endpoint and shape below are from the open-source Voyager clients and must be re-checked against one real response once a `linkedin` session exists on omni. The parser is written to tolerate both `included`-normalised and inline shapes.

- [ ] **Step 1: Fixtures**

`linkedin-guest.html`: `<html><head><meta property="og:title" content="Jane Doe on LinkedIn: Shipping the new agent runtime"><meta property="og:description" content="Shipping the new agent runtime today. Three lessons: …"><meta property="og:image" content="https://media.licdn.com/dms/image/v2/D4D22AQ/feedshare-shrink_800/0/1?e=1&v=beta&t=sig"><script type="application/ld+json">{"@type":"SocialMediaPosting","author":{"@type":"Person","name":"Jane Doe"},"datePublished":"2026-09-01T10:00:00.000Z"}</script></head><body><article><p class="attributed-text-segment-list__content" data-test-id="main-feed-activity-card__commentary">Shipping the new agent runtime today.<br>Three lessons: keep it small, measure, ship.</p><div class="feed-images-content"><img data-delayed-url="https://media.licdn.com/dms/image/v2/D4D22AQ/feedshare-shrink_2048_1536/0/1?e=1&v=beta&t=sig2" alt="slide"></div><video data-sources='[{"src":"https://dms.licdn.com/playlist/vid/v2/D4D05AQ/mp4-720p-30fp-crf28/0/1?e=1&v=beta&t=vsig","type":"video/mp4","data-bitrate":900},{"src":"https://dms.licdn.com/playlist/vid/v2/D4D05AQ/mp4-640p-30fp-crf28/0/1?e=1&v=beta&t=vsig","type":"video/mp4","data-bitrate":600}]' data-poster-url="https://media.licdn.com/dms/image/v2/poster.jpg"></video><time datetime="2026-09-01T10:00:00.000Z">1w</time></article></body></html>`.

`linkedin-voyager.json`: `{ "data": {}, "included": [ { "$type": "com.linkedin.voyager.feed.render.UpdateV2", "entityUrn": "urn:li:fs_updateV2:(urn:li:activity:7123456789012345678,MEMBER_SHARES,EMPTY,DEFAULT,false)", "actor": { "name": { "text": "Jane Doe" }, "urn": "urn:li:member:1" }, "commentary": { "text": { "text": "Shipping the new agent runtime today.\nThree lessons." } }, "content": { "images": [ { "attributes": [ { "vectorImage": { "rootUrl": "https://media.licdn.com/dms/image/v2/D4D22AQ/", "artifacts": [ { "width": 800, "fileIdentifyingUrlPathSegment": "feedshare-shrink_800/0/1?e=1&v=beta&t=a" }, { "width": 2048, "fileIdentifyingUrlPathSegment": "feedshare-shrink_2048_1536/0/1?e=1&v=beta&t=b" } ] } } ] } ] }, "updateMetadata": { "urn": "urn:li:activity:7123456789012345678" } }, { "$type": "com.linkedin.videocontent.VideoPlayMetadata", "progressiveStreams": [ { "width": 720, "streamingLocations": [ { "url": "https://dms.licdn.com/playlist/vid/v2/D4D05AQ/mp4-720p-30fp-crf28/0/1?e=1&v=beta&t=v" } ] } ] } ] }`.

- [ ] **Step 2: Write the failing tests**

```ts
// test/customer-linkedin.test.ts
import { expect, test } from 'bun:test';
import { parseLinkedInGuest, parseLinkedInVoyager, resolveLinkedIn } from '../src/customer-linkedin.ts';
const text = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).text();
const json = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).json();
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
const post = { platform: 'linkedin' as const, site: 'linkedin', id: '7123456789012345678', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/' };
test('guest page yields commentary, author, date, largest images and the best mp4', async () => {
  const m = parseLinkedInGuest(await text('linkedin-guest.html'), post.id);
  expect(m).toMatchObject({ text: 'Shipping the new agent runtime today.\nThree lessons: keep it small, measure, ship.', author: 'Jane Doe', publishedAt: '2026-09-01T10:00:00.000Z', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'video', url: 'https://dms.licdn.com/playlist/vid/v2/D4D05AQ/mp4-720p-30fp-crf28/0/1?e=1&v=beta&t=vsig' }, { kind: 'image', url: 'https://media.licdn.com/dms/image/v2/D4D22AQ/feedshare-shrink_2048_1536/0/1?e=1&v=beta&t=sig2' }]);
});
test('guest page with only og tags is metadata-only but usable', () => {
  const m = parseLinkedInGuest('<meta property="og:title" content="A B on LinkedIn: hi"><meta property="og:description" content="hi there">', post.id);
  expect(m).toMatchObject({ text: 'hi there', author: 'A B', metadataAvailable: true, incomplete: true });
});
test('voyager update yields commentary, actor, largest image artifacts and video streams', async () => {
  const m = parseLinkedInVoyager(await json('linkedin-voyager.json'), post.id);
  expect(m).toMatchObject({ text: 'Shipping the new agent runtime today.\nThree lessons.', author: 'Jane Doe', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'image', url: 'https://media.licdn.com/dms/image/v2/D4D22AQ/feedshare-shrink_2048_1536/0/1?e=1&v=beta&t=b' }, { kind: 'video', url: 'https://dms.licdn.com/playlist/vid/v2/D4D05AQ/mp4-720p-30fp-crf28/0/1?e=1&v=beta&t=v' }]);
  expect(() => parseLinkedInVoyager({ included: [] }, post.id)).toThrow();
});
test('resolver reads the guest page first, then Voyager with csrf and session cookies on an authwall', async () => {
  const guest = await text('linkedin-guest.html'), voyager = await json('linkedin-voyager.json');
  const calls: any[] = [];
  const read = async (url: string, options: any) => {
    calls.push({ url, headers: options.headers, cookie: options.cookies?.('www.linkedin.com') ?? null });
    if (url.startsWith('https://www.linkedin.com/feed/update/')) return { url: 'https://www.linkedin.com/authwall?trk=x', mime: 'text/html', data: Buffer.from('<html>Join</html>'), status: 200 };
    return { url, mime: 'application/json', data: Buffer.from(JSON.stringify(voyager)), status: 200 };
  };
  const reports: string[] = [];
  const session = () => ({ site: 'linkedin', cookieFile: null, cookieHeader: (h: string) => (h.endsWith('linkedin.com') ? 'li_at=t; JSESSIONID="ajax:42"' : null), cookie: (n: string) => (n === 'JSESSIONID' ? '"ajax:42"' : null), report: (o: string) => reports.push(o) });
  const m = await resolveLinkedIn(post, hints, new AbortController().signal, { read, session, source: async () => { throw Error('unused'); } });
  expect(m.metadataAvailable).toBe(true); expect(m.media).toHaveLength(2); expect(reports).toEqual(['ok']);
  expect(calls[0].url).toBe(post.url); expect(calls[0].headers['User-Agent']).toContain('Mozilla/5.0');
  expect(calls[1].url).toBe('https://www.linkedin.com/voyager/api/feed/updates/urn:li:activity:7123456789012345678');
  expect(calls[1].headers).toMatchObject({ 'csrf-token': 'ajax:42', 'x-restli-protocol-version': '2.0.0', accept: 'application/vnd.linkedin.normalized+json+2.1' });
  expect(calls[1].cookie).toBe('li_at=t; JSESSIONID="ajax:42"');
  const guestOk = await resolveLinkedIn(post, hints, new AbortController().signal, { read: async (url: string) => ({ url, mime: 'text/html', data: Buffer.from(guest), status: 200 }), session: () => { throw Error('must not be used'); }, source: async () => { throw Error('unused'); } });
  expect(guestOk.media).toHaveLength(2);
  const walled = await resolveLinkedIn(post, hints, new AbortController().signal, { read, session: () => null, source: async () => { throw Error('unused'); } });
  expect(walled).toMatchObject({ metadataAvailable: false, restricted: true });
});
```

- [ ] **Step 3: Run to verify failure** — `bun test test/customer-linkedin.test.ts` → FAIL.

- [ ] **Step 4: Implement**

```ts
// src/customer-linkedin.ts
import { parseHTML } from 'linkedom';
import { PublicResourceError } from './customer-public-resource.ts';
import { blockedRoute } from './customer-source.ts';
import { EMPTY_MANIFEST, isRestrictedStatus, mediaHost, type SocialManifest, type SocialMedia, type SocialResolver } from './customer-social.ts';
const CDN = ['licdn.com'];
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const clean = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim().slice(0, max) : '';
function ld(document: any): Record<string, any> { for (const script of document.querySelectorAll('script[type="application/ld+json"]')) { try { const value = JSON.parse(script.textContent || ''); const list = Array.isArray(value) ? value : value?.['@graph'] ?? [value]; const posting = list.find((x: any) => x?.['@type'] === 'SocialMediaPosting'); if (posting) return posting; } catch {} } return {}; }
export function parseLinkedInGuest(html: string, id: string): SocialManifest {
  const { document } = parseHTML(html);
  const meta = (name: string) => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute('content');
  const commentary = document.querySelector('p.attributed-text-segment-list__content, [data-test-id="main-feed-activity-card__commentary"]');
  commentary?.querySelectorAll('br').forEach((br: any) => br.replaceWith('\n'));
  const text = clean(commentary?.textContent, 50_000) || clean(meta('og:description'), 50_000);
  const data = ld(document);
  const ogTitle = clean(meta('og:title'), 300), author = clean(data.author?.name, 200) || (ogTitle.includes(' on LinkedIn: ') ? ogTitle.split(' on LinkedIn: ')[0]! : '');
  const publishedAt = clean(data.datePublished, 100) || document.querySelector('time[datetime]')?.getAttribute('datetime') || null;
  const media: SocialMedia[] = []; let incomplete = false;
  const video = document.querySelector('video[data-sources]');
  if (video) { try { const sources = JSON.parse(video.getAttribute('data-sources') || '[]').filter((s: any) => s?.type === 'video/mp4').sort((a: any, b: any) => (Number(b['data-bitrate']) || 0) - (Number(a['data-bitrate']) || 0)); const url = mediaHost(sources[0]?.src, CDN); if (url) media.push({ kind: 'video', url }); else incomplete = true; } catch { incomplete = true; } }
  const images = [...document.querySelectorAll('img[data-delayed-url]')].map((img: any) => mediaHost(img.getAttribute('data-delayed-url'), CDN)).filter((x): x is string => !!x && !/profile-displayphoto|company-logo/.test(x));
  const fallback = mediaHost(meta('og:image'), CDN);
  for (const url of (images.length ? images : fallback && !video ? [fallback] : []).slice(0, 8)) media.push({ kind: 'image', url });
  if (!text && !media.length) throw Error('The public post is unavailable.');
  return { text, author, publishedAt: publishedAt || null, media, links: [], metadataAvailable: true, incomplete: incomplete || (!commentary && !images.length && !video) };
}
function* walk(value: unknown, depth = 0): Generator<Record<string, any>> { if (depth > 6 || !value || typeof value !== 'object') return; if (Array.isArray(value)) { for (const item of value.slice(0, 500)) yield* walk(item, depth + 1); return; } yield value as Record<string, any>; for (const child of Object.values(value as object)) yield* walk(child, depth + 1); }
export function parseLinkedInVoyager(json: unknown, id: string): SocialManifest {
  const nodes = [...walk(json)];
  const update = nodes.find(n => typeof n.commentary?.text?.text === 'string' && JSON.stringify(n.entityUrn ?? n.updateMetadata?.urn ?? '').includes(id)) ?? nodes.find(n => typeof n.commentary?.text?.text === 'string');
  if (!update) throw Error('The public post is unavailable.');
  const media: SocialMedia[] = []; let incomplete = false;
  for (const node of nodes) {
    if (node.vectorImage?.rootUrl && Array.isArray(node.vectorImage.artifacts)) { const best = [...node.vectorImage.artifacts].sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0]; const url = mediaHost(String(node.vectorImage.rootUrl) + String(best?.fileIdentifyingUrlPathSegment ?? ''), CDN); if (url && !/profile-displayphoto|company-logo/.test(url) && media.length < 8 && !media.some(m => m.url === url)) media.push({ kind: 'image', url }); else if (!url) incomplete = true; }
    if (Array.isArray(node.progressiveStreams)) { const best = [...node.progressiveStreams].sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0]; const url = mediaHost(best?.streamingLocations?.[0]?.url, CDN); if (url && !media.some(m => m.url === url)) media.push({ kind: 'video', url }); else if (!url) incomplete = true; }
  }
  return { text: clean(update.commentary.text.text, 50_000), author: clean(update.actor?.name?.text, 200), publishedAt: null, media: media.slice(0, 8), links: [], metadataAvailable: true, incomplete };
}
export const resolveLinkedIn: SocialResolver = async (post, hints, signal, deps) => {
  let restricted = false;
  try {
    const page = await deps.read(post.url, { maxBytes: 3 * 1024 * 1024, signal, accept: 'text/html', headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (blockedRoute(page.url) || /\/authwall/.test(page.url)) restricted = true; else return withLinks(parseLinkedInGuest(page.data.toString('utf8'), post.id), hints);
  } catch (error) { signal.throwIfAborted(); restricted = error instanceof PublicResourceError && isRestrictedStatus(error.status); }
  const session = deps.session('linkedin');
  if (!session) return { ...EMPTY_MANIFEST(), restricted, links: hints.links };
  const csrf = (session.cookie('JSESSIONID') || '').replace(/^"|"$/g, '');
  try {
    const response = await deps.read(`https://www.linkedin.com/voyager/api/feed/updates/urn:li:activity:${post.id}`, { maxBytes: 4 * 1024 * 1024, signal, accept: 'application/vnd.linkedin.normalized+json+2.1',
      headers: { 'User-Agent': BROWSER_UA, 'csrf-token': csrf, 'x-restli-protocol-version': '2.0.0', 'x-li-lang': 'en_US', accept: 'application/vnd.linkedin.normalized+json+2.1', 'Accept-Language': 'en-US,en;q=0.9' }, cookies: host => session.cookieHeader(host) });
    if (blockedRoute(response.url) || /\/authwall|\/login/.test(response.url)) { session.report('login'); return { ...EMPTY_MANIFEST(), restricted: true, links: hints.links }; }
    const manifest = parseLinkedInVoyager(JSON.parse(response.data.toString('utf8')), post.id); session.report('ok'); return withLinks(manifest, hints);
  } catch (error) {
    signal.throwIfAborted();
    const status = error instanceof PublicResourceError ? error.status : 0;
    session.report(status === 429 ? 'ratelimited' : isRestrictedStatus(status) ? 'denied' : 'ok');
    return { ...EMPTY_MANIFEST(), restricted: restricted || isRestrictedStatus(status), links: hints.links };
  }
};
const withLinks = (m: SocialManifest, hints: { links: string[] }) => { m.links = [...new Set([...m.links, ...hints.links])].slice(0, 3); return m; };
```

- [ ] **Step 5: Run tests** — `bun test test/customer-linkedin.test.ts` → pass.

- [ ] **Step 6: Commit**

```bash
git add src/customer-linkedin.ts test/customer-linkedin.test.ts test/fixtures/social/linkedin-guest.html test/fixtures/social/linkedin-voyager.json
git commit -m "feat(social): LinkedIn resolver via guest page and Voyager session API"
```

---

### Task 9: Bluesky resolver

**Files:**
- Create: `src/customer-bluesky.ts`, `test/fixtures/social/bluesky-thread.json`
- Test: `test/customer-bluesky.test.ts`

**Interfaces:**
- Produces: `export const resolveBluesky: SocialResolver`; pure `parseBlueskyThread(json: unknown, rkey: string): SocialManifest`.

- [ ] **Step 1: Fixture** `bluesky-thread.json`: `{ "thread": { "$type": "app.bsky.feed.defs#threadViewPost", "post": { "uri": "at://did:plc:abc/app.bsky.feed.post/3kabc", "author": { "did": "did:plc:abc", "handle": "alice.bsky.social", "displayName": "Alice" }, "record": { "$type": "app.bsky.feed.post", "text": "Two photos from the ridge", "createdAt": "2026-09-01T10:00:00.000Z", "facets": [ { "features": [ { "$type": "app.bsky.richtext.facet#link", "uri": "https://example.org/ridge" } ] } ] }, "embed": { "$type": "app.bsky.embed.images#view", "images": [ { "fullsize": "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:abc/bafy1@jpeg", "alt": "" }, { "fullsize": "https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:abc/bafy2@jpeg", "alt": "" } ] } } } }`.

- [ ] **Step 2: Write the failing tests**

```ts
// test/customer-bluesky.test.ts
import { expect, test } from 'bun:test';
import { parseBlueskyThread, resolveBluesky } from '../src/customer-bluesky.ts';
const json = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).json();
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
test('thread view yields text, author, images and facet links', async () => {
  const m = parseBlueskyThread(await json('bluesky-thread.json'), '3kabc');
  expect(m).toMatchObject({ text: 'Two photos from the ridge', author: 'Alice (@alice.bsky.social)', publishedAt: '2026-09-01T10:00:00.000Z', links: ['https://example.org/ridge'], metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'image', url: 'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:abc/bafy1@jpeg' }, { kind: 'image', url: 'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:abc/bafy2@jpeg' }]);
});
test('video embeds keep the thumbnail and mark the post incomplete; record-with-media unwraps', () => {
  const m = parseBlueskyThread({ thread: { post: { uri: 'at://did:plc:abc/app.bsky.feed.post/3kv', author: { handle: 'a.b' }, record: { text: 'clip', createdAt: '2026-09-01T00:00:00Z' }, embed: { $type: 'app.bsky.embed.recordWithMedia#view', media: { $type: 'app.bsky.embed.video#view', playlist: 'https://video.bsky.app/watch/did/cid/playlist.m3u8', thumbnail: 'https://video.bsky.app/watch/did/cid/thumbnail.jpg' } } } } }, '3kv');
  expect(m.media).toEqual([{ kind: 'image', url: 'https://video.bsky.app/watch/did/cid/thumbnail.jpg' }]); expect(m.incomplete).toBe(true);
  expect(() => parseBlueskyThread({ thread: { $type: 'app.bsky.feed.defs#notFoundPost' } }, '3kv')).toThrow();
});
test('resolver resolves handles to DIDs and fetches the thread from the public API', async () => {
  const thread = await json('bluesky-thread.json'); const calls: string[] = [];
  const read = async (url: string) => { calls.push(url); if (url.includes('resolveHandle')) return { url, mime: 'application/json', data: Buffer.from('{"did":"did:plc:abc"}'), status: 200 }; return { url, mime: 'application/json', data: Buffer.from(JSON.stringify(thread)), status: 200 }; };
  const m = await resolveBluesky({ platform: 'bluesky', site: 'bluesky', id: 'alice.bsky.social/3kabc', url: 'https://bsky.app/profile/alice.bsky.social/post/3kabc' }, hints, new AbortController().signal, { read, session: () => null, source: async () => { throw Error('unused'); } });
  expect(m.media).toHaveLength(2);
  expect(calls).toEqual(['https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.bsky.social', 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at%3A%2F%2Fdid%3Aplc%3Aabc%2Fapp.bsky.feed.post%2F3kabc&depth=0&parentHeight=0']);
  const direct = await resolveBluesky({ platform: 'bluesky', site: 'bluesky', id: 'did:plc:abc/3kabc', url: 'https://bsky.app/profile/did:plc:abc/post/3kabc' }, hints, new AbortController().signal, { read, session: () => null, source: async () => { throw Error('unused'); } });
  expect(direct.metadataAvailable).toBe(true); expect(calls).toHaveLength(3);
});
```

- [ ] **Step 3: Run to verify failure** — `bun test test/customer-bluesky.test.ts` → FAIL.

- [ ] **Step 4: Implement**

```ts
// src/customer-bluesky.ts
import { previewSourceUrl } from './customer-preview.ts';
import { EMPTY_MANIFEST, mediaHost, type SocialManifest, type SocialMedia, type SocialResolver } from './customer-social.ts';
const CDN = ['cdn.bsky.app', 'video.bsky.app', 'video.cdn.bsky.app'];
const API = 'https://public.api.bsky.app/xrpc';
export function parseBlueskyThread(json: unknown, rkey: string): SocialManifest {
  const post = (json as any)?.thread?.post;
  if (!post?.record || typeof post.uri !== 'string' || !post.uri.endsWith('/' + rkey)) throw Error('The public post is unavailable.');
  const media: SocialMedia[] = []; let incomplete = false;
  const embed = post.embed?.$type === 'app.bsky.embed.recordWithMedia#view' ? post.embed.media : post.embed;
  if (embed?.$type === 'app.bsky.embed.images#view') for (const image of (embed.images ?? []).slice(0, 8)) { const url = mediaHost(image?.fullsize, CDN); if (url) media.push({ kind: 'image', url }); else incomplete = true; }
  else if (embed?.$type === 'app.bsky.embed.video#view') { const thumb = mediaHost(embed.thumbnail, CDN); if (thumb) media.push({ kind: 'image', url: thumb }); incomplete = true; }
  const links: string[] = [];
  for (const facet of post.record.facets ?? []) for (const feature of facet?.features ?? []) if (feature?.$type === 'app.bsky.richtext.facet#link') { const u = previewSourceUrl(feature.uri); if (u && !/(^|\.)bsky\.app$/.test(u.hostname)) links.push(u.href); }
  const external = embed?.$type === 'app.bsky.embed.external#view' ? previewSourceUrl(embed.external?.uri) : null; if (external) links.push(external.href);
  const name = typeof post.author?.displayName === 'string' ? post.author.displayName.trim().slice(0, 200) : '', handle = typeof post.author?.handle === 'string' ? post.author.handle.slice(0, 253) : '';
  return { text: String(post.record.text ?? '').slice(0, 50_000), author: name ? `${name} (@${handle})` : `@${handle}`, publishedAt: typeof post.record.createdAt === 'string' ? post.record.createdAt.slice(0, 100) : null, media, links: [...new Set(links)].slice(0, 3), metadataAvailable: true, incomplete };
}
export const resolveBluesky: SocialResolver = async (post, hints, signal, deps) => {
  const [actor, rkey] = post.id.split('/') as [string, string];
  try {
    let did = actor;
    if (!did.startsWith('did:')) { const r = await deps.read(`${API}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(actor)}`, { maxBytes: 64 * 1024, signal, accept: 'application/json' }); did = String(JSON.parse(r.data.toString('utf8')).did ?? ''); if (!/^did:[a-z]+:[\w.:%-]+$/.test(did)) throw Error('Unknown handle.'); }
    const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
    const thread = await deps.read(`${API}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`, { maxBytes: 2 * 1024 * 1024, signal, accept: 'application/json' });
    const manifest = parseBlueskyThread(JSON.parse(thread.data.toString('utf8')), rkey);
    manifest.links = [...new Set([...manifest.links, ...hints.links])].slice(0, 3);
    return manifest;
  } catch { signal.throwIfAborted(); return { ...EMPTY_MANIFEST(), links: hints.links }; }
};
```

- [ ] **Step 5: Run tests** — pass. **Step 6: Commit**

```bash
git add src/customer-bluesky.ts test/customer-bluesky.test.ts test/fixtures/social/bluesky-thread.json
git commit -m "feat(social): Bluesky resolver over the public XRPC API"
```

---

### Task 10: YouTube resolver

**Files:**
- Create: `src/customer-youtube.ts`
- Test: `test/customer-youtube.test.ts`

**Interfaces:**
- Produces: `export const resolveYouTube: SocialResolver`; pure `parseYouTubeOembed(json: unknown, id: string): SocialManifest`.

- [ ] **Step 1: Write the failing tests**

```ts
// test/customer-youtube.test.ts
import { expect, test } from 'bun:test';
import { parseYouTubeOembed, resolveYouTube } from '../src/customer-youtube.ts';
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
const post = { platform: 'youtube' as const, site: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
test('oembed gives title, channel and thumbnail, and the video itself is the media item', () => {
  const m = parseYouTubeOembed({ title: 'A talk', author_name: 'Channel', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }, post.id);
  expect(m).toMatchObject({ text: 'A talk', author: 'Channel', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, { kind: 'image', url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg' }]);
  expect(() => parseYouTubeOembed({ error: 'x' }, post.id)).toThrow();
});
test('resolver calls the oembed endpoint and degrades to the video item alone on failure', async () => {
  const calls: string[] = [];
  const ok = await resolveYouTube(post, hints, new AbortController().signal, { read: async (url: string) => { calls.push(url); return { url, mime: 'application/json', data: Buffer.from(JSON.stringify({ title: 'T', author_name: 'C', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' })), status: 200 }; }, session: () => null, source: async () => { throw Error('unused'); } });
  expect(calls).toEqual(['https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json']);
  expect(ok.metadataAvailable).toBe(true);
  const degraded = await resolveYouTube(post, hints, new AbortController().signal, { read: async () => { throw Error('down'); }, session: () => null, source: async () => { throw Error('unused'); } });
  expect(degraded).toMatchObject({ metadataAvailable: false, media: [{ kind: 'video', url: post.url }] });
});
```

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**

```ts
// src/customer-youtube.ts
import { mediaHost, type SocialManifest, type SocialResolver } from './customer-social.ts';
export function parseYouTubeOembed(json: unknown, id: string): SocialManifest {
  const v = json as any;
  if (!v || typeof v.title !== 'string') throw Error('The public video is unavailable.');
  const media: SocialManifest['media'] = [{ kind: 'video', url: `https://www.youtube.com/watch?v=${id}` }];
  if (mediaHost(v.thumbnail_url, ['ytimg.com'])) media.push({ kind: 'image', url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` });
  return { text: v.title.slice(0, 1000), author: typeof v.author_name === 'string' ? v.author_name.slice(0, 200) : '', publishedAt: null, media, links: [], metadataAvailable: true };
}
export const resolveYouTube: SocialResolver = async (post, hints, signal, deps) => {
  try {
    const r = await deps.read(`https://www.youtube.com/oembed?url=${encodeURIComponent(post.url)}&format=json`, { maxBytes: 64 * 1024, signal, accept: 'application/json' });
    const m = parseYouTubeOembed(JSON.parse(r.data.toString('utf8')), post.id); m.links = hints.links.slice(0, 3); return m;
  } catch { signal.throwIfAborted(); return { text: '', author: '', publishedAt: null, media: [{ kind: 'video', url: post.url }], links: hints.links.slice(0, 3), metadataAvailable: false }; }
};
```

The preservation pipeline already tries `maxresdefault.jpg` through the image path; if YouTube returns 404 for it, the image is simply skipped (an issue note is added as today). If that proves noisy in practice, fall back to the oembed `thumbnail_url` — but keep one image only.

- [ ] **Step 4: Run tests**, **Step 5: Commit**

```bash
git add src/customer-youtube.ts test/customer-youtube.test.ts
git commit -m "feat(social): YouTube resolver via oEmbed with the video path doing the rest"
```

---

### Task 11: Integration, docs and full verification

**Files:**
- Modify: `src/customer-social.ts` (register the five resolvers)
- Create: `docs/SOCIAL-SESSIONS-SETUP.md`
- Modify: `docs/superpowers/specs/2026-09-18-social-resolvers-design.md` (section 5: replace the yt-dlp "merge mode" paragraph with the direct `audioUrls` + TS mux approach; note Bluesky video is thumbnail-only in this pass)
- Test: `test/customer-social.test.ts` (dispatch test)

- [ ] **Step 1: Register resolvers**

```ts
import { resolveReddit } from './customer-reddit.ts';
import { resolveInstagram } from './customer-instagram.ts';
import { resolveLinkedIn } from './customer-linkedin.ts';
import { resolveBluesky } from './customer-bluesky.ts';
import { resolveYouTube } from './customer-youtube.ts';
const resolvers: Partial<Record<SocialPlatform, SocialResolver>> = { x: …, reddit: resolveReddit, instagram: resolveInstagram, linkedin: resolveLinkedIn, bluesky: resolveBluesky, youtube: resolveYouTube, generic: resolveGeneric };
```

Circular import check: `customer-reddit.ts` etc. import from `customer-social.ts` (types + helpers) and `customer-social.ts` imports them back. Bun handles cycles for function references used at call time, but `mediaHost`/`EMPTY_MANIFEST` are used inside function bodies only, so this is safe. If `bun test` reports an undefined import at load, move `mediaHost`, `isoDate`, `isRestrictedStatus`, `EMPTY_MANIFEST` and the types into a new `src/customer-social-types.ts` and re-export them from `customer-social.ts`.

Add to `test/customer-social.test.ts`:

```ts
test('resolveSocialPost dispatches by platform', async () => {
  const read = async (url: string) => ({ url, mime: 'application/json', data: Buffer.from(JSON.stringify({ title: 'T', author_name: 'C', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' })), status: 200 });
  const m = await resolveSocialPost('https://youtu.be/dQw4w9WgXcQ', { version: 1, images: [], links: [], articleText: '' }, new AbortController().signal, { read, session: () => null });
  expect(m.text).toBe('T');
  await expect(resolveSocialPost('https://example.com/x', { version: 1, images: [], links: [], articleText: '' }, new AbortController().signal, { read, session: () => null })).rejects.toThrow('Use a public social post link.');
});
```

- [ ] **Step 2: Write `docs/SOCIAL-SESSIONS-SETUP.md`**

```markdown
# Social sessions (operator cookies) — setup on omni

FoundKeep's backend resolves social posts anonymously first. When a platform blocks server access
(Instagram, LinkedIn, sometimes Reddit and YouTube), it retries with an operator-supplied browser session.

## Where files live
`~/.config/foundkeep/social-sessions/` (override with `FOUNDKEEP_SOCIAL_SESSIONS_DIR` in a systemd drop-in). Directory `0700`, files `0600`, owner = the service user (`pritam`). The backend hot-reloads changes within 30 s; the startup log line `social sessions: …` lists which sites loaded (names only).

## Two file formats per site
* `<site>.txt` — Netscape cookies.txt exported from a signed-in browser (extension "Get cookies.txt LOCALLY", export for the site only). Best for YouTube (yt-dlp needs the full jar).
* `<site>.cookie` — one line of `name=value; name2=value2` for the few cookies that matter:
  * `instagram.cookie`: `sessionid`, `csrftoken`, `ds_user_id`
  * `linkedin.cookie`: `li_at`, `JSESSIONID` (keep the quotes: `JSESSIONID="ajax:…"`)
  * `reddit.cookie`: `reddit_session`
  * `x.cookie`: `auth_token`, `ct0`
Sites: x, reddit, instagram, linkedin, bluesky, youtube, tiktok, threads, facebook, pinterest, tumblr, vimeo, twitch, dailymotion.

## Moving the values safely
Never paste cookie values into a chat or a ticket. From the Mac:
```
scp instagram.cookie linkedin.cookie youtube.txt pritam@157.180.102.248:~/.config/foundkeep/social-sessions/
ssh pritam@157.180.102.248 'chmod 700 ~/.config/foundkeep/social-sessions && chmod 600 ~/.config/foundkeep/social-sessions/*'
```
Or use the bb `secrets` skill to write a `.cookie` file without the value passing through an agent.

## Guard rails
Cookies are only sent to hosts matching their domain (re-checked on every redirect). On 401/403/429 or a login redirect the site's session cools down for 30 minutes (10 for rate limits) and anonymous access is used meanwhile. Authenticated calls are spaced at least 2 s apart per site. Nothing from a session is ever logged.

## Risk
Platforms may flag an account whose session appears from a datacenter IP. Prefer a secondary account. Refresh the file when the platform signs you out (the job notes will say "<Platform> restricted server access").
```

- [ ] **Step 3: Update the spec** as listed in Files.

- [ ] **Step 4: Full verification**

Run: `bun test` → all pass. Run the python suite → 17 pass. Run `git status` → clean after commit.
Also run a real anonymous smoke test from omni (no sessions): a one-off script

```bash
bun -e "import {resolveSocialPost} from './src/customer-social.ts'; for (const u of ['https://www.reddit.com/r/space/comments/1abc2d/','https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l','https://www.youtube.com/watch?v=dQw4w9WgXcQ']) console.log(u, JSON.stringify(await resolveSocialPost(u,{version:1,images:[],links:[],articleText:''},AbortSignal.timeout(20000))).slice(0,300))"
```

Replace the Reddit id with a real current post id. Record the outcome (which platforms answered anonymously from omni's IP) in the task report; failures here are information, not test failures.

- [ ] **Step 5: Commit**

```bash
git add src/customer-social.ts test/customer-social.test.ts docs/SOCIAL-SESSIONS-SETUP.md docs/superpowers/specs/2026-09-18-social-resolvers-design.md
git commit -m "feat(social): register platform resolvers, operator session docs"
```

---

## Self-review

- **Spec coverage:** session store (T1), reader headers/cookies (T2), registry + generic + `remoteVideoCandidate` (T3), pipeline gating/messages/transcript (T4), video cookies + mux (T5), Reddit/Instagram/LinkedIn/Bluesky/YouTube (T6–T10), operator setup + startup log (T4, T11). Bluesky video download is explicitly deferred (thumbnail only) and the spec is amended in T11.
- **Type consistency:** `SocialManifest` = `TwitterManifest & { restricted? }` with `media[].audioUrls?` added on `TwitterManifest` (T3) — used by T4/T5/T6. `PlatformSession.cookie(name)` (T1) used by T7/T8. `PublicResource.status` and `PublicResourceError` (T2) used by T6–T8. `preserveRemoteVideo(url, root, signal, download, options)` (T4) matches `RemoteMediaOptions.cookieFile/audioUrls` (T4 typing, T5 behaviour). `resolveSocialPost` deps are `Partial<SocialResolverDeps>` so tests pass only `read`/`session`/`source`.
- **Placeholders:** none; the LinkedIn Voyager endpoint is marked as needing a live check but the code and tests are complete.
