# Atlas

**Found it? Keep it.** Screenshots, highlights, links, images, and stray ideas in your private, searchable library.

[Get Atlas](https://atlas.notpritam.in) · [Extension releases](https://github.com/notpritam/atlas/releases/latest) · [Privacy & data](https://atlas.notpritam.in/privacy.html)

## Start collecting

1. [Create an Atlas account](https://atlas.notpritam.in/signup) and save your recovery code.
2. Follow the installation steps in your dashboard. Chrome Web Store publication is pending; the current ZIP needs Chrome Developer mode and **Load unpacked**.
3. Click **Connect extension** in your dashboard. Pin Atlas and start saving.

New captures save in your browser first and automatically sync to the connected account. Open your [dashboard](https://atlas.notpritam.in/dashboard) from any browser to search and browse them. Cloud organization creates text extracts, topic tags and English screenshot OCR without a local companion.

Previous local captures stay local unless you explicitly import them. You can also use local capture without an account. Cloud and local copies are separate; deleting one does not erase the other. Accounts include up to 1,000 captures and 200 MiB of content.

To update an unpacked installation, replace its files in the existing folder and use **Reload** in Chrome. Keep the existing installation to retain the local library. Managed installations can receive signed updates from GitHub Releases.

[Full extension guide](apps/extension/README.md)

## Advanced local organization

Connect the [Atlas companion](apps/agent/README.md) in Settings for OCR, summaries, and tags:

```sh
npx @notpritam/atlas-agent
```

The default companion address is `http://127.0.0.1:8791`. It uses your Claude Code connection. Capture content sent to the companion may also be processed by its remote model provider. Capturing and keyword search work without it.

The customer extension has no agent-control overlay or debugger permission. Legacy integration source remains in the repository for existing backend clients.

## Repository

- `apps/extension` — Chrome MV3 capture popup, durable account-bound sync queue and local IndexedDB library.
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
