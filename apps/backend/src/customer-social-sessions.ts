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
type Loaded = { site: string; cookies: Cookie[]; cookieFile: string | null; mtimeMs: number; kind: 'txt' | 'cookie' };

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

/** Creates a session store that watches `directory` for operator-dropped
 * cookie files (`<site>.txt` Netscape jars or `<site>.cookie` raw
 * `name=value; ...` lines) and exposes per-site, host-scoped cookie access
 * with a failure breaker. Nothing here logs cookie values. */
export function createSessionStore(options: { directory?: string; runtimeDirectory?: string; now?: () => number } = {}): SessionStore {
  const directory = options.directory ?? process.env.FOUNDKEEP_SOCIAL_SESSIONS_DIR ?? join(homedir(), '.config', 'foundkeep', 'social-sessions');
  const runtime = options.runtimeDirectory ?? join(config.dataDir, 'social-sessions');
  const now = options.now ?? Date.now;
  const loaded = new Map<string, Loaded>();
  const cooldownUntil = new Map<string, number>(), lastIssued = new Map<string, number>();
  let scannedAt = -Infinity;

  function synthesize(site: string, cookies: Cookie[]): string | null {
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
    // Process `.txt` entries before `.cookie` entries so the ".txt wins" rule
    // does not depend on readdir order.
    names = [...names].sort((a, b) => (a.endsWith('.txt') ? 0 : 1) - (b.endsWith('.txt') ? 0 : 1));
    const seen = new Set<string>();
    for (const name of names) {
      const match = name.match(/^([a-z]+)\.(txt|cookie)$/);
      if (!match) continue;
      const site = match[1]!, kind = match[2] as 'txt' | 'cookie';
      // A `.txt` already accepted for this site in this same scan wins over a
      // `.cookie` file for the same site.
      if (kind === 'cookie' && seen.has(site) && loaded.get(site)?.kind === 'txt') continue;
      const path = join(directory, name), stat = privateRegularFile(path);
      if (!stat) continue;
      const previous = loaded.get(site);
      if (previous && previous.kind === kind && previous.mtimeMs === stat.mtimeMs) { seen.add(site); continue; }
      let cookies: Cookie[];
      try { cookies = kind === 'txt' ? parseNetscape(readFileSync(path, 'utf8')) : parseRaw(readFileSync(path, 'utf8'), SITE_DOMAINS[site] ?? `${site}.com`); }
      catch { continue; }
      if (!cookies.length) continue;
      seen.add(site);
      loaded.set(site, { site, cookies, cookieFile: kind === 'txt' ? path : synthesize(site, cookies), mtimeMs: stat.mtimeMs, kind });
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
