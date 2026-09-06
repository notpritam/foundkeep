# Atlas Capture — browser extension (Chromium MV3)

Keep readable page copies, screenshots, highlights, links, images, and notes with a record of where they came from. Connect your Atlas account to sync new captures to a private dashboard, with a local library available offline.

## Install or update

1. Extract the extension ZIP into a folder you can keep, or use this `apps/extension` directory.
2. Open the extensions page in Chrome, Edge, Brave, Opera, or Vivaldi, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`. Chrome and Brave accept `chrome://extensions`; Edge uses `edge://extensions`.
3. Pin Atlas from the browser’s extensions menu.

To update an existing unpacked installation, replace its files in the existing folder and click **Reload**. Keep the existing installation to retain the local library. Uninstalling removes extension data. Managed installations can receive signed updates.

## Connect your account

Choose **Connect Atlas** in the popup, create an account or sign in at [Atlas](https://atlas.notpritam.in/dashboard.html), then connect this browser from the dashboard. The website hands the extension a short-lived, one-use connection code. No developer token or companion setup is required.

New captures made while an account is selected are saved locally and queued for that account. Atlas retries automatically after network failures when automatic sync is enabled. **Try sync again** requests an immediate retry; **Reconnect** appears if the browser credential expires or is revoked. Captures remain available locally throughout.

Existing local captures are never uploaded automatically. To include them, open **Settings → Import local captures**, review the destination account, then confirm. Switching accounts never moves captures or pending uploads between accounts. Reconnecting the original account resumes its pending captures.

## Capture

- **Popup:** save a readable copy of the current page, select a region, capture a full page, save selected text, or write a note. Notes also save with ⌘/Ctrl + Enter.
- **Right-click:** save a selection, link, image, or page; capture a region or full-page screenshot.
- **Keyboard:** `Alt+Shift+S` captures a region, `Alt+Shift+F` a full page, and `Alt+Shift+H` selected text. Change assignments at `chrome://extensions/shortcuts`.
- **X / Twitter:** the Atlas button in a tweet’s action bar saves the author, text, and permalink.

Page capture requires a normal web page. Chrome restricts capture on internal browser pages and certain protected pages. Notes can still be saved there. Cloud uploads allow images up to 8 MiB; larger images remain local with an actionable sync error.

Saving a page keeps the useful article or main text, available headings and structured page details. Its provenance record can include the exact visited URL, canonical URL, title, description, site, authors, publication and modification dates, language, lead image, favicon, capture method and timestamps, extractor version, extraction status, and a SHA-256 content fingerprint. Saved links and images also keep the containing page separately from the target. Atlas does not store raw page HTML.

## Capture settings

Open **Account & settings → Browser capture** in the Atlas dashboard to control capture methods, readable bookmark content, note source attachment, popup action order and recent items, right-click actions, automatic sync, OCR, summaries, tags, and success feedback. The policy belongs to the customer account and is shared by its connected Chromium browsers. Saving it asks the installed extension to refresh immediately; the extension also refreshes on startup and keeps a brief account-bound cache for offline use.

Changing these settings does not require an extension update. Manifest permissions, capture engine changes, security fixes, or new extension code still require an updated extension build.

## Your libraries

**Open dashboard** opens the private account library, including organized text, screenshots, capture settings, and a source record for traceable captures. **Local library** opens captures stored in this browser: browse, filter, sort, search by keyword, open details, or create a note. Local library notes follow the same account binding and sync queue as popup captures.

Local copies remain in IndexedDB. Deleting a local copy does not delete a synced account copy; use the account dashboard to manage that copy. Local **Export metadata** includes text and metadata but not image files, so it is not a complete backup. The account dashboard has its own export and account-deletion controls.

You can also use Atlas without an account. Disconnected captures stay local until you explicitly import them. Disconnecting keeps existing pending captures assigned to their original account. Manage and revoke connected browsers in your account dashboard.

## Optional local organization

When no account is selected, **Settings → Advanced: local companion** retains the optional companion for local-only captures:

```sh
npx @notpritam/atlas-agent
```

The default address is `http://127.0.0.1:8791`. The companion uses your Claude Code connection; its model provider may process capture content remotely. Saving and keyword search work without it. Connected account captures use Atlas’s organization service and are never sent to this companion.

The customer extension does not activate the legacy browser-control integration or request the debugger permission. This package supports Chromium browsers. Firefox and Safari builds are not currently shipped.

## Development checks

From the repository root:

```sh
bun install --frozen-lockfile --ignore-scripts
bunx playwright-core install chromium
bun run test:extension
```

Tests use temporary browser profiles and synthetic captures. Queue tests use real IndexedDB with controlled storage and API transport. The real MV3 smoke test uses Playwright’s Chromium channel. `CHROMIUM_PATH` can select an existing Chromium executable.

Run `node scripts/preview-server.mjs`; the website is at `/apps/web/` and the sample library at `/apps/extension/src/dashboard.html` on port 9048. Preview fixtures stay outside the packaged extension. Customer pairing is available only from the production Atlas origin; integration tests rewrite a temporary extension copy for a loopback backend.
