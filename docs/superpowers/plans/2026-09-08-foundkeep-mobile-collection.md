# Foundkeep Mobile Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Foundkeep 1.0.0 as an Expo iPhone app with an Apple-supported Share Extension that saves every common shared content type into the existing private collection.

**Architecture:** An Expo SDK 57 containing app owns account, collection and settings UI. An owned Swift Share Extension and local Expo module share a Keychain credential and App Group queue. The Bun/Hono backend adds native token auth and streamed generic-file capture while preserving existing extension and web contracts.

**Tech Stack:** Expo SDK 57, React Native, Expo Router, TypeScript, Swift/UIKit, Expo config plugins, EAS Build/Update, Bun, Hono, SQLite.

**Spec:** `docs/superpowers/specs/2026-09-08-foundkeep-mobile-collection-design.md`

## Global Constraints

- App version is `1.0.0`; iOS build number is `1`.
- Main bundle identifier is `app.foundkeep.ios`; Share Extension identifier is `app.foundkeep.ios.ShareExtension`.
- App Group is `group.app.foundkeep.ios`; API origin is exactly `https://foundkeep.app`.
- Binary files are at most 50 MiB; account limits remain 1,000 captures and 200 MiB.
- Existing capture rows, routes, browser extension credentials, and legacy image blobs remain compatible.
- OTA updates use EAS channels `preview` and `production` with the fingerprint runtime policy.
- Remote policy is versioned data only and cannot load executable code.

---

### Task 1: Native customer sessions

**Files:**
- Modify: `apps/backend/src/customer.ts`
- Test: `apps/backend/test/customer.test.ts`

**Interfaces:**
- Produces: `POST /api/mobile/register|login|recover`, `GET /api/mobile/me`, `POST /api/mobile/logout`.
- Produces: `{ account, token, connection }`, where `token` is a 43-character base64url bearer credential valid for 90 days.

- [ ] **Step 1: Write failing route tests** for successful registration/login, duplicate email, one-time recovery code, rate-limited invalid login, bearer `/me`, logout, connection listing and recovery revocation.
- [ ] **Step 2: Run `bun test apps/backend/test/customer.test.ts`** and verify the mobile routes return 404 before implementation.
- [ ] **Step 3: Extract connection issuance** into `issueConnection(accountId: string, name: string)` and implement bounded native JSON routes using the existing password, account and revocation helpers.
- [ ] **Step 4: Run `bun test apps/backend/test/customer.test.ts`** and verify all native session cases pass without changing web cookie behavior.
- [ ] **Step 5: Commit** `apps/backend/src/customer.ts apps/backend/test/customer.test.ts` with `feat: add Foundkeep mobile sessions`.

### Task 2: Universal capture metadata

**Files:**
- Modify: `apps/backend/src/db.ts`
- Modify: `apps/backend/src/customer-provenance.ts`
- Modify: `apps/backend/src/customer.ts`
- Test: `apps/backend/test/customer.test.ts`

**Interfaces:**
- Produces additive columns `batch_id`, `file_name`, `file_path`, `file_mime`, and `file_bytes`.
- Produces capture types `video`, `audio`, `document`, and `file` in the customer API.
- Produces DTO fields `batchId`, `fileName`, `fileMime`, `fileBytes`, and `fileUrl`.

- [ ] **Step 1: Add failing migration and JSON-capture tests** for every new type, batch grouping, file metadata, provenance methods and idempotent `clientId` reuse.
- [ ] **Step 2: Run `bun test apps/backend/test/customer.test.ts`** and verify failures identify the missing columns and type validation.
- [ ] **Step 3: Add idempotent SQLite migrations** and update customer row types, select columns, DTO serialization, filters, validation and provenance allowlists.
- [ ] **Step 4: Run the focused backend tests** and verify legacy upload and export tests still pass.
- [ ] **Step 5: Commit** the backend metadata slice with `feat: model universal Foundkeep captures`.

### Task 3: Streamed file capture

**Files:**
- Create: `apps/backend/src/customer-files.ts`
- Modify: `apps/backend/src/customer.ts`
- Modify: `apps/backend/src/config.ts`
- Test: `apps/backend/src/customer-files.test.ts`
- Test: `apps/backend/test/customer.test.ts`

**Interfaces:**
- Produces: `writeCustomerFile(request, options): Promise<{ path, bytes, detectedMime }>`.
- Produces: `POST /api/mobile/captures/file` with raw bytes and `X-Foundkeep-Capture` metadata.
- Produces: owner-scoped `GET /api/captures/:id/file` and deletion cleanup.

- [ ] **Step 1: Write failing unit tests** for header decoding, safe basenames, exact length, maximum size, abort cleanup, magic-byte classification and inline/download dispositions.
- [ ] **Step 2: Run `bun test apps/backend/src/customer-files.test.ts apps/backend/test/customer.test.ts`** and verify the missing module and route fail.
- [ ] **Step 3: Implement bounded streaming** to a random temporary path under the configured data directory, validate after close, atomically rename, and expose cleanup helpers.
- [ ] **Step 4: Implement the route** with upload slots, two-phase quota checks, owner-scoped idempotency and database/file cleanup on every failure.
- [ ] **Step 5: Run focused tests and `bun test apps/backend`** and verify no regression in existing customer and enrichment flows.
- [ ] **Step 6: Commit** the file capture slice with `feat: stream mobile files into Foundkeep`.

### Task 4: Web collection support

**Files:**
- Modify: `apps/web/dashboard.html`
- Modify: `apps/web/dashboard.js`
- Modify: `apps/web/customer.js`
- Modify: `apps/web/customer.css`
- Test: `tests/customer-web.mjs`
- Test: `tests/customer-flow.mjs`

**Interfaces:**
- Consumes: new capture DTO fields and file endpoint from Tasks 2-3.
- Produces: cards, filters, previews and downloads for image, video, audio, document and generic files.

- [ ] **Step 1: Add failing DOM/source tests** for new filter labels, safe media controls, generic download links, filenames, byte sizes and batch context.
- [ ] **Step 2: Run `npm run test:customer`** and confirm the expected customer-web assertions fail.
- [ ] **Step 3: Extend dashboard rendering** with text-only safe DOM construction, lazy media previews, file metadata and source links while retaining existing legacy blob cards.
- [ ] **Step 4: Run `npm run test:customer`** and a 390-pixel Playwright smoke pass with no horizontal overflow.
- [ ] **Step 5: Commit** the web slice with `feat: show universal captures in the collection`.

### Task 5: Expo application shell

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/eas.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/src/theme.ts`
- Create: `apps/mobile/src/components/*`
- Modify: `package.json`

**Interfaces:**
- Produces: Expo SDK 57 app named Foundkeep, version `1.0.0`, bundle `app.foundkeep.ios`, scheme `foundkeep`, and typed Foundkeep theme primitives.

- [ ] **Step 1: Scaffold the workspace** with exact SDK 57 packages and add root scripts `mobile:start`, `mobile:typecheck`, `mobile:test`, and `mobile:prebuild`.
- [ ] **Step 2: Add configuration tests** that read public Expo config and assert identifiers, version, URL scheme, update fingerprint policy and no secret values.
- [ ] **Step 3: Build the navigation shell** with safe areas, native stack transitions, Foundkeep type/color tokens, accessibility defaults and error boundaries.
- [ ] **Step 4: Run `npm run mobile:typecheck` and the config tests** until both pass.
- [ ] **Step 5: Commit** the shell with `feat: create Foundkeep mobile app`.

### Task 6: Typed mobile API, auth and collection

**Files:**
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/api/types.ts`
- Create: `apps/mobile/src/session/*`
- Create: `apps/mobile/src/collection/*`
- Create: `apps/mobile/app/(auth)/*`
- Create: `apps/mobile/app/(app)/*`
- Test: `apps/mobile/src/api/client.test.ts`
- Test: `apps/mobile/src/collection/model.test.ts`

**Interfaces:**
- Produces: `FoundkeepClient`, `SessionProvider`, `useSession`, `CollectionProvider`, and pure collection filter/group functions.
- Consumes: native routes and DTOs from Tasks 1-3.

- [ ] **Step 1: Write failing tests** for authorization headers, bounded API errors, revoked sessions, cursor paging, retry-safe client IDs, type filters and batch grouping.
- [ ] **Step 2: Run `npm run mobile:test`** and verify the tests fail against missing modules.
- [ ] **Step 3: Implement the typed client and providers** with abort timeouts, no credential logging, app-state refresh, pagination and optimistic delete rollback.
- [ ] **Step 4: Implement account, recovery-code, collection, detail and settings screens** with accessible loading, offline, empty and error states.
- [ ] **Step 5: Run mobile tests and typecheck** and verify route modules compile without Expo Router warnings.
- [ ] **Step 6: Commit** the customer app flow with `feat: add Foundkeep mobile collection`.

### Task 7: Shared native bridge and durable queue

**Files:**
- Create: `apps/mobile/modules/foundkeep-shared/*`
- Create: `apps/mobile/src/share/queue.ts`
- Modify: `apps/mobile/app.json`
- Test: `apps/mobile/src/share/queue.test.ts`

**Interfaces:**
- Produces native module methods `setSession`, `clearSession`, `getSession`, `listPending`, `submitPending`, and `removePending`.
- Produces queue records containing `id`, `clientId`, `batchId`, `metadata`, optional `payloadPath`, `attempts`, `nextAttemptAt`, and `createdAt`.

- [ ] **Step 1: Write failing queue-model tests** for atomic record state, exponential retry limits, idempotency and completed-payload cleanup.
- [ ] **Step 2: Run `npm run mobile:test`** and verify the queue module is absent.
- [ ] **Step 3: Implement the local Expo Swift module** using the shared Keychain and App Group container, atomic JSON writes and file ownership checks.
- [ ] **Step 4: Implement the TypeScript queue adapter and app drain loop** at launch, foreground and manual retry.
- [ ] **Step 5: Run tests, typecheck and Expo module autolinking inspection** and verify the native module is detected.
- [ ] **Step 6: Commit** with `feat: add durable iOS share queue`.

### Task 8: Native iOS Share Extension

**Files:**
- Create: `apps/mobile/plugins/withFoundkeepShareExtension.js`
- Create: `apps/mobile/share-extension/Info.plist`
- Create: `apps/mobile/share-extension/ShareExtension.entitlements`
- Create: `apps/mobile/share-extension/ShareViewController.swift`
- Create: `apps/mobile/share-extension/ShareItemLoader.swift`
- Create: `apps/mobile/share-extension/ShareUploader.swift`
- Create: `apps/mobile/share-extension/SafariPreprocessor.js`
- Test: `apps/mobile/scripts/verify-ios-project.mjs`

**Interfaces:**
- Consumes: shared Keychain/App Group contract from Task 7 and backend upload contract from Task 3.
- Produces: target `FoundkeepShare`, bundle `app.foundkeep.ios.ShareExtension`, activation support for URL/text/image/movie/audio/PDF/file and multi-item sharing.

- [ ] **Step 1: Write a failing generated-project verifier** for target membership, identifiers, entitlements, activation dictionary, source files and embedded appex build phase.
- [ ] **Step 2: Run `npx expo prebuild --platform ios --clean --no-install` and the verifier** and confirm the Share target is missing.
- [ ] **Step 3: Implement the config plugin** to create the target, copy sources, set deployment/build settings, attach frameworks, entitlements and embed phase through Expo's Xcode project utilities.
- [ ] **Step 4: Implement the native sheet** with item previews, optional note, Save/Cancel/Open Foundkeep actions, safe provider loading, content hashes, source metadata and durable-before-network queue writes.
- [ ] **Step 5: Regenerate iOS and run the verifier** until every target, plist and entitlement assertion passes.
- [ ] **Step 6: Commit** the native share flow with `feat: add Foundkeep to the iOS Share sheet`.

### Task 9: OTA policy and release assets

**Files:**
- Create: `apps/mobile/src/policy/*`
- Create: `apps/web/mobile-policy.json`
- Create: `apps/mobile/assets/icon.png`
- Create: `apps/mobile/assets/splash-icon.png`
- Create: `deploy/MOBILE_RELEASE.md`
- Create: `deploy/MOBILE_STORE_LISTING.md`
- Create: `deploy/MOBILE_REVIEWER_GUIDE.md`
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`

**Interfaces:**
- Produces EAS `development`, `preview`, and `production` profiles and matching update channels.
- Produces versioned `MobilePolicy` validation with bundled fallback and bounded values.

- [ ] **Step 1: Add failing policy and asset checks** for data-only keys, fixed API origin, runtime fingerprint, 1024-square opaque icon, support/privacy URLs and version `1.0.0`.
- [ ] **Step 2: Run mobile tests and asset checks** and verify the missing policy/assets fail.
- [ ] **Step 3: Implement validated remote policy and bundled fallback**, EAS profiles, deterministic Foundkeep icon/splash assets and release scripts.
- [ ] **Step 4: Write exact App Store listing, privacy disclosures, reviewer account steps, device test matrix, build/update/rollback commands and native-versus-OTA change table.**
- [ ] **Step 5: Update product/design contracts** to include the mobile collection and Share Extension surfaces.
- [ ] **Step 6: Commit** release readiness with `docs: prepare Foundkeep mobile launch`.

### Task 10: End-to-end verification and delivery

**Files:**
- Modify only files exposed by the verification results.

**Interfaces:**
- Consumes every previous task.
- Produces a tested iOS project and release-ready EAS/App Store inputs.

- [ ] **Step 1: Run `bun test`, `npm run mobile:test`, `npm run mobile:typecheck`, mobile config checks, and clean iOS prebuild verification.**
- [ ] **Step 2: Run production web/customer smoke tests** against `https://foundkeep.app` for login, capture listing, source navigation, support and privacy.
- [ ] **Step 3: Run `npx eas-cli whoami` and configure the EAS project** without placing credentials in the repository.
- [ ] **Step 4: Run an EAS iOS development build**, resolve compile errors, install it on a registered iPhone, and execute the real Share sheet matrix from the spec.
- [ ] **Step 5: Produce App Store screenshots and submission metadata from the verified build**, then create a production EAS build.
- [ ] **Step 6: Submit to TestFlight/App Review and publish the first `production` EAS Update** only after the matching binary is installed.
- [ ] **Step 7: Commit any verification fixes and push `main`** after all repository checks pass.
