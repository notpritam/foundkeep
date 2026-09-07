# Foundkeep website

The production origin is **https://foundkeep.app/**. Human-facing requests to the previous `https://atlas.notpritam.in` hostname redirect to Foundkeep; compatibility routes remain connected to the same service for installed version 1.5 extensions.

The `atlas-backend` systemd service keeps its internal name and serves `apps/web` directly from the production checkout. Caddy forwards both exact hostnames to port 8790. Static HTML, CSS, JavaScript, fonts, and images require no separate application build.

## Preview and test

```sh
node scripts/preview-server.mjs
bun run test:web
bun run test:customer
```

Open `http://localhost:9048/apps/web/` for the landing page or `http://localhost:9048/apps/extension/src/dashboard.html` for the sample local library. Preview fixtures are separate from the packaged extension.

`ATLAS_SITE_URL=https://foundkeep.app bun run test:web` verifies public artwork, metadata, responsive layout, and downloads. `ATLAS_CUSTOMER_SITE_URL=https://foundkeep.app bun run test:customer` opts the full disposable-account flow into production.

## Downloads and artwork

`bash deploy/pack-extension.sh` refreshes both `foundkeep-extension.zip` and the legacy `atlas-extension.zip` alias from the current source. The signed release retains the old asset name for installed-client updates and adds a Foundkeep-named CRX alias.

`bun run brand:assets` renders deterministic icons from the SVG mark. `bun run prepare:web-assets` produces responsive WebP images and the 1200×630 Foundkeep social card. Both commands require Playwright Chromium.
