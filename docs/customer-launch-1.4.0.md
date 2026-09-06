# Atlas customer launch — 6 September 2026

Live: https://atlas.notpritam.in/signup and https://atlas.notpritam.in/dashboard.
Release: https://github.com/notpritam/atlas/releases/tag/ext-v1.4.0.
CI: https://github.com/notpritam/atlas/actions/runs/34029767519 (success).

Customers can create an email/password account, save their recovery code, connect
the installed extension and collect into a private web dashboard. New captures
save locally first, retry safely, and remain bound to their original account.
Old local captures require explicit import. The dashboard provides search,
capture details, notes, export, recovery, browser revocation and account deletion.
Cloud text extracts, topic tags and English OCR run without a customer companion.

## Verification

- 47 backend tests: authentication, tenant isolation, recovery, CSRF, revoked
  credentials, idempotency, quotas, upload concurrency/deadlines, and safe OCR.
- 29 extension tests: real MV3 capture, durable commits, offline retries,
  account changes, explicit imports, disconnects, and companion isolation.
- 10 customer browser tests, including real signup, pairing, capture, dashboard,
  cross-tab account changes, recovery and account deletion.
- 4 landing browser tests, including responsive layout and install fallback.
- The complete signup → real extension → note/highlight/screenshot → cloud OCR
  → dashboard → revocation flow passed through public HTTPS. The disposable QA
  account was deleted and cleanup verified. Public landing checks also passed.
- A private SQLite snapshot migrated successfully before deployment, preserving
  legacy captures. Live DB integrity, service health and private file permissions
  were checked. The service uses UMask 0077, the data directory is 0700 and DB
  files are 0600.
- CRX signature, unchanged ID `mjfcgmboaijfcaanepdipbgmipnccnpn`, version and
  source contents were verified. Direct downloads match the GitHub release.

Independent reviews found and verified fixes for IndexedDB acknowledgement before
commit, an import/companion race, unlimited simultaneous upload buffering, and
stale dashboard tabs acting on a different signed-in account.

The full existing TypeScript check still reports pre-existing errors in legacy
`captures.ts` SQL binding types and `backend.test.ts` response types. Customer
modules typecheck cleanly; the runtime and browser suites above passed.

## Distribution and product boundaries

Chrome Web Store publication is pending publisher access and Google review.
The release includes `atlas-store-1.4.0.zip` and `atlas-store-assets-1.4.0.zip`.
Until a listing is approved, the website accurately shows manual ZIP installation
in Chrome on a computer. Set both the website and backend store-ID allowlists
before enabling the approved listing URL; see `deploy/CUSTOMER_LAUNCH.md`.

Sign-in uses email/password with a saved recovery code. There is no email
verification or reset-mail delivery, and the product does not claim either.
Local and cloud copies are separate; deleting one does not delete the other.
