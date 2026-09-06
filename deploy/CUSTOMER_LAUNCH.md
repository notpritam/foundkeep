# Customer service operations

Customer website: https://atlas.notpritam.in. Signup and dashboard use `/api`,
separate from the legacy `/v1` backend and browser relay. Customer records are
in `customer_*` SQLite tables. Never mint legacy device tokens for customers.

## Runtime

- Bun, SQLite, the existing `atlas-backend` service and Caddy TLS.
- Keep the runtime data directory mode 0700 and SQLite files mode 0600. The
  service uses `UMask=0077`; existing installations can apply that setting with
  a systemd service drop-in without replacing their other configuration.
- Install `tesseract`, English trained data and `prlimit` (util-linux).
  Arch: `sudo pacman -S --needed tesseract tesseract-data-eng util-linux`.
  Debian/Ubuntu: `sudo apt-get install tesseract-ocr tesseract-ocr-eng util-linux`.
- Customer text organization and English OCR run automatically in the backend.
  Content is processed as data, without a model, local agent tools or arbitrary
  URL fetching. OCR is bounded by CPU, memory, execution time and output size.
  If recognition fails, the original capture remains available.
- `ATLAS_CUSTOMER_ORIGIN` defaults to `https://atlas.notpritam.in` and must exactly
  match the public origin. `ATLAS_HOST` defaults to loopback. Only Caddy should
  reach the service from outside the host. Caddy supplies the client address for
  abuse controls; forwarding headers from non-loopback peers are ignored.
- Per-account limits: 1,000 captures and 200 MiB (image and text storage).
  Global protection defaults: 10,000 captures and 2 GiB. Adjust
  `ATLAS_CUSTOMER_GLOBAL_MAX_CAPTURES` and `ATLAS_CUSTOMER_GLOBAL_MAX_BYTES`
  deliberately as storage/capacity grows.

## Accounts and recovery

Native email/password sign-in does not imply ownership of an email address.
There is no mail sender configured. Customers save a one-time recovery code
during signup, or when rotating their password. Recovery rotates that code and
revokes old sessions/browser connections. Do not claim to send password-reset
email or enable email-based sharing until verified email delivery is implemented.

Website sessions use secure HttpOnly cookies. Extension connections use hashed,
revocable credentials claimed with a short-lived code from the authenticated
website. No credentials belong in URLs, application logs or support screenshots.

Connecting a browser only uploads new captures. Customers can explicitly import
their previous local library. Queued captures retain their original account
owner across disconnects, retries and account switches.

## Release and rollback

1. Run `bun test`, `bun run test:extension`, `bun run test:web`, and
   `bun run test:customer`. The customer integration test uses a temporary DB,
   profile and extension copy; it never touches production accounts.
2. Use SQLite's backup API to snapshot the live DB into a private dated backup
   directory. Copy legacy blobs if changing their layout (this release does not).
   Preserve the signing key and existing extension ID.
3. Fast-forward the clean production checkout to the tested commit, restart
   `atlas-backend`, check `/healthz`, signup/login and `/api/me` through HTTPS.
4. Verify one disposable QA account and delete it through its authenticated
   account endpoint. Do not inspect real customer captures while checking health.
5. Publish the signed version and verify the unchanged ID and download artifacts.

Migrations are append-only. For a code rollback, point the service at the previous
commit; customer tables can remain. Restoring a pre-release DB discards captures
created since that backup, so stop writes and preserve a fresh backup before any
data restore. Backups contain private customer data and must have mode 0600.

## Chrome Web Store

`bash deploy/pack-store.sh` builds a separate store upload. It has no self-hosted
update URL or key. The Web Store assigns its own ID, so after creating the listing,
add its ID to `apps/web/customer-config.json` alongside the existing self-hosted
ID, and set `ATLAS_CUSTOMER_EXTENSION_IDS` to the store ID in the backend service
environment, then restart it (the signed ID remains allowed). Set `storeUrl` to the approved listing's `https://chromewebstore.google.com/…`
URL only once customers can install it. The dashboard then uses that install link.

Until a publisher submits it and Google approves it, onboarding accurately offers
the ZIP and manual Chrome setup. A signed CRX on GitHub does not provide ordinary
customers with a one-click Chrome Web Store installation.
