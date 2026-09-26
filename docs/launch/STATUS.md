# FoundKeep — launch tracker

> Generated from `roadmap.json` by `node scripts/launch-dashboard.mjs` — edit the JSON, not this file.

**Goal:** Take FoundKeep from friends beta to a public launch: strangers can find it in the Chrome Web Store, App Store and Google Play, sign up safely, pay $5/month on web or iOS, and we find out about failures before they do.

**Launch readiness: 10%** — 7 of 73 launch items done · 19 waiting on Pritam · updated 2026-09-26

**Production (2026-09-26 16:57 UTC):** 21 accounts (0 new in 7d) · 2 active in 7d · 146 saves (63 in 7d) · 0 paying · 0 open tickets

**Everything Pritam asked for (verified 2026-09-26):** 194 asks — 135 live · 37 partial · 3 dev-only · 5 not built · 6 parked · 8 superseded. The open ones are the ★ items below; full list in `~/.local/share/foundkeep-launch/ASKS.md` (private).

| Phase | Progress | Done | In progress | To do | Blocked |
|---|---|---|---|---|---|
| P0 Clean house | 78% | 7 | 0 | 2 | 0 |
| P1 Safety net | 0% | 0 | 0 | 8 | 0 |
| P2 Open signups safely | 0% | 0 | 0 | 9 | 0 |
| P3 Accounts, email & legal | 0% | 0 | 0 | 9 | 0 |
| P4 Monetization | 0% | 0 | 0 | 8 | 0 |
| P5 Product gaps | 0% | 0 | 1 | 14 | 0 |
| P6 Store launch | 0% | 0 | 0 | 9 | 0 |
| P7 Launch | 0% | 0 | 1 | 5 | 0 |
| L Later (asked) _(post-launch)_ | 0% | 0 | 0 | 18 | 1 |

## P0 · Clean house

One branch, one plan, one place to track it.

_Exit criteria:_ main is the only branch; every ask and backlog item is triaged into this tracker.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ✓ Done | Merge feat/session-health-and-youtube into main and work from main | repo | agent | main @ d8e4f44, pushed. |
| ✓ Done | Prune merged branches and idle worktrees | repo | agent | 22 local + 6 remote merged branches and 3 idle design worktrees removed; SHAs kept privately. |
| ✓ Done | Recover uncommitted Sep 10 auth docs from the old atlas checkout | repo | agent | Committed to main as d8e4f44. |
| ✓ Done | Extract every FoundKeep ask from the bb threads and verify each against code | planning | agent | 538 messages → 194 FoundKeep asks: 135 live, 37 partial, 3 dev-only, 5 not built, 6 parked, 8 superseded. Full list: ~/.local/share/foundkeep-launch/ASKS.md. |
| ✓ Done | Production-readiness audit | planning | agent | 49 checks, 18 launch blockers. Details (private): ~/.local/share/foundkeep-launch/readiness.json. |
| ✓ Done | Launch tracker: roadmap.json + dashboard | planning | agent | Edit roadmap.json, then run `/usr/bin/node scripts/launch-dashboard.mjs`. |
| ✓ Done | Triage the Tracker backlog into this plan | planning | agent | Shipped tasks closed, superseded ones archived; one Tracker initiative now points here. |
| ○ To do | Retire atlas-enrich and atlas-bridge, then move ~/personal/apps/atlas to main | ops | agent | Both units run from the stale feat/foundkeep-gallery checkout; atlas-enrich still holds a write connection to the prod database. |
| ○ To do | ★ Remove legacy Atlas code and the unused /agent relay | backend | agent | apps/agent, apps/browser-mcp, apps/desktop, apps/web, relay.ts. Your 'full pre-launch audit and cleanup' ask. |

## P1 · Safety net

We can recover any data and hear about failures before users do.

_Exit criteria:_ Nightly verified off-site backup with a tested restore, server errors logged and alerted, uptime alerts, CI on every push.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ○ To do | Automated nightly prod backups with off-site copy and a restore drill | ops | agent | No timer exists; the last snapshot was a manual pre-deploy one on the same disk. Needs an off-site bucket from Pritam. |
| ○ To do | Log unexpected server errors and add error monitoring | ops | agent | 500s are currently returned without being logged. |
| ○ To do | External uptime checks and alerting (site, API, processing queue) | ops | **Pritam** | Pick the alert channel (push, email, Slack); an agent wires the checks. |
| ○ To do | CI for backend, site and mobile on every push | ops | agent | Today CI only covers extension paths and iOS. Backend 481/481 and mobile 105/105 pass locally. |
| ○ To do | Scripted release and rollback with a health gate and automatic backup | ops | agent | Deploys are manual drop-in swaps; prune old release dirs. |
| ○ To do | Fix the timing-out extension destination test | extension | agent | tests/extension-destination.mjs times out at 30s. |
| ○ To do | Explicit log retention and structured request logs | ops | agent |  |
| ○ To do | ★ Run the Android Maestro flows on an emulator or CI | mobile | agent | 11 flows committed (ac9ddda), never executed. |

## P2 · Open signups safely

Strangers can sign up without breaking the service or each other.

_Exit criteria:_ Limits sized for 1,000 users and the hardening items in the private audit closed.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ○ To do | Raise the service-wide save and storage caps for launch | backend | agent | Size service-wide limits and disk for launch traffic. |
| ○ To do | Signup and sign-in rate limiting review, plus captcha on signup | security | agent | Details in the private audit. |
| ○ To do | Origin hardening behind the CDN | security | **Pritam** | Details in the private audit. |
| ○ To do | Complete agent-access revocation | security | agent | Details in the private audit. |
| ○ To do | Admin console hardening | security | agent | Details in the private audit. |
| ○ To do | MCP OAuth consent and registration hardening | security | agent |  |
| ○ To do | Sign-in abuse hardening | security | agent |  |
| ○ To do | Hard spend cap on the AI provider, and a 'daily budget reached' message | ops | **Pritam** |  |
| ○ To do | Separate dev and prod mobile app identities | mobile | agent | A dev build currently replaces the production app on the same phone. |

## P3 · Accounts, email & legal

Accounts are verifiable and recoverable, and the legal pages match the product.

_Exit criteria:_ Verified email, reset by email, privacy/terms/refund pages that satisfy Paddle, Apple and Google.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ○ To do | Transactional email provider and sender domain (SPF/DKIM) | accounts | **Pritam** | Nothing sends email today. Pick a provider and add its DNS records. |
| ○ To do | Email verification and email password reset | accounts | agent | Needs P3.1. Reset is recovery-code only today. |
| ○ To do | Complete the privacy policy (controller, GDPR rights, all processors) | legal | **Pritam** | An agent drafts; you decide the legal entity and address. |
| ○ To do | Fix the Terms and add a refund policy that names Paddle | legal | **Pritam** | Terms still say captures are never published, but public collections are live. |
| ○ To do | Report/takedown flow and DMCA contact for public collections | collections | agent |  |
| ○ To do | ★ Public account-deletion instructions page | legal | agent | Required by the Play listing. |
| ○ To do | Support tickets notify you and can be replied to | support | agent | The form promises an email follow-up; tickets only land in the database. |
| ○ To do | Verify Sign in with Apple end to end on a physical iPhone | accounts | **Pritam** |  |
| ○ To do | Complete the data export (files, collections) | accounts | agent |  |

## P4 · Monetization

A stranger can pay $5 on web or iOS and get Pro; friends keep what they have.

_Exit criteria:_ A live purchase verified on web and iOS, and the global beta-Pro flag turned off.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ○ To do | ★ Define Free vs Pro and enforce it; make the pricing copy match | billing | agent | Today Free and Pro differ only in storage, and Free gets AI processing. |
| ○ To do | ★ Beta-Pro switch-off: per-account grants for friends and reviewers, grace period, notice | billing | agent | Purchases are blocked while the global flag is on. |
| ○ To do | ★ Paddle live: seller verification, domain approval, live catalog and webhook | billing | **Pritam** |  |
| ○ To do | Paddle production fixes, then rebuild the site with the live client token | billing | agent | API base defaults to sandbox; past_due handling. |
| ○ To do | ★ RevenueCat for iOS: Paid Apps agreement, project, entitlement, offering, webhook | billing | **Pritam** | The app shows 'Subscription unavailable' in prod. |
| ○ To do | Hide the web upgrade path inside the iOS app | mobile | agent | App Store guideline 3.1.1. |
| ○ To do | Decide Android monetization: Play Billing or free-only | billing | **Pritam** |  |
| ○ To do | A real /pricing page | site | agent | /pricing is a 404 today. |

## P5 · Product gaps

Close the asks that make the first week feel finished.

_Exit criteria:_ Every ★ item marked for launch is live in prod and in the shipped apps.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ◐ In progress | ★ Promote archive to prod and publish the mobile update | backend | agent | Live on dev.foundkeep.app (schema 33); prod is schema 32. |
| ○ To do | ★ Guided first run after signup: install the extension or app, make a first save | onboarding | agent | New users land on an empty library that says 'Write a first note'. |
| ○ To do | ★ Send the onboarding email sequence | onboarding | agent | Templates exist in emails/onboarding; needs P3.1. |
| ○ To do | ★ Web: browse and filter by folder, edit tags | web | agent | The extension and app can do this; the landing page advertises folders. |
| ○ To do | ★ Web: open a save in a side drawer, not a blocking modal | web | agent |  |
| ○ To do | ★ Remove leftover blue and audit contrast on every screen | design | agent |  |
| ○ To do | ★ Mobile palette: near-black and emerald, matching web | mobile | agent | The app still uses the azure palette. |
| ○ To do | ★ Extension save sheet: tag a person and highlight | extension | agent |  |
| ○ To do | ★ Landing navigation at tablet widths (541–800px) | site | agent |  |
| ○ To do | ★ Social capture gaps: TikTok, Threads and Facebook video, HLS/DASH, files over 50 MiB, YouTube session | capture | agent |  |
| ○ To do | ★ Verify push notifications end to end (APNs key; FCM for Android) | mobile | **Pritam** |  |
| ○ To do | Product analytics: signup → pairing → first save → retention | ops | agent |  |
| ○ To do | ★ Admin console: real uptime, actual spend, social-session status | admin | agent |  |
| ○ To do | ★ Publish launch public collections so Explore isn't empty | collections | **Pritam** | Prod has 0 public collections. |
| ○ To do | ★ Update public copy: versions, 'private beta' wording, beta page build number | site | agent |  |

## P6 · Store launch

FoundKeep is installable from all three stores.

_Exit criteria:_ Chrome Web Store on the current build, App Store approved, Google Play in production.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ○ To do | ★ Start the Google Play closed test: 12+ testers for 14 days | stores | **Pritam** | Start first: the 14-day clock gates Play production access. |
| ○ To do | ★ Android build with the preserved-post view for friends (APK and Play testing) | mobile | agent | Android build 6 predates it. Needs the Mac. |
| ○ To do | ★ Build the Chrome Web Store 1.0.3 kit from 1.7.12 | stores | agent | Store is on 1.0.2 (built from 1.7.11). |
| ○ To do | ★ Submit CWS 1.0.3, and fix the listing text, support URL and developer email | stores | **Pritam** | The listing still points to GitHub issues and shows an unrelated developer email. |
| ○ To do | ★ Keep the direct extension ZIP in sync with the latest release | extension | agent | Site serves 1.7.11. |
| ○ To do | Refresh store assets: CWS, App Store screenshots, Play graphics | stores | agent |  |
| ○ To do | Play listing, Data safety, first AAB upload, Play signing fingerprint for App Links | stores | **Pritam** |  |
| ○ To do | ★ Submit to the App Store: current build with IAP, App Privacy, contact phone, review notes | stores | **Pritam** | Needs P4.5 and P4.6. |
| ○ To do | ★ Give the Play service account release permissions | stores | **Pritam** | Its last API call got a 403. |

## P7 · Launch

People hear about it and we learn from them.

_Exit criteria:_ Launch posts out and the first 100 non-friend signups.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ○ To do | Landing polish pass, with pricing copy that matches reality | site | agent |  |
| ◐ In progress | ★ More help articles from your usage ideas, with screenshots on every page | site | agent | help.foundkeep.app is live with 4 posts and 5 use cases; 3 pages lack screenshots. |
| ○ To do | Launch video and demo | marketing | agent |  |
| ○ To do | ★ VC demo: saved-company watchlist with a daily agent report | marketing | agent |  |
| ○ To do | Launch posts: Product Hunt, X, Hacker News, blog | marketing | **Pritam** |  |
| ○ To do | ★ Customer discovery calls (goal 100–200) | marketing | **Pritam** |  |

## L · Later (asked)

Asked for, deliberately after launch.

| | Item | Area | Owner | Note |
|---|---|---|---|---|
| ○ To do | ★ Sell collections with a 15% commission | collections | agent | Spec exists (2026-09-15). |
| ○ To do | ★ Save and autofill form data from the extension | extension | agent |  |
| ○ To do | ★ Firefox, Safari and Edge Add-ons builds | extension | agent |  |
| ○ To do | ★ GitHub and X sign-in | accounts | agent |  |
| ○ To do | ★ Merge saves with the same source URL, plus manual and agent linking | backend | agent |  |
| ○ To do | ★ Merge overlapping articles and blogs | backend | agent |  |
| ○ To do | ★ Agent-scheduled daily library cleanup | agents | agent |  |
| ○ To do | ★ To-dos and reminders with notifications, usable by agents | agents | agent |  |
| ○ To do | ★ Privacy stance on operator access, then end-to-end encryption | security | **Pritam** |  |
| ○ To do | ★ Desktop capture dock (Electron) on FoundKeep accounts | desktop | agent |  |
| ○ To do | ★ Upload images from the web dashboard | web | agent |  |
| ○ To do | ★ No hard reloads anywhere in the web app | web | agent |  |
| ○ To do | ★ Linear-style list layout for the library | web | agent |  |
| ○ To do | ★ Extension force-update | extension | agent |  |
| ○ To do | ★ Speech-to-text for uncaptioned videos, and video compression | capture | agent |  |
| ○ To do | ★ Continuous bookmark sync (import is one-shot today) | extension | agent |  |
| ○ To do | ★ Open-source license decision | repo | **Pritam** |  |
| ○ To do | Rotate the Apple sign-in secret before 2027-03-09 | accounts | **Pritam** |  |
| ■ Blocked | ★ Browser agent control through the extension (parked 2026-09-06) | agents | **Pritam** | You said 'lets not focus on agent part'; code was stripped from the store build. |

★ = asked for by Pritam in a FoundKeep thread.
