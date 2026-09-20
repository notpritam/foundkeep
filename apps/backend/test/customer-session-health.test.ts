import { afterEach, beforeEach, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../src/db.ts';
import {
  DEFAULT_PROBE_TARGETS,
  createSessionHealthService,
  loadProbeTargets,
  socialSessionStatuses,
} from '../src/customer-session-health.ts';
import { createSessionStore, type PlatformSession, type SessionOutcome, type SessionStore } from '../src/customer-social-sessions.ts';
import { socialPost, type SocialManifest } from '../src/customer-social.ts';

const REDDIT = 'https://www.reddit.com/r/space/comments/1abc2d/';
const INSTAGRAM = 'https://www.instagram.com/p/AbCdEfGh/';
const TARGETS = { reddit: REDDIT, instagram: INSTAGRAM };
const SECRET = 'reddit_session=super-secret-value';
const HOUR = 3_600_000;

type Plan = { consult?: boolean; report?: SessionOutcome; metadataAvailable?: boolean; throws?: string };

let db: ReturnType<typeof openDb>, dir: string;
beforeEach(() => {
  db = openDb(':memory:');
  dir = mkdtempSync('/tmp/foundkeep-probes-');
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A session store stub: names only, plus a cookie value nothing may ever surface. */
function stubStore(state: Record<string, 'ready' | 'cooling'>, reports: [string, SessionOutcome][]): SessionStore {
  const session = (site: string): PlatformSession | null =>
    state[site] !== 'ready' ? null : {
      site,
      cookieFile: join('/tmp/never-surfaced', `${site}.txt`),
      cookieHeader: () => SECRET,
      cookie: () => 'super-secret-value',
      report: outcome => reports.push([site, outcome]),
    };
  return {
    sites: () => Object.keys(state).sort(),
    session,
    cookieFileFor: site => (state[site] === 'ready' ? join('/tmp/never-surfaced', `${site}.txt`) : null),
    describe: () => `social sessions: ${Object.keys(state).sort().join(', ')}`,
  };
}

function harness(options: { state?: Record<string, 'ready' | 'cooling'>; script?: Record<string, Plan>; targets?: Record<string, string> } = {}) {
  const state = options.state ?? { reddit: 'ready' };
  const targets: Record<string, string> = options.targets ?? TARGETS;
  const script = options.script ?? {};
  let clock = 1_700_000_000_000;
  const calls: string[] = [];
  const reports: [string, SessionOutcome][] = [];
  const alerts: { title: string; body: string }[] = [];
  const siteFor = (url: string) => Object.keys(targets).find(site => socialPost(targets[site]!)!.url === url) ?? socialPost(url)!.site;
  const resolve = async (url: string, _hints: unknown, _signal: AbortSignal, deps: { session?: (site: string) => PlatformSession | null }): Promise<SocialManifest> => {
    calls.push(url);
    const site = siteFor(url);
    const plan: Plan = script[site] ?? {};
    if (plan.consult !== false) {
      const session = deps.session?.(site) ?? null;
      if (session) session.report(plan.report ?? 'ok');
    }
    if (plan.throws) throw Error(plan.throws);
    return { text: '', author: '', publishedAt: null, media: [], links: [], metadataAvailable: plan.metadataAvailable ?? true };
  };
  const sessions = stubStore(state, reports);
  const service = createSessionHealthService(db, {
    sessions,
    targets,
    resolve: resolve as never,
    notify: alert => { alerts.push(alert); },
    now: () => clock,
  });
  return {
    service, calls, reports, alerts, sessions, script,
    advance: (ms: number) => { clock += ms; },
    at: () => clock,
    due: () => { clock += 6 * HOUR; },
    row: (site: string) => db.query('SELECT * FROM social_session_probes WHERE site=?').get(site) as
      { site: string; status: string; reason: string | null; checked_at: number; ok_at: number | null; failures: number; notified_at: number | null } | null,
    status: (site: string) => service.statuses().find(s => s.site === site),
  };
}
const start = async (h: ReturnType<typeof harness>) => { h.advance(120_000); return h.service.tick(); };

test('the first pass waits two minutes and later passes wait six hours', async () => {
  const h = harness();
  expect(await h.service.tick()).toBe(0);
  expect(h.calls).toEqual([]);
  h.advance(119_000);
  expect(await h.service.tick()).toBe(0);
  h.advance(1_000);
  expect(await h.service.tick()).toBe(1);
  expect(h.calls).toEqual([REDDIT]);
  h.advance(5 * HOUR);
  expect(await h.service.tick()).toBe(0);
  h.advance(HOUR);
  expect(await h.service.tick()).toBe(1);
  expect(h.calls.length).toBe(2);
});

test('a session the resolver used and reported ok reads healthy', async () => {
  const h = harness({ script: { reddit: { report: 'ok' } } });
  await start(h);
  expect(h.reports).toEqual([['reddit', 'ok']]);
  const row = h.row('reddit')!;
  expect(row.status).toBe('healthy');
  expect(row.reason).toBeNull();
  expect(row.ok_at).toBe(h.at());
  expect(row.failures).toBe(0);
  expect(h.alerts).toEqual([]);
});

test('an anonymous path that returned metadata reads healthy without consulting the session', async () => {
  const h = harness({ script: { reddit: { consult: false } } });
  await start(h);
  expect(h.reports).toEqual([]);
  expect(h.row('reddit')!.status).toBe('healthy');
});

test('a session reported login is expired at once and alerts the operator', async () => {
  const h = harness({ script: { reddit: { report: 'login', metadataAvailable: false } } });
  await start(h);
  const row = h.row('reddit')!;
  expect(row.status).toBe('expired');
  expect(row.notified_at).toBe(h.at());
  expect(h.alerts.length).toBe(1);
  expect(h.alerts[0]!.body).toContain('Reddit');
  expect(h.alerts[0]!.body).toContain('reddit.txt');
  expect(JSON.stringify(h.alerts)).not.toContain('super-secret-value');
  expect(JSON.stringify(h.alerts)).not.toContain('/tmp/never-surfaced');
});

test('a session reported denied is expired even when the anonymous read still worked', async () => {
  const h = harness({ script: { reddit: { report: 'denied', metadataAvailable: true } } });
  await start(h);
  expect(h.row('reddit')!.status).toBe('expired');
});

test('two consecutive non-terminal failures escalate to expired', async () => {
  const h = harness({ script: { reddit: { report: 'ratelimited', metadataAvailable: false } } });
  await start(h);
  let row = h.row('reddit')!;
  expect(row.status).toBe('failing');
  expect(row.failures).toBe(1);
  expect(h.alerts).toEqual([]);
  h.due();
  await h.service.tick();
  row = h.row('reddit')!;
  expect(row.status).toBe('expired');
  expect(row.failures).toBe(2);
  expect(h.alerts.length).toBe(1);
});

test('a resolver that throws is recorded as failing and never rejects the tick', async () => {
  const h = harness({ script: { reddit: { throws: 'socket hang up on https://reddit.com/secret' } } });
  await expect(start(h)).resolves.toBe(1);
  const row = h.row('reddit')!;
  expect(row.status).toBe('failing');
  expect(row.reason).not.toContain('socket hang up');
  expect(row.failures).toBe(1);
});

test('a healthy result clears the failure count and the alert throttle', async () => {
  const h = harness({ script: { reddit: { report: 'login', metadataAvailable: false } } });
  await start(h);
  expect(h.alerts.length).toBe(1);
  h.script.reddit = { report: 'ok' };
  h.due();
  await h.service.tick();
  let row = h.row('reddit')!;
  expect(row.status).toBe('healthy');
  expect(row.failures).toBe(0);
  expect(row.notified_at).toBeNull();
  // The next expiry alerts again straight away, because recovery cleared the throttle.
  h.script.reddit = { report: 'login', metadataAvailable: false };
  h.due();
  await h.service.tick();
  row = h.row('reddit')!;
  expect(row.status).toBe('expired');
  expect(h.alerts.length).toBe(2);
});

test('an expiry alerts at most once every twelve hours', async () => {
  const h = harness({ script: { reddit: { report: 'login', metadataAvailable: false } } });
  await start(h);
  expect(h.alerts.length).toBe(1);
  // At exactly twelve hours, a new transition may alert again.
  h.script.reddit = { report: 'ratelimited', metadataAvailable: false };
  h.due();
  await h.service.tick();
  expect(h.row('reddit')!.status).toBe('failing');
  h.script.reddit = { report: 'login', metadataAvailable: false };
  h.due();
  await h.service.tick();
  expect(h.row('reddit')!.status).toBe('expired');
  expect(h.alerts.length).toBe(2);
  // Remaining expired does not repeatedly notify without another transition.
  h.due();
  await h.service.tick();
  expect(h.alerts.length).toBe(2);
});

test('a real session store reserves one slot for the authenticated probe', async () => {
  writeFileSync(join(dir,'reddit.cookie'), SECRET, { mode: 0o600 });
  let clock = 1_700_000_000_000, used = false;
  const sessions = createSessionStore({ directory: dir, runtimeDirectory: join(dir,'runtime'), now: () => clock });
  const service = createSessionHealthService(db, { sessions, targets: {reddit: REDDIT}, now: () => clock,
    resolve: async (_url,_hints,_signal,deps) => {
      const session = deps?.session?.('reddit');
      used = session?.cookieHeader('www.reddit.com') === SECRET;
      session?.report('ok');
      return {text:'post',author:'',publishedAt:null,media:[],links:[],metadataAvailable:used};
    } });
  clock += 120_000;
  await service.tick();
  expect(used).toBe(true);
  expect(service.statuses()[0]!.status).toBe('healthy');
});

test('failed notification delivery is retried and concurrent ticks do not duplicate probes', async () => {
  let clock = 1_700_000_000_000, attempts = 0, calls = 0;
  const service = createSessionHealthService(db, { sessions: stubStore({reddit:'ready'},[]), targets:{reddit:REDDIT}, now:()=>clock,
    notify:()=>{ attempts++; return attempts === 1 ? 0 : 1; },
    resolve:async (_url,_hints,_signal,deps)=>{
      calls++; await Promise.resolve(); deps?.session?.('reddit')?.report('login');
      return {text:'',author:'',publishedAt:null,media:[],links:[],metadataAvailable:false};
    } });
  clock += 120_000;
  await Promise.all([service.tick(),service.tick()]);
  expect(calls).toBe(1);
  expect((db.query('SELECT notified_at FROM social_session_probes').get() as any).notified_at).toBeNull();
  clock += 6 * HOUR;
  await service.tick();
  expect(attempts).toBe(2);
  expect((db.query('SELECT notified_at FROM social_session_probes').get() as any).notified_at).toBe(clock);
});

test('a restart respects the persisted six-hour probe interval', async () => {
  const h = harness();
  await start(h);
  let calls = 0;
  const restarted = createSessionHealthService(db, { sessions:h.sessions, targets:TARGETS, now:h.at,
    resolve:async()=>{ calls++; throw Error('must not probe yet'); } });
  h.advance(120_000);
  await restarted.tick();
  expect(calls).toBe(0);
});

test('a site cooling down is not a failure and leaves the stored status alone', async () => {
  const h = harness({ script: { reddit: { report: 'ratelimited', metadataAvailable: false } } });
  await start(h);
  expect(h.row('reddit')!.status).toBe('failing');
  expect(h.row('reddit')!.failures).toBe(1);
  h.sessions.session = () => null; // the breaker is holding the session back
  h.due();
  await h.service.tick();
  const row = h.row('reddit')!;
  expect(row.status).toBe('failing');
  expect(row.failures).toBe(1);
  expect(row.checked_at).toBe(h.at());
  expect(h.status('reddit')!.reason).toContain('cooling');
});

test('a site with no session file is never probed and reads absent', async () => {
  const h = harness({ state: { reddit: 'ready' } });
  await start(h);
  expect(h.calls).toEqual([REDDIT]);
  expect(h.row('instagram')).toBeNull();
  const instagram = h.status('instagram')!;
  expect(instagram.status).toBe('absent');
  expect(instagram.checkedAt).toBeNull();
});

test('a loaded site reads pending until its first probe lands', () => {
  const sessions = stubStore({ reddit: 'ready', instagram: 'cooling' }, []);
  const rows = socialSessionStatuses(db, { sessions, targets: TARGETS });
  expect(rows.map(r => [r.site, r.status])).toEqual([['instagram', 'pending'], ['reddit', 'pending']]);
  expect(rows.every(r => r.failures === 0 && r.checkedAt === null && r.okAt === null)).toBe(true);
});

test('the read model merges loaded sites, probe rows and target sites', async () => {
  const h = harness({ state: { reddit: 'ready', tiktok: 'ready' } });
  await start(h);
  const rows = h.service.statuses();
  expect(rows.map(r => r.site)).toEqual(['instagram', 'reddit', 'tiktok']);
  expect(rows.find(r => r.site === 'instagram')!.status).toBe('absent');
  expect(rows.find(r => r.site === 'reddit')!.status).toBe('healthy');
  // A loaded site with no probe target is reported, not silently probed.
  expect(h.calls).toEqual([REDDIT]);
  const tiktok = rows.find(r => r.site === 'tiktok')!;
  expect(tiktok.status).toBe('failing');
  expect(tiktok.reason).toContain('probes.json');
  // A missing target is not an expiry: it must never escalate or alert.
  h.due();
  await h.service.tick();
  expect(h.service.statuses().find(r => r.site === 'tiktok')!.status).toBe('failing');
  expect(h.alerts).toEqual([]);
  expect(JSON.stringify(rows)).not.toContain('super-secret-value');
  expect(JSON.stringify(rows)).not.toContain('/tmp/never-surfaced');
});

test('a probe row for a site whose file was removed reads absent again', async () => {
  const h = harness();
  await start(h);
  expect(h.row('reddit')!.status).toBe('healthy');
  const gone = socialSessionStatuses(db, { sessions: stubStore({}, []), targets: TARGETS });
  expect(gone.find(r => r.site === 'reddit')!.status).toBe('absent');
  expect(gone.find(r => r.site === 'reddit')!.okAt).toBe(h.at());
});

test('probes.json overrides a default target and every entry must pass socialPost', () => {
  const probes = join(dir, 'probes.json');
  writeFileSync(probes, JSON.stringify({
    reddit: 'https://old.reddit.com/r/space/comments/1zzz9z/some_title/?utm_source=share',
    instagram: 'https://evil.test/p/abc/',
    linkedin: 'file:///etc/passwd',
    youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    bluesky: 42,
    'x/../../etc': 'https://x.com/jack/status/20',
    x: 'https://www.reddit.com/r/space/comments/1abc2d/',
  }));
  chmodSync(probes, 0o600);
  const targets = loadProbeTargets(dir);
  expect(targets.reddit).toBe('https://www.reddit.com/r/space/comments/1zzz9z/');
  expect(targets.instagram).toBe(DEFAULT_PROBE_TARGETS.instagram);
  expect(targets.linkedin).toBe(DEFAULT_PROBE_TARGETS.linkedin);
  expect(targets.youtube).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  expect(targets.bluesky).toBe(DEFAULT_PROBE_TARGETS.bluesky);
  expect(targets['x/../../etc']).toBeUndefined();
  // A URL for another platform can never be a site's probe target.
  expect(targets.x).toBe(DEFAULT_PROBE_TARGETS.x);
});

test('a malformed or missing probes.json falls back to the defaults', () => {
  expect(loadProbeTargets(dir)).toEqual(DEFAULT_PROBE_TARGETS);
  writeFileSync(join(dir, 'probes.json'), '{ not json at all');
  expect(loadProbeTargets(dir)).toEqual(DEFAULT_PROBE_TARGETS);
  writeFileSync(join(dir, 'probes.json'), '["https://x.com/jack/status/20"]');
  expect(loadProbeTargets(dir)).toEqual(DEFAULT_PROBE_TARGETS);
  expect(loadProbeTargets(join(dir, 'missing'))).toEqual(DEFAULT_PROBE_TARGETS);
});

test('every default probe target is a post the resolver would accept', () => {
  for (const [site, url] of Object.entries(DEFAULT_PROBE_TARGETS)) {
    const post = socialPost(url);
    expect(post).not.toBeNull();
    expect(post!.site).toBe(site);
    expect(post!.url).toBe(url);
  }
});
