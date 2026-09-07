# Foundkeep

**Found it? Keep it.** Save readable pages, screenshots, highlights, images, and stray ideas with their original source in a private, searchable library.

[Get Foundkeep](https://foundkeep.app) · [Extension releases](https://github.com/notpritam/foundkeep/releases/latest) · [Privacy & data](https://foundkeep.app/privacy.html)

## Start collecting

1. [Create a Foundkeep account](https://foundkeep.app/signup) and save your recovery code.
2. Follow the installation steps in the dashboard. The current ZIP uses **Load unpacked** in Chrome, Edge, Brave, Opera, or Vivaldi on desktop while Chrome Web Store review is pending.
3. Click **Connect Foundkeep** in the dashboard, pin the extension, and save your first find.

New captures save in the browser first and sync to the connected account when automatic sync is enabled. Saved pages can include their readable text, headings, visited and canonical URLs, author, publisher, dates, language, lead image, favicon, capture method, timestamps, extraction status, and a content fingerprint. Foundkeep does not store raw page HTML.

Open the [dashboard](https://foundkeep.app/dashboard) to search, browse, export, revoke browsers, and control capture methods, page extraction, note sources, popup layout, context menus, sync, OCR, summaries, and tags. These account preferences flow to connected browsers without reinstalling the extension.

Earlier local captures remain local until you explicitly import them. Local and cloud copies are separate; deleting one does not erase the other. Accounts include up to 1,000 captures and 200 MiB of content.

To update an unpacked installation, replace the files in the existing extension folder and use **Reload** on the browser's extensions page. Keep the existing installation to retain its local library. Managed Chrome installations receive signed updates from GitHub Releases.

[Full extension guide](apps/extension/README.md)

## Repository

- `apps/extension` — Chromium MV3 capture popup, readable page extraction, durable account-bound sync queue, and local IndexedDB library.
- `apps/web` — landing page, account setup, private dashboard, privacy policy, and downloads.
- `apps/backend` — Bun/Hono customer accounts, private capture APIs, SQLite storage, and bounded organization worker.
- `packages/shared` — schemas used by server-backed clients.
- Legacy companion, desktop, and browser-control integrations remain available for existing installations but are outside the customer onboarding flow.

## Develop and verify

```sh
bun install --frozen-lockfile --ignore-scripts
bunx playwright-core install chromium
bun test
bun run test:extension
bun run test:web
bun run test:customer
```

The customer integration test also needs Tesseract English OCR and util-linux (`prlimit`); see [customer operations](deploy/CUSTOMER_LAUNCH.md). Browser tests use temporary profiles and synthetic captures. `CHROMIUM_PATH` can select an installed Chromium executable.

[Deployment and release guide](deploy/README.md)
