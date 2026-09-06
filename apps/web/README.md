# Atlas — website

The production landing page is live at **https://atlas.notpritam.in/**. It is static HTML, CSS, JavaScript, and self-hosted assets; there is no build step.

## Production

The `atlas-backend` systemd service serves `apps/web` directly from the main repository checkout. Caddy forwards `atlas.notpritam.in` to that service on port 8790. Updating the main checkout deploys site files immediately. Do not deploy the marketing site to a separate hostname or replace the shared Caddyfile.

## Preview and test

From the repository root:

```sh
node scripts/preview-server.mjs
bun run test:web
```

Open `http://localhost:9048/apps/web/` for the landing page or
`http://localhost:9048/apps/extension/src/dashboard.html` for the sample library. The demo runtime is not part of `apps/web` or the extension download.

`ATLAS_SITE_URL=https://atlas.notpritam.in bun run test:web` verifies the live landing page with the same browser checks. It exercises only public pages, downloads, and the illustrative demo.

## Downloads and artwork

`bash deploy/pack-extension.sh` refreshes `atlas-extension.zip` from the current extension source. The signed CRX and update manifest are built by the GitHub release workflow; see [release instructions](../../deploy/README.md).

`bun run prepare:web-assets` encodes responsive WebP images from the retained original artwork and renders the 1200×630 social preview. It requires Playwright Chromium. Social and canonical metadata, robots.txt, and sitemap.xml point to the production domain.
