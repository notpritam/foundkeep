# FoundKeep — browser extension (Chromium MV3)

Keep readable page copies, screenshots, highlights, links, images, and notes with a record of where they came from. Connect your FoundKeep account so captures sync to your private dashboard.

## One floating dock for everything

Click the pinned FoundKeep toolbar icon to show or hide a small dock on the current page (click again to collapse it). Drag its grip to reposition it; it remembers where you left it. Expand the dock to save the current page, highlight text, take a screenshot, or write a note — each saves in one click. Its **⋯** menu opens **Library** (your FoundKeep dashboard), **Show on every site**, **Hide on this site**, **Import browser bookmarks**, and **Settings** (the account dashboard's browser-capture settings).

The initial toolbar click grants access to that page. To keep the dock (and capture) available after switching tabs without clicking the icon again, choose **Show on every site** from its **⋯** menu and accept Chrome's optional page-access prompt; **Hide on this site** turns it back off for one origin. Browser-internal pages cannot show the dock or be captured. A page change during a screenshot aborts the capture instead of saving the wrong tab.

## Saves are instant; details are optional

Every capture — dock actions, the X/Twitter button, right-click captures, and keyboard captures — saves straight to **My library** in the connected account, with the page's details captured automatically (URL, title, site, description, author and dates, headings and readable text). An account is required to save — the dock shows **Sign in to save** instead of its actions when signed out.

- **Save page** saves in one click.
- **Highlight** saves the selected text at once. With nothing selected it turns on highlighter mode (`Select text to save · Esc to stop`): every selection you make is saved and briefly flashed, until Esc or Highlight again.
- **Screenshot** goes straight to region selection, with a small toolbar in the tab's top-right corner — **Selection** · **Full page** · **✕**. Drag a region to save it, choose Full page to save the whole page, or press ✕ / Esc to cancel. Screenshots keep the page's details and readable text too, so they are findable. The dock hides while you capture.
- **Note** opens a small field next to the dock: Enter saves, Shift+Enter adds a line, Esc closes it. The page is attached when the notes preference says so. The field is a FoundKeep frame, so the page cannot read what you type.

After every save the dock shows **✓ Saved to My library · Add details** for about five seconds (hover or focus keeps it). **Add details** opens a small card on the page where you can change the title and note, add tags, choose or create a folder, or share the save to a collection. Edits apply to the save you just made: before it has uploaded they ride along with the upload; afterwards only the fields you changed are sent as an update, so changes made on the web or another device meanwhile are kept — and an edit made while the upload is in flight is sent as soon as it lands. Collection choices show their audience and approval rules; your personal note, folder and tags stay private, and images are shared only if you tick the image checkbox.

After updating the extension, refresh open X/Twitter tabs so they load the new FoundKeep button.

## Check the environment and version

For dev testing, use the extension built as **FoundKeep Dev**, then sign in to the same account at [your dev dashboard](https://dev.foundkeep.app/dashboard). The extension connects automatically; no Connect button is needed. The dashboard's Apps & devices page shows the detected extension's version and destination.

Save a note named **Dev sync test**. Confirm it appears in My library at `dev.foundkeep.app` under the same account. A local save or a pending upload is not yet a cloud save. The production library at `foundkeep.app` is separate.

To update an unpacked installation, replace the files in its existing folder and click **Reload** for **FoundKeep Dev** at `chrome://extensions`. Keep the existing extension installed to preserve its local saves and queue. The dev ID is `fngoidplpdpoamenhgpabbheghpkdkcb`.

## Install or update

There are separate development and production builds. Both can be installed in the same browser:

| Build | Destination | Local data |
| --- | --- | --- |
| **FoundKeep Dev** | https://dev.foundkeep.app | Separate extension identity, credentials, queue, and `atlas-dev` IndexedDB |
| **FoundKeep** | https://foundkeep.app | Existing production identity and `atlas` IndexedDB retained |

Download [FoundKeep Dev](https://dev.foundkeep.app/ext/foundkeep-extension-dev.zip) for dev testing, or use the production Chrome Web Store installation. Each website connects only its corresponding extension. The dev build has no production auto-update feed. Keyboard shortcuts may need separate assignments when both are installed; choose the extension by name at `chrome://extensions/shortcuts`.

1. Extract the extension ZIP into a folder you can keep, or use this `apps/extension` directory.
2. Open the extensions page in Chrome, Edge, Brave, Opera, or Vivaldi, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`. Chrome and Brave accept `chrome://extensions`; Edge uses `edge://extensions`.
3. Pin FoundKeep from the browser’s extensions menu.

To update an existing unpacked installation, replace its files in the existing folder and click **Reload**. Keep the existing installation to retain the local library. Uninstalling removes extension data. Managed installations can receive signed updates.

## Connect your account

Open [FoundKeep](https://foundkeep.app/dashboard), then create an account or sign in. The matching installed extension connects automatically from any dashboard page. Returning to the dashboard after installation checks again. A browser already connected to another account requires confirmation in Apps & devices; an explicit disconnect pauses automatic pairing until you choose to connect again. The website hands the extension a short-lived, one-use connection code. No developer token or separate software is required.

New captures made while an account is selected are saved locally and queued for that account. FoundKeep retries automatically after network failures when automatic sync is enabled. **Try sync again** requests an immediate retry; **Reconnect** appears if the browser credential expires or is revoked. Captures remain available locally throughout.

Existing local-only captures are never uploaded automatically. If any remain, the dock shows a **Move to My library** prompt (see **Your library** below); moving them uploads them to the signed-in account. Switching accounts never moves captures or pending uploads between accounts. Reconnecting the original account resumes its pending captures.

## Capture

- **Dock:** save a readable copy of the current page, highlight text, take a screenshot, or write a note.
- **Right-click:** save a selection, link, image, or page; take a region screenshot (the same corner toolbar) or a full-page screenshot. Saving an image asks for access to the image's site the first time (in a small FoundKeep window if Chrome cannot show the prompt from the menu).
- **Keyboard:** `Alt+Shift+S` and `Alt+Shift+F` open the screenshot corner toolbar (drag a region or choose Full page), and `Alt+Shift+H` saves selected text. Change assignments at `chrome://extensions/shortcuts`.
- **X / Twitter:** the FoundKeep button (the FoundKeep mark) in a post's action bar saves the author, text, and permalink in one click and turns green once saved. A post already saved in this browser session to the same account is not saved twice (unless that save failed).

On a site where the dock is hidden (**Hide on this site**), saves still work; the toolbar icon flashes ✓ instead of the dock appearing.

Page capture requires a normal web page. Chrome restricts capture on internal browser pages and certain protected pages. Notes can still be saved there. Saved images are limited to 8 MiB. A larger generated screenshot remains local with an actionable sync error.

Saving a page keeps the useful article or main text, available headings and structured page details. Its provenance record can include the exact visited URL, canonical URL, title, description, site, authors, publication and modification dates, language, lead image, favicon, capture method and timestamps, extractor version, extraction status, and a SHA-256 content fingerprint. Saved links and images also keep the containing page separately from the target. FoundKeep does not store raw page HTML.

## Capture settings

Open **Account & settings → Browser capture** in the FoundKeep dashboard to control capture methods, readable bookmark content, note source attachment, right-click actions, automatic sync, OCR, summaries, tags, and success feedback. The policy belongs to the customer account and is shared by its connected Chromium browsers. Saving it asks the installed extension to refresh immediately; the extension also refreshes on startup and keeps a brief account-bound cache for offline use.

FoundKeep also reads a validated data-only operator policy. It can globally disable an existing capture or sync feature and lower packaged size limits without downloading executable code. A cached or bundled safe policy is applied immediately so an offline capture never waits for the network. JavaScript, UI, permissions, origins, schemas, and capture algorithms still require a reviewed extension update.

Changing these settings does not require an extension update. Manifest permissions, capture engine changes, security fixes, or new extension code still require an updated extension build.

## Your library

The extension has no library browser of its own — the dock's **Library** action opens your FoundKeep dashboard, where every save (readable pages, screenshots, highlights, images, notes and collection entries) lives and can be searched, organized and exported.

Saves made before this version of the extension may still hold captures that were kept only in this browser. If any remain, the dock shows **N saves are only in this browser** with a **Move to My library** action (or **Later**, which reminds you again in about a week). Moving them uploads those local-only captures to your signed-in account; nothing is deleted from the browser in the process. The account dashboard has its own export and account-deletion controls.

The customer extension has no browser-control integration and does not request the debugger permission. This package supports Chromium browsers. Firefox and Safari builds are not currently shipped.

## Development checks

Run `bun run extension:build:dev` or `bun run extension:build:prod` from the repository root. Each command writes an unpacked folder, a ZIP, and its matching `customer-config.json` under `deploy/dist/extensions/dev` or `deploy/dist/extensions/prod`. Neither command edits the source identity or publishes a release. `apps/extension` remains the production source. See [environment deployment](../../docs/extension-configuration-and-updates.md#separate-development-and-production) for server configuration.

From the repository root:

```sh
bun install --frozen-lockfile --ignore-scripts
bunx playwright-core install chromium
bun run test:extension
```

Tests use temporary browser profiles and synthetic captures. Queue tests use real IndexedDB with controlled storage and API transport. The real MV3 smoke test uses Playwright’s Chromium channel. `CHROMIUM_PATH` can select an existing Chromium executable.

Run `node scripts/preview-server.mjs`; the website is at `/apps/web/` and the sample library at `/apps/extension/src/dashboard.html` on port 9048. Preview fixtures stay outside the packaged extension. Customer pairing is available only from the exact FoundKeep and legacy migration origins; integration tests rewrite a temporary extension copy for a loopback backend.
