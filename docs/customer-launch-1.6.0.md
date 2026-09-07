# Foundkeep customer release 1.6.0

Foundkeep 1.6 rebrands the shipped customer extension and private dashboard while preserving the existing extension identity, local library, customer accounts, cloud captures, preferences, recovery records, and update path.

## Customer changes

- Foundkeep name and source-point bookmark mark across landing, account setup, dashboard, privacy, extension popup, local library, menus, errors, social preview, and store assets.
- Primary website and extension API origin changed to `https://foundkeep.app`.
- Exact legacy-origin support keeps version 1.5 clients operational during migration.
- Foundkeep-named ZIP and CRX downloads accompany the legacy-named aliases required for installed clients.
- Recovery and export downloads use Foundkeep filenames.

## Compatibility

- Signed extension ID stays `mjfcgmboaijfcaanepdipbgmipnccnpn`.
- Manifest signing key, IndexedDB, storage keys, message kinds, API routes, database tables, data directory, account header, and environment prefixes remain unchanged.
- Existing cloud accounts and captures stay in the same SQLite database.
- Existing website cookies cannot cross from `notpritam.in` to `foundkeep.app`; customers sign in once on the new domain.
- The legacy hostname redirects human-facing pages to Foundkeep while API and relay routes plus the legacy GitHub asset name remain live for version 1.5 clients.

## Candidate verification — 7 September 2026

- Backend: 52 passed, 0 failed.
- Extension: 40 passed, 0 failed.
- Landing: 6 passed, 0 failed.
- Customer web and real Chromium flow: 15 passed, 0 failed.
- Signed CRX: valid CRX3 signature, fixed ID `mjfcgmboaijfcaanepdipbgmipnccnpn`, 105,953 bytes.
- `atlas-extension.crx` and `foundkeep-extension.crx`: identical SHA-256 `ef42f9cad0509378d70ac294f8b117b801415dc76879837c6b72825ed12d91a1`.
- `foundkeep-extension.zip`: SHA-256 `c98800973f283e3befb97ca5dc9d2bcd06cd6dd1b1dcb34edea0ccccb25952c6`.
- `atlas-extension.zip`: SHA-256 `bc82c89e76e8bb40c7317643bb9b1603211094e6a8b1006970defd26615a3a80`.
- `foundkeep-store-1.6.0.zip`: SHA-256 `c15969fc3cc5c9f34ff05e48a0a8db2a2b25d75e6a0514279e5f62062d644107`; no signing key, update URL, private key, or companion-control scripts.

Production evidence will be appended after DNS, TLS, deployment, the GitHub release workflow, and the disposable live-account flow complete.
