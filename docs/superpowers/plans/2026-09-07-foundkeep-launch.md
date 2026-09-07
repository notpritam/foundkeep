# Foundkeep Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the shipped Atlas customer product as Foundkeep at `foundkeep.app` without changing extension identity, losing customer data, or breaking version 1.5 clients.

**Architecture:** Keep compatibility-sensitive Atlas storage, API, header, environment, and release identifiers internal. Add an exact multi-origin boundary to the backend and extension, then replace customer-visible identity and build Foundkeep-named release aliases around the stable legacy update path.

**Tech Stack:** Bun, TypeScript, Hono, SQLite, Chromium MV3, vanilla HTML/CSS/JavaScript, Node test runner, Playwright, Caddy, systemd, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-07-foundkeep-launch-design.md`

## Global Constraints

- Preserve extension ID `mjfcgmboaijfcaanepdipbgmipnccnpn` and all existing local/cloud records.
- Primary origin is `https://foundkeep.app`; legacy origin is `https://atlas.notpritam.in`.
- Retain compatibility identifiers named in the spec.
- Customer surfaces use Foundkeep; customer flows do not introduce agent setup.
- Keep version 1.5 operational until version 1.6 is live and verified.

---

### Task 1: Exact dual-origin customer boundary

**Files:**
- Modify: `apps/backend/src/config.ts`
- Modify: `apps/backend/src/customer.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/test/customer.test.ts`

**Interfaces:**
- Produces: `config.customerOrigins: string[]` ordered with the primary origin first.
- Preserves: `config.customerOrigin: string` as the primary-origin compatibility accessor.

- [ ] **Step 1: Write failing backend tests**

Add requests from `https://foundkeep.app`, `https://atlas.notpritam.in`, and a lookalike origin. Assert both exact product origins receive credentialed CORS and can mutate with a valid cookie, while the lookalike receives `403 invalid_origin`.

- [ ] **Step 2: Run the focused backend test**

Run: `PATH=/home/pritam/.bun/bin:$PATH bun test apps/backend/test/customer.test.ts`

Expected: the legacy-origin compatibility assertion fails against the existing single-origin implementation.

- [ ] **Step 3: Implement ordered origin parsing**

Read `ATLAS_CUSTOMER_ORIGINS` as a comma-separated list when present, fall back to the singular `ATLAS_CUSTOMER_ORIGIN` for test and existing deployment compatibility, and otherwise use `https://foundkeep.app,https://atlas.notpritam.in`. Validate values as exact HTTP(S) origins without paths, credentials, query strings, or fragments.

- [ ] **Step 4: Use exact origin membership throughout customer routes**

Set website credential headers for either configured website origin, keep extension origins separate, and preserve the host-only session cookie name and account-intent header.

- [ ] **Step 5: Run backend tests**

Run: `PATH=/home/pritam/.bun/bin:$PATH bun test`

Expected: 0 failures.

### Task 2: Foundkeep extension identity and migration

**Files:**
- Modify: `apps/extension/manifest.json`
- Modify: `apps/extension/src/cloud.js`
- Modify: `apps/extension/src/preferences.js`
- Modify: `apps/extension/src/background.js`
- Modify: `apps/extension/src/popup.html`
- Modify: `apps/extension/src/popup.js`
- Modify: `apps/extension/src/cloud-ui.js`
- Modify: `apps/extension/src/dashboard.html`
- Modify: `apps/extension/src/dashboard.js`
- Modify: `apps/extension/src/connections.js`
- Modify: `apps/extension/src/twitter.js`
- Modify: `apps/extension/README.md`
- Modify: `apps/extension/assets/mark.svg`
- Modify: `apps/extension/icons/mark.svg`
- Replace: `apps/extension/icons/icon16.png`
- Replace: `apps/extension/icons/icon32.png`
- Replace: `apps/extension/icons/icon48.png`
- Replace: `apps/extension/icons/icon128.png`
- Modify: `tests/extension-cloud.mjs`
- Modify: `tests/extension-ui.mjs`
- Modify: `tests/extension-smoke.mjs`

**Interfaces:**
- Produces: `CUSTOMER_ORIGIN = "https://foundkeep.app"` and `CUSTOMER_ORIGINS` containing both exact product origins.
- Preserves: manifest key, internal message kinds, storage keys, database name/version, and update URL continuity.

- [ ] **Step 1: Write failing extension brand and origin tests**

Assert the manifest name, action title, commands, visible popup/library copy, and external matches use Foundkeep. Assert the pairing sender accepts both exact origins and rejects scheme, port, nested-frame, extension-sender, and lookalike variations.

- [ ] **Step 2: Run the focused extension tests**

Run: `PATH=/home/pritam/.nvm/versions/node/v24.20.0/bin:$PATH node --test tests/extension-cloud.mjs tests/extension-ui.mjs tests/extension-smoke.mjs`

Expected: Foundkeep brand and primary-origin assertions fail.

- [ ] **Step 3: Implement the extension migration**

Use Foundkeep for all visible strings and new cloud requests. Keep the existing `atlas*` storage/message/database identifiers. Add both exact origins to `externally_connectable` and sender validation. Bump the manifest to `1.6.0` only when packaging begins.

- [ ] **Step 4: Install deterministic Foundkeep marks**

Create one SVG source using the dark rounded frame, warm paper bookmark, and vermilion origin point. Export exact 16, 32, 48, and 128px PNGs through headless Chromium and verify each file's dimensions.

- [ ] **Step 5: Run the extension suite**

Run: `PATH=/home/pritam/.bun/bin:/home/pritam/.nvm/versions/node/v24.20.0/bin:$PATH bun run test:extension`

Expected: 0 failures.

### Task 3: Foundkeep website and customer dashboard

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/auth.html`
- Modify: `apps/web/auth.js`
- Modify: `apps/web/dashboard.html`
- Modify: `apps/web/dashboard.js`
- Modify: `apps/web/customer.js`
- Modify: `apps/web/privacy.html`
- Modify: `apps/web/redeem.html`
- Modify: `apps/web/app.js`
- Modify: `apps/web/README.md`
- Modify: `apps/web/robots.txt`
- Modify: `apps/web/sitemap.xml`
- Modify: `apps/web/assets/mark.svg`
- Modify: `apps/web/assets/studio-mark.svg`
- Replace: `apps/web/assets/mark-512.png`
- Replace: `apps/web/assets/apple-touch-icon.png`
- Create: `apps/web/assets/foundkeep-social.png`
- Modify: `scripts/prepare-web-assets.mjs`
- Modify: `tests/landing-smoke.mjs`
- Modify: `tests/customer-web.mjs`
- Modify: `tests/customer-flow.mjs`

**Interfaces:**
- Produces: customer routes and metadata canonicalized to `https://foundkeep.app`.
- Preserves: existing relative `/api` behavior and account records.

- [ ] **Step 1: Write failing web identity tests**

Assert Foundkeep titles, navigation, accessibility labels, privacy language, canonical URLs, sitemap URLs, social image, extension download name, and absence of customer-visible Atlas text.

- [ ] **Step 2: Run web tests and verify failure**

Run: `PATH=/home/pritam/.bun/bin:/home/pritam/.nvm/versions/node/v24.20.0/bin:$PATH bun run test:web && bun run test:customer`

Expected: brand and canonical assertions fail before implementation.

- [ ] **Step 3: Rebrand the customer pages**

Apply the Foundkeep name and mark across landing, authentication, recovery, dashboard, dialogs, privacy, download, metadata, and customer errors while retaining the established information architecture and responsive behavior.

- [ ] **Step 4: Regenerate web artwork**

Update the deterministic social-card renderer with Foundkeep's name, mark, tagline, and domain. Produce the social card and icon exports, then verify every referenced image loads.

- [ ] **Step 5: Run web and customer suites**

Run: `PATH=/home/pritam/.bun/bin:/home/pritam/.nvm/versions/node/v24.20.0/bin:$PATH bun run test:web && bun run test:customer`

Expected: 0 failures.

### Task 4: Release, store, and deployment continuity

**Files:**
- Modify: `deploy/release-extension.mjs`
- Modify: `deploy/pack-extension.sh`
- Modify: `deploy/pack-store.sh`
- Modify: `deploy/verify-release.mjs`
- Modify: `deploy/Caddyfile`
- Modify: `deploy/sync-web.sh`
- Modify: `deploy/STORE_LISTING.md`
- Modify: `deploy/CUSTOMER_LAUNCH.md`
- Modify: `deploy/README.md`
- Modify: `.github/workflows/release-extension.yml`
- Modify: `README.md`
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- Create: `BRAND.md`
- Create: `docs/customer-launch-1.6.0.md`

**Interfaces:**
- Produces: `foundkeep-extension.zip`, `foundkeep-extension.crx`, and `foundkeep-store-1.6.0.zip`.
- Preserves: `atlas-extension.zip`, `atlas-extension.crx`, and their stable update URL for installed clients.

- [ ] **Step 1: Write failing release verification assertions**

Require both legacy and Foundkeep-named artifacts to exist, match byte-for-byte where they are aliases, report version `1.6.0`, retain the fixed ID, and contain the Foundkeep manifest and icons.

- [ ] **Step 2: Update packaging and deployment definitions**

Package branded aliases around the stable update artifacts, list both hostnames in Caddy, set production `ATLAS_CUSTOMER_ORIGINS`, update release/store descriptions, and document the one-time cross-domain sign-in.

- [ ] **Step 3: Build unsigned unpacked/store artifacts and verify content**

Run: `bash deploy/pack-extension.sh && bash deploy/pack-store.sh`

Expected: Foundkeep and compatibility ZIPs are present and valid.

- [ ] **Step 4: Run the full pre-release suite**

Run: `PATH=/home/pritam/.bun/bin:/home/pritam/.nvm/versions/node/v24.20.0/bin:$PATH bun test && bun run test:extension && bun run test:web && bun run test:customer`

Expected: 0 failures.

### Task 5: Production launch

**Files:**
- Deploy from: the verified `main` commit
- Update: `/etc/caddy/Caddyfile`
- Update: `/etc/systemd/system/atlas-backend.service.d/foundkeep-origin.conf`
- Publish: GitHub release `ext-v1.6.0`

**Interfaces:**
- Produces: live Foundkeep website/API and signed extension 1.6.
- Preserves: legacy hostname, database, service paths, installed-client update path, and extension ID.

- [ ] **Step 1: Register and delegate `foundkeep.app`**

Confirm the registrar transaction explicitly before spending money. Point apex `A`/`AAAA` records at the existing production host or delegate DNS to the chosen provider.

- [ ] **Step 2: Deploy backend dual-origin support first**

Create a mode-0600 SQLite backup, run `PRAGMA integrity_check`, fast-forward production, install the systemd origin override, restart the backend, and verify both origin policies.

- [ ] **Step 3: Activate HTTPS and verify the new site**

Install the two-host Caddy block, validate configuration, reload Caddy, and verify valid TLS plus `/healthz`, `/signup`, `/login`, `/dashboard`, `/privacy.html`, downloads, canonical metadata, and security headers on `foundkeep.app`.

- [ ] **Step 4: Publish signed extension 1.6**

Build with the existing signing key, verify CRX signature/ID/version/content, push the reviewed commit, wait for CI, and publish/verify release assets under both names.

- [ ] **Step 5: Run live end-to-end verification**

Create a disposable account, pair the packaged extension, change preferences, save a readable bookmark/highlight/screenshot/note, verify provenance in the dashboard, export, revoke, delete the account, and confirm the old hostname and version 1.5 update path still respond.

