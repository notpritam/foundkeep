# Foundkeep customer service operations

Primary customer website: `https://foundkeep.app`. Human-facing requests on `https://atlas.notpritam.in` redirect to the same Foundkeep path. The legacy hostname keeps API, relay, health, and package routes connected to the same backend for installed version 1.5 extensions. Both origins use the same `customer_*` SQLite records. The `/api` customer service remains separate from legacy `/v1` and browser-relay records.

## Runtime

- Bun, SQLite, the existing internal `atlas-backend` service, and Caddy TLS.
- Runtime data stays at `/home/pritam/.local/share/atlas` with directory mode 0700 and SQLite/backups mode 0600. Renaming this path would risk production data and provides no customer benefit.
- The service uses `UMask=0077`.
- `ATLAS_CUSTOMER_ORIGINS` must be `https://foundkeep.app,https://atlas.notpritam.in` during migration. The singular `ATLAS_CUSTOMER_ORIGIN` remains supported for local tests and older deployments.
- `ATLAS_HOST` stays on loopback. Caddy is the only public entry point.
- Install Tesseract English OCR and `prlimit` from util-linux for bounded image text recognition.
- Per-account limits are 1,000 captures and 200 MiB. Global defaults are 10,000 captures and 2 GiB.

## Migration behavior

Version 1.5 uses the legacy hostname. Version 1.6 uses `foundkeep.app` and allows pairing messages from both exact origins. Redirect legacy website pages, but keep its compatibility route matcher and the legacy `atlas-extension.crx` release asset available until old installations have updated.

Browser cookies cannot move from `notpritam.in` to `foundkeep.app`. Existing customers sign in once on the new domain; account data, cloud captures, preferences, recovery code, and browser credentials remain in the same database. Existing 1.5 extensions continue syncing through the legacy origin during the transition.

The extension ID remains `mjfcgmboaijfcaanepdipbgmipnccnpn`. Preserve its manifest key and private signing key. Preserve internal IndexedDB names, storage keys, message kinds, `X-Atlas-Account`, database tables, data paths, API routes, and environment-variable prefixes.

## Accounts and captures

Website sessions use Secure HttpOnly SameSite=Lax cookies. Extension connections use separate hashed, revocable credentials claimed through a short-lived pairing code. Credentials never belong in URLs, logs, support screenshots, or exports.

Connecting a browser uploads only new captures. Importing earlier local records requires explicit account-bound confirmation. Pending captures retain their original account through disconnects, retries, and account switches.

Saved pages keep bounded readable text and structured provenance rather than raw HTML. Origin metadata includes the exact visited page even when a different canonical URL is declared. Customers can view it in capture detail and account exports.

Account-owned preferences control capture methods, page content and metadata, note sources, popup order, recent items, context menus, automatic sync, OCR, summaries, tags, and success feedback. Preference changes do not require reinstalling the extension.

## Release order

1. Run `bun test`, `bun run test:extension`, `bun run test:web`, and `bun run test:customer`.
2. Back up the live database with SQLite's backup API into a private timestamped file and run `PRAGMA integrity_check` on the backup.
3. Deploy dual-origin backend support before changing DNS or releasing version 1.6.
4. Register `foundkeep.app`, point apex and optional `www` DNS at the production host, install the shared Caddy blocks, and verify valid TLS. `.app` requires HTTPS.
5. Verify signup, login, recovery, dashboard, privacy, downloads, canonical metadata, CSP, and both exact origin policies on Foundkeep.
6. Publish the signed version 1.6 release, verify the unchanged ID and signature, and keep both Foundkeep and legacy artifact names.
7. Run the disposable live account flow and delete its test account through the authenticated endpoint.

## Rollback

Code and database migrations are additive. A code rollback can point the service at the previous commit while customer tables remain. Restoring a database backup discards captures created after that backup, so stop writes and take a new private backup before any restore.

## Chrome Web Store

`bash deploy/pack-store.sh` creates a key-free store upload. Google assigns a different store ID; add it to the website and backend allowlists only after creating the listing. Set the public store URL only when the approved listing is installable. Until then, onboarding offers a truthful manual ZIP flow.
