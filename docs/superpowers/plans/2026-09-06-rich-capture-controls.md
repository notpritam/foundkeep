# Rich Capture and Customer Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve readable bookmark content and traceable provenance for every capture, synchronize customer-owned extension preferences across connected browsers, and ship a reliable popup and dashboard controls.

**Architecture:** Add additive SQLite fields and an owner-scoped preference document to the existing customer API. The Manifest V3 extension uses a pure page extractor, a same-account preference cache, and the existing durable local-first outbox. The web dashboard edits account preferences and renders capture provenance; the popup consumes the same normalized preference contract.

**Tech Stack:** Bun, Hono, bun:sqlite, native HTML/CSS/JavaScript, Chrome Manifest V3, IndexedDB, Node test runner, Bun test, Playwright Core.

**Spec:** `docs/superpowers/specs/2026-09-06-rich-capture-controls-design.md`

## Global Constraints

- Customer preferences are account-owned and account-wide; mutation requires a website session.
- Existing local captures are never uploaded without explicit import consent.
- The visited URL is retained even when a canonical URL exists.
- Bookmark capture never stores executable page HTML, form values, cookies, referrers, or history.
- Local captures commit before cloud upload, and account binding never changes on retry.
- Preserve extension identity, IndexedDB database/version, shortcuts, and existing capture records.
- The popup must fit Chrome's 392×600 constrained surface with one scrolling region and a visible footer.
- Existing preference changes work without a new extension; new permissions and executable capabilities require a release.

---

### Task 1: Customer preference contract and storage

**Files:**
- Create: `apps/backend/src/customer-preferences.ts`
- Modify: `apps/backend/src/db.ts`
- Modify: `apps/backend/src/customer.ts`
- Test: `apps/backend/test/customer.test.ts`

**Interfaces:**
- Produces: `DEFAULT_CUSTOMER_PREFERENCES`, `normalizeCustomerPreferences(input)`, `readCustomerPreferences(db, accountId)`, and `writeCustomerPreferences(db, accountId, input)`.
- Produces: `GET /api/preferences` for session/bearer reads and `PUT /api/preferences` for cookie-session writes.

- [ ] **Step 1: Write failing API tests**

Add tests that register two accounts, prove defaults are complete, reject a bearer mutation, reject unknown/invalid fields, persist a session-authenticated update, return it through a second browser credential, and prevent the other account from reading it.

```ts
expect((await request(app, "/api/preferences", ownerCookie)).json.preferences.capture.bookmark).toBe(true);
expect((await request(app, "/api/preferences", browserBearer, { method: "PUT", body: valid })).status).toBe(403);
expect((await request(app, "/api/preferences", ownerCookie, { method: "PUT", body: valid })).json.preferences.popup.recentCount).toBe(5);
```

- [ ] **Step 2: Verify RED**

Run: `/home/pritam/.bun/bin/bun test apps/backend/test/customer.test.ts`

Expected: preference endpoint assertions fail with 404.

- [ ] **Step 3: Add the schema and normalizer**

Add an append-only migration:

```sql
CREATE TABLE customer_preferences (
  account_id TEXT PRIMARY KEY REFERENCES customer_accounts(id) ON DELETE CASCADE,
  value_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
```

Normalize a complete version-1 document with explicit boolean, enum, bounded integer, and action-order validation. Reject unknown keys and duplicate/missing popup action names.

- [ ] **Step 4: Add authenticated routes and verify GREEN**

Return `{preferences, revision, updatedAt}`. Require `auth(c, true)` and existing origin/account-intent protections on PUT. Run the focused test until it passes, then run `/home/pritam/.bun/bin/bun test`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/customer-preferences.ts apps/backend/src/db.ts apps/backend/src/customer.ts apps/backend/test/customer.test.ts
git commit -m "feat(backend): add customer extension preferences"
```

### Task 2: Provenance and processing options in the customer API

**Files:**
- Create: `apps/backend/src/customer-provenance.ts`
- Modify: `apps/backend/src/db.ts`
- Modify: `apps/backend/src/customer.ts`
- Modify: `apps/backend/src/customer-enrichment.ts`
- Test: `apps/backend/test/customer.test.ts`
- Test: `apps/backend/src/customer-enrichment.test.ts`

**Interfaces:**
- Produces: `normalizeProvenance(input, capturedAt)` and `normalizeProcessingOptions(input)`.
- Extends capture DTO with `provenance` and stores `provenance_json`, `processing_options_json`.

- [ ] **Step 1: Write failing provenance tests**

Exercise a full valid object, unsafe URL rejection, bounded authors/headings, invalid dates/hash, quota accounting, tenant-scoped detail/export, and old uploads with no provenance.

```ts
expect(saved.provenance.pageUrl).toBe("https://visited.test/story?from=feed");
expect(saved.provenance.canonicalUrl).toBe("https://visited.test/story");
expect(saved.articleText).toContain("Readable body");
```

Add enrichment tests proving `{ocr:false, summaries:false, tags:false}` skips those derived fields while retaining category and originals.

- [ ] **Step 2: Verify RED**

Run the focused Bun tests and confirm missing DTO/schema behavior causes the failures.

- [ ] **Step 3: Implement bounded validation and additive columns**

Accept only the exact version-1 keys. Normalize safe HTTP(S) URLs, plain text, arrays, dates, method enum, integer timestamps, extractor version, and SHA-256 base64url hashes. Include serialized UTF-8 bytes in storage quota.

- [ ] **Step 4: Honor per-capture processing options**

Read the snapshotted options in the queue and skip OCR, summaries, or tags as requested. Never reinterpret settings changed after capture upload.

- [ ] **Step 5: Verify GREEN and commit**

Run focused tests, then full Bun tests. Commit as `feat(backend): preserve capture provenance`.

### Task 3: Page extraction and local provenance

**Files:**
- Create: `apps/extension/src/page-extractor.js`
- Modify: `apps/extension/src/background.js`
- Modify: `apps/extension/src/db.js`
- Test: `tests/extension-extractor.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `extractPageDocument()` returning `{articleText, provenance, headings}` with no closed-over module state, suitable for `chrome.scripting.executeScript({func})`.
- Produces: `capturePageContext(tab, options)` and `hashReadableText(text)` in the background worker.

- [ ] **Step 1: Write failing extractor fixtures**

Use real Playwright DOM pages for Article JSON-LD, Open Graph, malformed structured data, a non-article page, hidden/navigation text, unsafe canonical URLs, and long content. Assert hand-written metadata and text literals.

```js
assert.equal(result.provenance.pageUrl, "https://news.test/read?id=7");
assert.equal(result.provenance.canonicalUrl, "https://news.test/read");
assert.deepEqual(result.provenance.authors, ["Mina Rao"]);
assert.match(result.articleText, /The actual first paragraph/);
assert.doesNotMatch(result.articleText, /Subscribe now/);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/extension-extractor.mjs`

Expected: module-not-found failure for the extractor.

- [ ] **Step 3: Implement pure extraction**

Collect metadata with precedence: valid Article JSON-LD, Open Graph/article meta, standard meta, then DOM. Score article/main candidates, clone the chosen root, remove unsafe/non-content elements, normalize text/headings, and cap values before returning.

- [ ] **Step 4: Bind provenance to every capture action**

Use the exact active-tab URL as `pageUrl`. Save containing-page context and target URL for link/image actions. Mark extraction fallbacks without rejecting a bookmark. Persist `provenance`, `articleText`, and `headings` in the schemaless IndexedDB record.

- [ ] **Step 5: Verify GREEN and commit**

Run extractor and extension suites. Commit as `feat(extension): capture readable pages and provenance`.

### Task 4: Extension preference client and multi-browser behavior

**Files:**
- Create: `apps/extension/src/preferences.js`
- Modify: `apps/extension/src/cloud.js`
- Modify: `apps/extension/src/background.js`
- Modify: `apps/extension/src/capture.js`
- Modify: `apps/extension/src/twitter.js`
- Test: `tests/extension-preferences.mjs`
- Modify: `tests/extension-cloud.mjs`
- Modify: `tests/extension-smoke.mjs`

**Interfaces:**
- Produces: `getEffectivePreferences({refresh})`, `refreshPreferences()`, `clearPreferenceCache()`, and `reconcileContextMenus(preferences)`.
- `captureBinding()` additionally returns snapshotted `processingOptions` and automatic-upload state.

- [ ] **Step 1: Write failing cache and policy tests**

Prove defaults for local-only users, refresh after pairing, same-account offline cache, no cache reuse after account switch, five-minute refresh, disabled automatic upload, feature/context-menu visibility, and two credentials reading one account preference revision.

- [ ] **Step 2: Verify RED**

Run focused Node tests and confirm the missing preferences module/behavior fails.

- [ ] **Step 3: Implement account-bound caching**

Store only normalized values with account ID, revision, and fetch time. Read through the extension bearer. Fall back to same-account cache or built-ins. Clear active cache during disconnect/switch while preserving records and queues.

- [ ] **Step 4: Apply preferences at behavior boundaries**

Reject disabled capture requests with actionable messages, rebuild context menus from enabled actions, apply note source and bookmark extraction choices, snapshot enrichment options, and leave queued captures bound when automatic upload is off.

- [ ] **Step 5: Improve browser labels**

Pair with a bounded label such as `Chrome · Linux` derived from locally available browser/OS data. Keep one token per connected installation and verify both upload into the same owner library.

- [ ] **Step 6: Verify GREEN and commit**

Run focused and full extension suites. Commit as `feat(extension): sync customer capture preferences`.

### Task 5: Popup layout and capture feedback

**Files:**
- Modify: `apps/extension/src/popup.html`
- Modify: `apps/extension/src/popup.css`
- Modify: `apps/extension/src/popup.js`
- Modify: `apps/extension/src/theme.css`
- Modify: `apps/extension/src/cloud-ui.js`
- Test: `tests/extension-ui.mjs`

**Interfaces:**
- Consumes: normalized preferences and credential-free cloud status messages.
- Produces: one constrained popup surface with deterministic loading, saving, partial-save, offline, and disabled states.

- [ ] **Step 1: Write failing layout and interaction tests**

At 392×600, assert the footer is visible, the main region is the only vertical scroller, long page/account copy has no horizontal overflow, action order/visibility follows preferences, recent count is bounded, focus is visible, and Save page remains open until a response renders.

- [ ] **Step 2: Verify RED**

Run `node --test tests/extension-ui.mjs` and confirm geometry/action assertions fail against the existing popup.

- [ ] **Step 3: Rebuild semantic structure and state rendering**

Use header, main, grouped actions, composer, recent section, and footer. Reserve status geometry. Lead with Save page; use a two-column secondary grid and compact note composer. Return structured capture results from the background instead of closing immediately.

- [ ] **Step 4: Apply the Studio visual system**

Use existing self-hosted Clarity City/Geist, paper/ink/vermilion tokens, 4px spacing rhythm, 6px action radii, visible focus, reduced motion, themed selection/caret/scrollbar, and purposeful press/hover states. Avoid decorative cards around every group.

- [ ] **Step 5: Render inspection and GREEN**

Capture popup states for connected, disconnected, long content, offline, loading, and five recents in one bounded inspection pass. Fix the batch, confirm once, run the Impeccable detector, then run all extension tests.

- [ ] **Step 6: Commit**

Commit as `fix(extension): rebuild the capture popup`.

### Task 6: Dashboard preference controls and provenance details

**Files:**
- Modify: `apps/web/dashboard.html`
- Modify: `apps/web/dashboard.js`
- Modify: `apps/web/customer.css`
- Modify: `tests/customer-web.mjs`
- Modify: `tests/customer-flow.mjs`

**Interfaces:**
- Consumes: `GET/PUT /api/preferences` and capture DTO provenance.
- Produces: grouped customer controls and origin detail rendering.

- [ ] **Step 1: Write failing browser tests**

Assert preferences load from account A, save the complete document, reject stale-account mutation, notify the connected extension, survive network failure without losing selections, and render safe visited/canonical/author/date/source details.

- [ ] **Step 2: Verify RED**

Run customer tests with Bun on PATH and confirm missing controls/origin output cause failures.

- [ ] **Step 3: Implement settings and origin UI**

Add native checkbox/select controls grouped by Capture, Popup, Sync, and Organization. Save explicitly with disabled/loading/success/error states. Render provenance through text nodes and safe anchors only.

- [ ] **Step 4: Verify GREEN and commit**

Run focused customer-web and end-to-end flow tests. Commit as `feat(web): add extension preferences and capture origins`.

### Task 7: Documentation, package, deployment, and live release

**Files:**
- Modify: `apps/extension/manifest.json`
- Modify: `apps/extension/README.md`
- Modify: `apps/web/privacy.html`
- Modify: `apps/web/index.html`
- Modify: `apps/web/customer-config.json`
- Modify: `deploy/STORE_LISTING.md`
- Create: `docs/customer-launch-1.5.0.md`

**Interfaces:**
- Produces: signed extension 1.5.0, synchronized website downloads, deployed backend/web, and release `ext-v1.5.0`.

- [ ] **Step 1: Update truthful product documentation**

Describe readable bookmark extraction, provenance fields, customer preferences, account-wide multi-browser settings, local/cloud boundaries, and the exact data collected. Keep Chrome Web Store availability truthful.

- [ ] **Step 2: Run the complete verification matrix**

Run fresh:

```bash
/home/pritam/.bun/bin/bun test
npm run test:extension
PATH=/home/pritam/.bun/bin:/usr/local/bin:/usr/bin:/bin npm run test:customer
npm run test:web
node deploy/verify-release.mjs
```

Check `git diff --check`, review every changed file, and verify the extension package excludes legacy control/relay code and secrets.

- [ ] **Step 3: Package and stage 1.5.0**

Use the existing release tooling and signing key without exposing key material. Verify ZIP/CRX version, fixed extension ID, hashes, archive contents, and website asset equality.

- [ ] **Step 4: Merge and deploy**

Fast-forward `main` only after all checks pass. Push `main`, synchronize web assets, restart the loopback backend service, and verify health, account/preferences API behavior, static pages, and direct downloads over public HTTPS.

- [ ] **Step 5: Publish and verify the release**

Publish GitHub release `ext-v1.5.0`, inspect release assets and CI, then perform the live signup → connect → save rich bookmark → origin/detail → preference change → second-browser behavior → revoke → cleanup flow.

- [ ] **Step 6: Record evidence and commit**

Document commands, counts, public URLs, hashes, deployment revision, and limitations in `docs/customer-launch-1.5.0.md`. Commit and push the evidence update.
