# Foundkeep Launch Design

## Product identity

Atlas becomes **Foundkeep**, a customer-facing browser extension and private web library for saving readable pages, screenshots, highlights, images, links, posts, and notes with enough provenance to return to the original source.

The core line remains **“Found it? Keep it.”** Supporting copy should use plain customer language: finds, saves, sources, library, browser, and account. Agent and operator language stays out of the customer journey.

The primary public origin is `https://foundkeep.app`. The existing `https://atlas.notpritam.in` origin remains functional during the migration so installed version 1.5 clients can keep syncing and customers can update safely.

## Visual system

Foundkeep retains the current warm paper, near-black, and vermilion product palette:

- Paper: `#f3f3f0`
- Ink: `#171917`
- Vermilion: `#c63b23`
- Moss support: `#6b7553`

The new mark is a folded bookmark inside a protected dark frame. A vermilion point marks the saved item's origin. It must remain legible at 16px, work in monochrome, and appear consistently across the site, dashboard, extension popup, extension library, social card, and release/store artwork.

The generated visual direction is stored at `docs/brand/foundkeep-brand-board.png`. Product assets use deterministic SVG and PNG exports rather than embedding the generated board.

## Compatibility contract

- Preserve extension ID `mjfcgmboaijfcaanepdipbgmipnccnpn` by retaining the manifest key and existing signing key.
- Preserve IndexedDB names and versions, `atlasCustomer`, `atlasPreferenceCache`, `atlas-*` internal message kinds, `X-Atlas-Account`, existing API routes, database tables, data directory, and environment-variable prefixes.
- Version 1.6 uses `https://foundkeep.app` for new account and sync traffic and accepts external pairing messages from both Foundkeep and the legacy Atlas origin.
- The backend accepts cookie-authenticated website requests from both exact origins. It never uses substring or suffix origin matching.
- Existing 1.5 installations continue using `https://atlas.notpritam.in` until updated. The old hostname must remain connected to the same backend and customer database through the transition.
- Browser cookies cannot migrate across unrelated domains. Existing accounts and captures remain intact; customers sign in once on `foundkeep.app`.
- Keep the legacy GitHub release filenames and URLs needed by installed clients. Add Foundkeep-named download aliases for new customers.

## Customer surfaces

Every visible product reference in the landing page, authentication, recovery, privacy policy, web dashboard, extension popup, extension library, context menus, errors, accessibility labels, manifest, Chrome Web Store copy, social metadata, and public documentation changes from Atlas to Foundkeep.

Internal companion and browser-control implementation is outside this launch's product focus. Compatibility identifiers can keep the Atlas name when changing them would create upgrade risk or provide no customer value.

## Domain and deployment

The `foundkeep.app` registration must be completed through the owner's registrar before DNS can be delegated. After DNS points at the production host, Caddy serves both hostnames from the same backend. HTTPS must be valid before version 1.6 is published because `.app` is HSTS-preloaded and extension requests must not fall back to HTTP.

Production deployment order:

1. Back up and integrity-check the SQLite database.
2. Deploy backend support for both exact customer origins while the 1.5 extension remains live.
3. Point `foundkeep.app` DNS to the production host and verify TLS, CSP, canonical metadata, signup, login, and dashboard.
4. Publish signed extension 1.6 with the unchanged ID and Foundkeep branding.
5. Redirect human-facing legacy-hostname requests to the same Foundkeep path while keeping legacy API, relay, health, package, and release asset URLs live through the transition.

## Acceptance

- No customer-visible Atlas wording remains in packaged Foundkeep surfaces.
- Existing extension data opens after an in-place upgrade.
- Old and new exact web origins can use the same customer API; lookalike origins cannot.
- A new Foundkeep account can install, pair, save a readable bookmark, sync, view provenance, change extension preferences, export, revoke, and delete.
- Signed CRX identity remains unchanged and both legacy and Foundkeep-named release artifacts are valid.
- Desktop Chromium layouts have no overflow at popup height and customer pages remain usable from 320px through 1440px.
