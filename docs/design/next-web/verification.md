# Customer web verification — 10 September 2026

## Implemented

- Real React/Next pages with pre-rendered landing/support/privacy/terms, request-scoped server authentication, and clean route redirects that retain query parameters.
- Full-viewport auth, bottom footer, provider/recovery/account-linking flows, and server redirects for ordinary signed-in auth visits.
- Account-scoped TanStack Query data, compact search/new-note/refresh toolbar, nonmodal capture sidebar, dedicated saved-item reader and URL-based filters/history.
- Stored screenshot/file previews and an authenticated article-image endpoint with source ownership, DNS/IP/redirect validation, pinned TLS transport, byte/time/concurrency limits and no credential forwarding.
- Two-slot visible-image queue, loading shimmer, reduced-motion alternatives, failed-image retry and no-JavaScript stored-image fallback.
- Three optimized scenic images, Motion section/card/reader transitions, native smooth scrolling, simpler hero actions and prompt extension detection.
- Independent security and visual review corrected public-to-private CSP navigation, stale export completion after leaving the dashboard, and server query timer retention.

## Verified before deployment

| Check | Result |
| --- | --- |
| Optimized Next build and site TypeScript | Passed |
| Bun backend suites | 185 passed, 0 failed; 1,643 assertions |
| Existing customer web and landing regressions | 42 passed |
| Auth UI/OAuth/CSP fixtures | 10 passed |
| Deferred export after dashboard exit and account switch | Passed; both test accounts deleted |
| Server-rendered guards, private cache headers, account isolation and expiry | 4 passed |
| Dashboard workflow/responsive/preview scenarios | 12 passed; test account deleted |
| Real unpacked extension with Next signup/pairing/article/highlight/screenshot | Passed; test account deleted |
| Relocated standalone package | Starts and serves outside the source checkout |
| Backend outage | Auth retry retained; private library fails without false sign-out redirect |
| Landing production browser review | Passed at 1440, 768, 390 and 320px |

Mutating verification used an isolated database, browser profiles and synthetic captures. Production customers were not used for these tests. Initial failures identified and fixed the CSP document boundary, stale mutation completion and a deployment trace missing hoisted React peers. Repeated account suites hit the disposable backend's intentional rate limiter; it was restarted before the final successful run. The resize visual check now waits for its asynchronous React state update.

## Build output

Static: `/`, `/privacy`, `/support`, `/terms`, `/robots.txt`, `/sitemap.xml` and not-found. Dynamic: `/auth`, `/login`, `/signup`, `/recover`, `/open`, `/dashboard`, `/dashboard/saved/[id]`.

The measured landing script assets total approximately 145kB gzip for modern browsers, plus a roughly39kB legacy `nomodule` polyfill. Public pages have static cache headers; private pages and captures use `no-store`. Private scripts use request nonces and build assets have SRI attributes. Font and image assets are self-hosted; remote captures do not bypass the authenticated preview endpoint.

No extension/native package version changed. The iPhone call to action remains explicitly a private beta request, matching actual distribution availability.

## Live release

Released commit `085d4f2` on `https://foundkeep.app`. The immutable standalone artifact is `/home/pritam/.local/share/foundkeep-site/releases/085d4f2-20260910`; `foundkeep-site` listens only on127.0.0.1:8791. `atlas-backend` and Caddy remain healthy. Only the Foundkeep Caddy block changed; unrelated hosts were byte-compared before applying.

Live read-only verification passed12page/browser checks across desktop and mobile, with no horizontal overflow, broken images, page exceptions or private-page CSP errors. `/dashboard` redirects to `/login`; legacy `.html` URLs retain query parameters; extension ZIP downloads, customer configuration, health, Apple app association and the Atlas-domain redirect all remain available. See [live results](live-check.json), [landing desktop](live-landing-desktop.png), [landing phone](live-landing-mobile.png), [auth desktop](live-auth-desktop.png) and [auth phone](live-auth-mobile.png).

The before/after production database counts match:4accounts,16captures,4connections,8sessions,1folder. Integrity check passed at schema13. Backup: `/home/pritam/.local/share/foundkeep-site/backups/atlas-before-next-20260910T064815Z.sqlite`. The previous static customer website and Caddy backup are retained for rollback.
