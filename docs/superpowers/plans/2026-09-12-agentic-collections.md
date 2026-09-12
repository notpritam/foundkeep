# Agentic Collections Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement these independently verifiable stages inline. The user has approved the scope and execution.

**Goal:** Import existing bookmarks, manage the collection beside the browser, and offer both customer-connected agents and a USD 5/month hosted processing plan.

**Architecture:** Extend the existing account-scoped Bun/Hono/SQLite customer backend with focused import, processing, MCP, and billing modules. Keep the extension's credentials in its service worker and package its new library UI locally. Preserve existing capture APIs. RevenueCat adds a native dependency and therefore requires a new fingerprint runtime and binary.

**Tech Stack:** Bun, Hono, SQLite, TypeScript, native Manifest V3 JavaScript/CSS, Next.js customer settings, Expo, RevenueCat native purchases and account APIs.

**Spec:** `docs/superpowers/specs/2026-09-12-agentic-collections-design.md`.

## Global constraints

- One private library per authenticated customer; preserve original content, manual organization, and legacy clients.
- Existing captures and credentials survive additive migrations. Import does not write browser bookmarks.
- No remote executable extension code or frontend provider secrets. RevenueCat uses its intended public SDK identifier; all privileged keys remain server-side.
- Free supports import/MCP; Pro is USD 5/month with enforced hosted-processing allowances.
- Existing published mobile version stays 1.0.0. A new Chrome package needs a monotonically increasing Store version.

## 1. Bookmark import

Files: `apps/extension/src/bookmark-import.js`, `apps/backend/src/customer-imports.ts`, `apps/backend/src/customer-organization.ts`, `apps/backend/src/db.ts`, `apps/backend/src/customer.ts`, `tests/bookmark-import.mjs`, `apps/backend/test/customer-imports.test.ts`.

Interfaces: `parseBookmarkHtml(html) -> {entries,warnings}`, `flattenBookmarkTree(nodes) -> {entries,warnings}`; entries contain `{url,title,folderPath,addedAt?,description?,tags?,sourceId?}`. `POST /api/imports/preview` accepts `{source,entries}`; `POST /api/imports` accepts `{source,importId,chunk,entries}` and returns `{imported,duplicates,skipped,folders,complete}` for that immutable chunk. Existing account authentication and request limits wrap both routes.

- [x] Test nested exports/tree nodes, Unicode entities, unsafe URLs, original dates, malformed input, and bounds.
- [x] Test account boundaries, replay and changed-payload conflict, existing-save deduplication, folder paths, and quota rollback.
- [x] Implement parser, migration, account-scoped import transactions, and optional-permission import UI with durable chunk progress.
- [ ] Run `node --test tests/bookmark-import.mjs` and `bun test apps/backend/test/customer-imports.test.ts`; inspect a real packaged extension import.
- [x] Commit the integrated release after cross-client verification.

## 2. Sidebar and popup

Files: `apps/extension/src/library.html`, `library.js`, `library.css`, `library-api.js`, existing `cloud.js`, `background.js`, `popup.*`, manifest and package allowlists.

Interfaces: allowlisted `library-*` messages proxy typed collection, organization, preview, import, and edit operations through the current connection. Every response rechecks connection identity. Sidebar opening consumes a direct extension user gesture and falls back to the packaged library tab when unsupported.

- [ ] Verify signed-in/sidebar, local-only, reconnect, import-preview/progress/retry, folder/tag navigation, search/pagination, saved-current-page, and editing states.
- [x] Implement the compact sidebar and quick-save popup using existing Foundkeep fonts/tokens, source labels, restrained motion, and keyboard controls.
- [x] Test spoofed senders, path injection, account switches during requests, denied permission, and popup-height constraints.
- [ ] Inspect light/dark sidebar at 320/400/600 px and popup at Chromium's height limit; build both extension distribution archives.
- [x] Include the extension in the integrated release commit.

## 3. Hosted processing

Files: new `customer-plans.ts`, `customer-processing.ts`, `customer-ai.ts`, `customer-media.ts`; existing worker, capture routes, preferences, preview transport and tests.

Interfaces: `enqueueProcessing(accountId,captureId,reason)`; lease-based queue; structured `{summary,category,tags,relatedIds}` model output; usage reservation keyed to job/cycle; source revision guard before applying results. `GET/PUT /api/automation` and `POST /api/captures/:id/process` expose controls and manual requests.

- [x] Test idempotent enqueue, lease recovery, limits, cancellation/account deletion, malformed model output, manual-edit races, and failures without data loss.
- [x] Implement the server-only OpenAI Responses adapter, account controls, usage/activity, and worker integration.
- [x] Add bounded webpage/social extraction and non-destructive supported media derivatives with public-network and native-process tests.
- [ ] Verify provider requests using fake transports, then perform a small real call when the secure operator key is supplied.
- [x] Include processing in the integrated release commit.

## 4. Customer MCP

Files: new `customer-mcp.ts`, `customer-agent-access.ts`, `customer-changes.ts`; Next dashboard connection settings and a documented sample client.

Interfaces: scoped revocable agent tokens, `/api/mcp` JSON-RPC tools/resources, monotonic account change cursor, revision-guarded organization, and persisted nudge requests. File resources use the same owned capture data paths.

- [x] Test initialization/tool discovery, read-only/write grants, other-account IDs, expired/revoked tokens, change pagination/deletions, file bounds, and stale edit conflicts.
- [x] Implement account connection UI with one-time token display, copyable MCP configuration, change-driven runner instructions, activity, and revocation.
- [x] Exercise the endpoint with a real MCP client against an isolated account.
- [x] Include MCP in the integrated release commit.

## 5. Pro billing and release

Files: new `customer-billing.ts`, plan settings/UI, webhook migration, operator setup scripts, privacy/support/pricing copy, store release documentation.

Interfaces: server checkout/portal sessions; signed webhook event ingestion with event-ID deduplication and authoritative subscription status; `GET /api/plan` exposes entitlements and remaining allowances.

- [x] Test signed/unsigned and replayed webhooks, out-of-order subscription updates, customer mapping, cancellation, failed payments, and client-selected price/redirect rejection.
- [x] Implement USD 5/month checkout, portal, plan controls and honest unavailable states without configured keys.
- [x] Complete web/extension checks, migration backup/upgrade checks, production packaging and account-safe deployment; native build is tracked below.
- [x] Prepare the required Chrome Store update and submission kit; document external account/credential blockers.

## RevenueCat addition and release checkpoint

- [x] Implement native offering/purchase/restore with explicit opaque identity and server verification.
- [x] Use authoritative provider refresh, authenticated webhooks, and periodic reconciliation; shared Pro across web/iPhone/extension.
- [x] Coordinate web checkout and native purchase/restore attempts with account-owned, individually cancellable reservations.
- [x] Test billing state/ownership, provider failures, retries, cancellation, stale observations, and purchase concurrency.
- [x] Build the production Next site; verify web/backend/mobile TypeScript; inspect desktop/phone account controls.
- [x] Back up production schema 14 and trial schema 23; original account/capture/session/connection rows remain byte-identical. The backup already contains one orphan connection FK; the migration introduces none.
- [x] Finish installed-extension import smoke and package final archives.
- [x] Deploy the reviewed backend/site and verify the live domain.
- [ ] Build and upload a fresh native binary using personal Expo owner notpritam.
- [ ] Configure OpenAI, Stripe and RevenueCat/Apple products, then run real provider/sandbox purchases. These keys/products are not supplied yet.

Verified before integration: 181 backend tests, 59 extension tests, 60 mobile tests; installed Chromium capture/import flow and account-control browser flow; backend/site/mobile TypeScript; production Next build. Code review closed all reported important findings. Real optional permission grant and StoreKit sandbox payment remain device/provider checks.
