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

## Production activation — 7 September 2026

- Deployed commit: `232a8ad3ffc84f587704686160b8c4d81aa36634`.
- Cloudflare edge TLS serves `foundkeep.app`; Caddy uses an internal origin certificate and proxies to the existing backend on port 8790.
- `www.foundkeep.app` redirects permanently to the apex.
- Human-facing `atlas.notpritam.in` paths redirect to the matching Foundkeep path; compatibility API and health routes remain available for version 1.5 clients.
- Pre-deployment database backup: `/home/pritam/.local/share/atlas/backups/before-foundkeep-1.6.0-20260907T090923Z.sqlite`, 307,200 bytes, `PRAGMA integrity_check` returned `ok`.
- Live landing and deployment contract: 7 passed, 0 failed.
- Live customer web and real Chromium journey: 15 passed, 0 failed, including signup, pairing, preference refresh, readable capture provenance, sync, export, recovery, revocation, and deletion.
- GitHub workflow: `https://github.com/notpritam/foundkeep/actions/runs/34107018285`, completed successfully.
- Public release: `https://github.com/notpritam/foundkeep/releases/tag/ext-v1.6.0`.
- Public `atlas-extension.crx` and `foundkeep-extension.crx`: identical SHA-256 `5ef26c95ed34924e0d51ceee6c8b5508eaeb4fd5b4a33f2a40a95a69f5430a3d`, 105,842 bytes, valid CRX3 signature, fixed ID, and version 1.6.0.
- Public `foundkeep-extension.zip`: SHA-256 `9a35fbb95777da81880598bb36e4647cc2e6b715e2b1031c50c926f4239b20dd`.
- Public `atlas-extension.zip`: SHA-256 `7c596855b2e09f3d1400b69b35d6f55e8e800ebe5e3538b9ab907fec08ac836c`.
- Public `updates.xml`: SHA-256 `d62a97bba35d4ef374c6ac97d656b471ca09a01255116ca6dabd8c0ceaae206f`; the pre-rename `notpritam/atlas` URL redirects to identical version 1.6.0 content.
- The website download at `https://foundkeep.app/foundkeep-extension.zip` matches the committed artifact SHA-256 `c98800973f283e3befb97ca5dc9d2bcd06cd6dd1b1dcb34edea0ccccb25952c6`.
