# Foundkeep agentic collections and RevenueCat release

12 September 2026.

## Available now

The website and customer backend are live at https://foundkeep.app. Customers can import bookmarks through the new extension library, manage saves in its sidebar, create scoped MCP connections, and inspect their plan and processing controls. Free library/import/MCP work independently of paid providers. Managed processing, Stripe checkout and App Store purchases show an unavailable state until their provider configuration is supplied.

The new native app is **1.0.0 (18)**. Apple accepted the signed binary, marked processing `VALID`, and the build is assigned to **Foundkeep Internal**. Open TestFlight and update Foundkeep. No public App Review submission was made with unconfigured purchases.

## Deployment and data

- Backend source: `9a93b05`, immutable release `20260912-billing-9a93b05`.
- Website source: `20d1d06`, immutable release `20260912-agentic-hydration`.
- Native source: `9a93b05`; personal Expo owner `notpritam`, account `notpritamsharma@gmail.com`.
- Schema upgraded from 14 to 23 after an online SQLite backup and migration trial. The four original customer accounts and 17 customer saves were preserved. Integrity check is `ok`; the trial preserved original account/capture/session/connection values. An orphan connection FK already existed in the schema-14 backup and was not introduced by these migrations.
- Backend and site services are healthy. Previous immutable releases and the database backup remain available. Unrelated edits in the original Linux and Mac working directories were preserved.

The production browser test exercised signup, account controls, MCP creation, an actual MCP request, nudging, revocation and account deletion. Private SSR responses now include `Cache-Control: no-transform`, preventing Cloudflare email rewriting from breaking React hydration.

## Native artifact

- Bundle IDs: `app.foundkeep.ios` and `app.foundkeep.ios.ShareExtension`.
- Apple team: `6HVH7CKN3M`; App Store app ID: `6809771188`.
- App Store build ID: `0d0ab19f-ead9-47ac-a332-81013c5a6b7f`.
- EAS submission: `5b04ff6b-b2c1-4483-9fbe-f2c60b5e4a67`.
- IPA on Mac: `/Users/notpritamm/Developer/foundkeep-builds/Foundkeep-1.0.0-agentic.ipa` (23,773,820 bytes).
- SHA-256: `1c3c48e8a181efb57e4d0a2a5baafeb19089b5b83985a88e0f400f6e06abb94b`.
- Fingerprint runtime: `f82707b954c566999320c3a2a6352710a0f40abb`.

The main app and share extension passed strict code-signature verification, bundle/build identity checks, shared App Group/keychain checks, and generated native project validation. Both bundles' configured keychain access groups match their signed entitlements. Main-app push and associated-domain entitlements are present. RevenueCat is bundled.

The Release app passed an iPhone 17 / iOS 26.5 simulator flow: email sign-in, gallery/account navigation, shared Free status, the subscription screen, unavailable purchase/restore controls, subscription refresh and legal links. The test account was deleted and its token returned 401. Screenshots and non-secret artifact/build evidence are in [native verification](agentic-preview/native/).

The first simulator-only build omitted signing entitlements and stalled on keychain access; rebuilding with Xcode-managed simulator signing resolved it. The uploaded device IPA had the correct keychain configuration throughout. The UI harness also needed to wait for provider discovery/keyboard focus and dismiss iOS's Save Password prompt. No application source changes were needed for those test-environment issues.

Build 15 uses a different runtime and cannot receive this native SDK through OTA. Compatible future JavaScript updates must target build 18's runtime. This release did not publish an OTA update to build 15.

## Verification

- 181 backend tests: zero failures, 1,742 assertions.
- 59 extension tests and 60 mobile tests: zero failures.
- Backend, web and mobile TypeScript checks; production Next build.
- Installed Chromium account/capture/import/reload/revocation flow, including nested folders, original dates and provenance.
- Live desktop and narrow account/MCP controls without browser runtime or hydration errors.
- Billing tests cover provider verification, replay/order, ownership, native/web overlap, stale cancellation, restore recovery and per-account sandbox access.
- Native iPhone simulator subscription flow and screenshots; Apple reports build 18 `IN_BETA_TESTING` for the internal group.

Real OpenAI calls and StoreKit purchases remain unverified because their provider configuration has not been supplied. Native optional browser-permission acceptance also remains a manual browser check; denial and tree parsing are automated.

## Chrome update

The existing Chrome Store item remains unchanged until its prepared **1.0.1** package is uploaded and approved. The self-hosted downloadable ZIP is **1.7.0** and includes the new sidebar. This task did not publish a new Chrome Store version or a signed automatic CRX release.

- `deploy/dist/foundkeep-store-1.0.1.zip`: upload this archive to the existing item.
- `deploy/dist/foundkeep-cws-submission-kit-1.0.1.zip`: listing, permission/data disclosures, reviewer guide, audit and screenshots.
- New permission: `sidePanel`; optional `bookmarks` requested only when the customer explicitly imports.

## Configuration still needed

Follow [RevenueCat setup](REVENUECAT-SETUP.md) for the remaining project, entitlement/offering, private server credentials, webhook and sandbox verification. The Apple subscription draft has been created as `app.foundkeep.pro.monthly` (Apple ID `6811311907`), with a one-month duration, English group/product metadata, US $4.99 pricing and Apple-equalized prices across 175 territories. It remains `MISSING_METADATA` pending its actual purchase-screen review screenshot and remaining review requirements.

The authorized Mac secret-file search did not find a valid OpenAI key. Stripe credentials were explicitly deferred by the user. [Operations](AGENTIC-COLLECTIONS-OPERATIONS.md) documents their environment variables, quotas, processing controls and MCP usage. No secret was committed or included in a client/package.
