# Atlas

**Found it? Keep it.** Screenshots, highlights, links, images, and stray ideas in a searchable local library.

[Get Atlas](https://atlas.notpritam.in) · [Extension releases](https://github.com/notpritam/atlas/releases/latest) · [Privacy & data](https://atlas.notpritam.in/privacy.html)

## Start collecting

1. Download the extension ZIP from [atlas.notpritam.in](https://atlas.notpritam.in/#get) and extract it.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select the extracted folder containing `manifest.json`.
3. Pin Atlas. Capture a page, save a highlight, or write yourself a note.

Captures and images are stored in your browser profile. No account or companion is required to save, browse, or search. There is no automatic cloud sync.

To update an unpacked installation, replace its files in the existing folder and use **Reload** in Chrome. Keep the existing installation to retain the local library. Managed installations can receive signed updates from GitHub Releases.

[Full extension guide](apps/extension/README.md)

## Optional organization

Connect the [Atlas companion](apps/agent/README.md) in Settings for OCR, summaries, and tags:

```sh
npx @notpritam/atlas-agent
```

The default companion address is `http://127.0.0.1:8791`. It uses your Claude Code connection. Capture content sent to the companion may also be processed by its remote model provider. Capturing and keyword search work without it.

Existing browser-control integrations are available under advanced settings and use separate per-tab permission. They are not required for the capture library.

## Repository

- `apps/extension` — Chrome MV3 capture popup, local IndexedDB library, and optional integrations.
- `apps/web` — the production landing page and extension downloads, served at `atlas.notpritam.in`.
- `apps/agent` — optional organization companion.
- `apps/backend` — authenticated Bun/Hono service for server-backed Atlas clients, storage, enrichment, and relay integrations. The current browser capture library lives locally rather than uploading to this store.
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
```

The browser tests use temporary profiles and synthetic captures. `CHROMIUM_PATH` can select an existing Chromium executable.

For a populated review preview, run `node scripts/preview-server.mjs`, then open `http://localhost:9048/apps/web/`. The sample library is at
`http://localhost:9048/apps/extension/src/dashboard.html`; its runtime fixtures
are separate from the packaged extension.

[Deployment and release guide](deploy/README.md)
