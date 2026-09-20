import type { Database } from 'bun:sqlite';
import { lstatSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveSocialPost, socialPost } from './customer-social.ts';
import { socialSessions, type SessionOutcome, type SessionStore } from './customer-social-sessions.ts';
import { deliverOperatorAlert } from './customer-notifications.ts';

export const DEFAULT_PROBE_TARGETS: Record<string, string> = {
  reddit: 'https://www.reddit.com/r/IAmA/comments/z1c9z/',
  instagram: 'https://www.instagram.com/p/BsOGulcndj-/',
  linkedin: 'https://www.linkedin.com/feed/update/urn:li:activity:7240025662093221889/',
  x: 'https://x.com/jack/status/20',
  bluesky: 'https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l',
  youtube: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
};
const INTERVAL = 6 * 3_600_000, ALERT_INTERVAL = 12 * 3_600_000;
const COOLING = 'Session is cooling down; the next scheduled check will retry.';
const NO_TARGET = 'Set a public post for this site in probes.json.';
const LABELS: Record<string, string> = { reddit: 'Reddit', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X', bluesky: 'Bluesky', youtube: 'YouTube' };
type Status = 'healthy' | 'failing' | 'expired';
type ProbeRow = { site: string; status: Status; reason: string | null; checked_at: number; ok_at: number | null; failures: number; notified_at: number | null };
type Alert = { title: string; body: string };

export function loadProbeTargets(directory = process.env.FOUNDKEEP_SOCIAL_SESSIONS_DIR ?? join(homedir(), '.config', 'foundkeep', 'social-sessions')): Record<string, string> {
  const targets = { ...DEFAULT_PROBE_TARGETS };
  try {
    const path = join(directory, 'probes.json');
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) return targets;
    const overrides: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return targets;
    for (const [site, url] of Object.entries(overrides)) {
      if (!/^[a-z]+$/.test(site) || typeof url !== 'string') continue;
      const post = socialPost(url);
      if (post?.site === site) targets[site] = post.url;
    }
  } catch { /* Missing or invalid operator configuration leaves known defaults. */ }
  return targets;
}

export function socialSessionStatuses(db: Database, options: { sessions?: SessionStore; targets?: Record<string, string> } = {}) {
  const sessions = options.sessions ?? socialSessions, targets = options.targets ?? loadProbeTargets();
  const loaded = new Set(sessions.sites());
  const rows = db.query('SELECT * FROM social_session_probes').all() as ProbeRow[];
  const stored = new Map(rows.map(row => [row.site, row]));
  return [...new Set([...Object.keys(targets), ...loaded, ...stored.keys()])].sort().map(site => {
    const row = stored.get(site);
    const status = !loaded.has(site) ? 'absent' : !targets[site] ? 'failing' : row?.reason === COOLING ? 'cooling' : row?.status ?? 'pending';
    return { site, status, reason: !loaded.has(site) ? null : !targets[site] ? NO_TARGET : row?.reason ?? null,
      checkedAt: row?.checked_at ?? null, okAt: row?.ok_at ?? null, failures: row?.failures ?? 0 };
  });
}

export function createSessionHealthService(db: Database, options: {
  sessions?: SessionStore; resolve?: typeof resolveSocialPost; targets?: Record<string, string>;
  notify?: (alert: Alert) => number | void | Promise<number | void>; now?: () => number;
} = {}) {
  const sessions = options.sessions ?? socialSessions, resolve = options.resolve ?? resolveSocialPost;
  const now = options.now ?? Date.now, notify = options.notify ?? (alert => deliverOperatorAlert(db, alert));
  let nextRun = now() + 120_000, running = false;
  const targets = () => options.targets ?? loadProbeTargets();
  const save = db.query(`INSERT INTO social_session_probes(site,status,reason,checked_at,ok_at,failures,notified_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(site) DO UPDATE SET status=excluded.status,reason=excluded.reason,
    checked_at=excluded.checked_at,ok_at=excluded.ok_at,failures=excluded.failures,notified_at=excluded.notified_at`);
  return {
    statuses: () => socialSessionStatuses(db, { sessions, targets: targets() }),
    async tick(): Promise<number> {
      if (running || now() < nextRun) return 0;
      running = true;
      nextRun = now() + INTERVAL;
      let checked = 0;
      try {
        const configured = targets();
        for (const site of sessions.sites()) {
          const url = configured[site];
          if (!url || socialPost(url)?.site !== site) continue;
          const previous = db.query('SELECT * FROM social_session_probes WHERE site=?').get(site) as ProbeRow | null;
          const at = now();
          // A restart must not turn the six-hour schedule into repeated requests.
          if (previous && at - previous.checked_at < INTERVAL) {
            nextRun = Math.min(nextRun, previous.checked_at + INTERVAL);
            continue;
          }
          const session = sessions.session(site);
          if (!session) {
            save.run(site, previous?.status ?? 'failing', COOLING, at, previous?.ok_at ?? null, previous?.failures ?? 0, previous?.notified_at ?? null);
            continue;
          }
          let outcome: SessionOutcome | null = null, metadata = false, failed = false;
          try {
            const manifest = await resolve(url, { version: 1, images: [], links: [], articleText: '' }, AbortSignal.timeout(30_000), {
              // Reserve the guarded slot once. Calling the store again here would
              // hit its spacing guard and silently test only anonymous access.
              session: requested => requested !== site ? null : {
                ...session, report: result => { outcome = result; session.report(result); },
              },
            });
            metadata = manifest.metadataAvailable;
          } catch { failed = true; }
          checked++;
          let status: Status, reason: string | null, failures = previous?.failures ?? 0;
          const observed = outcome as SessionOutcome | null;
          if (observed === 'login' || observed === 'denied') {
            status = 'expired'; failures = 0;
            reason = observed === 'login' ? 'The platform requested a new sign-in.' : 'The platform rejected the session.';
          } else if (!failed && metadata && observed !== 'ratelimited') {
            status = 'healthy'; reason = null; failures = 0;
          } else {
            failures++;
            status = failures >= 2 ? 'expired' : 'failing';
            reason = observed === 'ratelimited' ? 'The platform limited this check. It will retry on the next schedule.'
              : failed ? 'The public post check could not be completed.' : 'The probe post did not return readable content. Check the target in probes.json.';
          }
          const okAt = status === 'healthy' ? at : previous?.ok_at ?? null;
          const notifiedAt = status === 'healthy' ? null : previous?.notified_at ?? null;
          save.run(site, status, reason, at, okAt, failures, notifiedAt);
          if (status === 'expired' && (notifiedAt === null || (previous?.status !== 'expired' && at - notifiedAt >= ALERT_INTERVAL))) {
            try {
              const delivered = await notify({ title: 'FoundKeep session needs attention',
                body: `FoundKeep: the ${LABELS[site] ?? site} session needs attention. Replace ${site}.txt to keep saving posts, or check its probe in the console.` });
              // A rejected push or an admin with no paired device is retried next pass.
              if (delivered !== 0) db.query('UPDATE social_session_probes SET notified_at=? WHERE site=?').run(at, site);
            } catch { /* Delivery failure never stops other platform checks. */ }
          }
        }
      } catch { /* A probe is best effort; the next scheduled pass retries. */ }
      finally { running = false; }
      return checked;
    },
  };
}
