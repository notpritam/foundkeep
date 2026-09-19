# Session health: probe, console card, expiry alert — design

Date: 2026-09-19. Status: approved in chat ("build it"). Builds on
`2026-09-18-social-resolvers-design.md`.

## Goal

The operator learns that a platform cookie session has stopped working *before* users notice,
sees per-platform health in the admin console, and gets a push notification on their phone when
a session expires so they can drop in a fresh cookie file.

## Behaviour

**Probe.** Every 6 hours (and 2 minutes after backend start) the backend resolves one known
public post per platform that has a loaded session, through the normal `resolveSocialPost`
path, with a wrapped session that records whether the session was consulted and what outcome
the resolver reported. Targets default to verified public posts and can be overridden per site
with a `probes.json` file in the sessions directory (`{ "<site>": "<url>" }`).

Per-site status, derived from one probe run:

| Observation | Status |
|---|---|
| no session file loaded | `absent` |
| session in cooldown when the probe ran | `cooling` (status unchanged otherwise, not a failure) |
| resolver returned `metadataAvailable:true` (session used and reported `ok`, or anonymous path sufficed) | `healthy` |
| session reported `login` or `denied` | `expired` |
| any other failure (`ratelimited`, parse failure, network) | `failing`; becomes `expired` after 2 consecutive failing probes |

**Persistence.** New table `social_session_probes(site TEXT PRIMARY KEY, status TEXT, reason TEXT,
checked_at INTEGER, ok_at INTEGER, failures INTEGER, notified_at INTEGER)`; append-only
migration.

**Alert.** When a site transitions into `expired` (from any other status), push a notification to
the admin's paired devices — at most one per site per 12 hours (`notified_at`). The body names
the site and the action, never a cookie value:
`"FoundKeep: the Reddit session expired. Replace reddit.txt to keep saving Reddit posts."`
Recovery is silent: a site returning to `healthy` clears `notified_at` so the next expiry alerts
again. Admin recipients are the accounts whose email is in `FOUNDKEEP_ADMIN_EMAILS`, via their
`customer_push_devices` rows. No email channel exists yet, so push is the only channel.

**Probe cost and safety.** One request per platform per 6 hours, through the same guarded
`PublicReader` and the same breaker/spacing as a real save. A probe never writes to a user's
library: it calls the resolver only and discards the manifest. Probes are skipped entirely for
sites with no session file, so an operator who supplies nothing pays nothing and sees `absent`.

## Components

**1. `customer-social-sessions.ts` — observable outcomes**

`session(site)` currently swallows the outcome. Add an optional observer so a caller can learn
what a resolver reported without changing resolver code:
`createSessionStore({ onOutcome?: (site, outcome) => void })`, called from `report()`. The probe
installs its own store-level observer for the duration of one probe; production callers pass
nothing and are unaffected.

**2. `customer-session-health.ts` (new) — the probe service**

* `DEFAULT_PROBE_TARGETS: Record<string, string>` — one public permalink per site, chosen from
  URLs verified live on 2026-09-19/20 (Reddit, Instagram, LinkedIn, X, Bluesky, YouTube).
* `loadProbeTargets(directory)` — merges `probes.json` over the defaults; ignores malformed
  entries and any URL `socialPost()` rejects.
* `createSessionHealthService(db, { sessions, resolve, notify, now, targets })` with
  `tick()` (runs a full pass if due) and `statuses()` (read model for the API).
* Status transitions exactly as the table above; `failures` counts consecutive non-terminal
  failures and resets on `healthy`.

**3. `customer-notifications.ts` — operator alert**

`deliverOperatorAlert(db, { title, body }, fetcher?)` — resolves admin accounts from
`FOUNDKEEP_ADMIN_EMAILS`, reuses the existing Expo push delivery and the same
`DeviceNotRegistered` pruning. Content-free of secrets by construction: callers pass a fixed
sentence naming a site.

**4. `admin-console.ts` — read model**

`GET /admin/social-sessions` → `{ sites: [{ site, status, reason, checkedAt, okAt, failures }] }`,
merging loaded-session names with stored probe rows so a site with a session but no probe yet
reads `pending`. Admin-gated like every other `/admin/*` route. Never returns cookie values,
file paths or response bodies.

**5. `apps/site/app/console/sessions/page.tsx` — the card**

A table: site, status pill, last checked, last healthy, and the reason for a non-healthy status.
Copy is operator-facing and tells them what to do (`Replace instagram.txt in
~/.config/foundkeep/social-sessions/`). Linked from the console nav as "Sessions".

**6. `index.ts` — wiring**

`createSessionHealthService(db)` plus a 10-minute timer calling `tick()` (the service decides
whether a 6-hour pass is due), `unref()`ed like the others.

## Error handling

A probe failure is data, not an exception: every path records a status and returns. The service
never throws into the timer. A missing/blocked target URL records `failing` with the reason, and
the operator can override it in `probes.json`.

## Security

* No cookie value, cookie file content, or authenticated response body is logged, stored in the
  probe row, returned by the API, or placed in a notification.
* `probes.json` is operator-controlled input: each URL must pass `socialPost()` (which
  allow-lists hosts) before use.
* The probe uses the ordinary resolver path, so every existing guard (pinned DNS, public
  addresses, per-hop cookie scoping, breaker, spacing) applies unchanged.

## Testing

* Store: `onOutcome` fires with the reported outcome and does not alter breaker behaviour.
* Service: each row of the status table; two consecutive failures escalate to `expired`; a
  `healthy` result resets `failures` and `notified_at`; the 12-hour alert throttle; `absent`
  sites are never probed; `probes.json` overrides and rejects bad URLs; `tick()` is a no-op
  before the interval elapses.
* Notifications: admin recipients resolved from the env allowlist; no secret in the body.
* Admin route: admin-gated; merges loaded sites with probe rows; `pending` for unprobed.
* Site: typecheck only (the console has no test suite).

## Out of scope

Email alerts (no sender configured), per-user sessions, automatic cookie refresh, and a
self-service re-upload UI — the operator still replaces files over `scp`.
