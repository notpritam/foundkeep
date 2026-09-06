# Atlas

**Found it? Keep it.** Readable pages, screenshots, highlights, images, and stray ideas with their source in your private, searchable library.

[Get Atlas](https://atlas.notpritam.in) · [Extension releases](https://github.com/notpritam/atlas/releases/latest) · [Privacy & data](https://atlas.notpritam.in/privacy.html)

## Start collecting

1. [Create an Atlas account](https://atlas.notpritam.in/signup) and save your recovery code.
2. Follow the installation steps in your dashboard. Chrome Web Store publication is pending; the current ZIP uses **Load unpacked** in Chrome, Edge, Brave, Opera or Vivaldi on desktop.
3. Click **Connect extension** in your dashboard. Pin Atlas and start saving.

New captures save in your browser first and sync to the connected account when automatic sync is enabled. Saved pages include readable text and a traceable origin record rather than raw HTML. Open your [dashboard](https://atlas.notpritam.in/dashboard) to search, browse and control capture methods, popup layout, sync, OCR, summaries and tags across connected browsers.

Previous local captures stay local unless you explicitly import them. You can also use local capture without an account. Cloud and local copies are separate; deleting one does not erase the other. Accounts include up to 1,000 captures and 200 MiB of content.

To update an unpacked installation, replace its files in the existing folder and use **Reload** on the browser's extensions page. Keep the existing installation to retain the local library. Managed Chrome installations can receive signed updates from GitHub Releases.

[Full extension guide](apps/extension/README.md)

## Advanced local organization

Connect the [Atlas companion](apps/agent/README.md) in Settings for OCR, summaries, and tags:

```sh
npx @notpritam/atlas-agent
```

The default companion address is `http://127.0.0.1:8791`. It uses your Claude Code connection. Capture content sent to the companion may also be processed by its remote model provider. Capturing and keyword search work without it.

The customer extension has no agent-control overlay or debugger permission. Legacy integration source remains in the repository for existing backend clients.

## Repository

- `apps/extension` — Chromium MV3 capture popup, readable page extraction, durable account-bound sync queue and local IndexedDB library.
- `apps/web` — the landing page, account setup, customer dashboard and extension downloads, served at `atlas.notpritam.in`.
- `apps/agent` — optional organization companion.
- `apps/backend` — Bun/Hono customer accounts, private capture APIs and bounded organization worker. Separate legacy APIs support existing integrations.
- `apps/browser-mcp` — optional browser-control integration.
- `apps/desktop` — desktop client.
- `packages/shared` — schemas for server-backed clients.

## Develop and verify

```sh
bun install --frozen-lockfile --ignore-scripts
bunx playwright-core install chromium
bun test
bun run test:extension
bun run test:web
bun run test:customer
```

The customer integration test also needs Tesseract English OCR and util-linux (`prlimit`); see [customer operations](deploy/CUSTOMER_LAUNCH.md). The browser tests use temporary profiles and synthetic captures. `CHROMIUM_PATH` can select an existing Chromium executable.

For a populated review preview, run `node scripts/preview-server.mjs`, then open `http://localhost:9048/apps/web/`. The sample library is at
`http://localhost:9048/apps/extension/src/dashboard.html`; its runtime fixtures
are separate from the packaged extension.

[Deployment and release guide](deploy/README.md)
