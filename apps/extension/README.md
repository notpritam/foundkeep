# Atlas Capture — browser extension (Chrome MV3)

Keep screenshots, highlights, links, images, and notes in a local visual library.
No account or companion is required to capture, browse, or search. No build step.

## Install or update

1. Extract the extension ZIP into a folder you can keep, or use this `apps/extension` directory.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
3. Pin Atlas from Chrome’s extensions menu. Open the popup to capture a page or write a note.

To update an existing unpacked installation, replace the files in its existing folder and click **Reload** in `chrome://extensions`. Keep the existing installation to retain its local library. Uninstalling removes extension data.

## Capture

- **Popup:** select a region, capture a full page, save selected text, save a link, or write a note. Notes also save with ⌘/Ctrl + Enter.
- **Right-click:** save a selection, link, image, or page; capture a region or full-page screenshot.
- **Keyboard:** `Alt+Shift+S` captures a region, `Alt+Shift+F` a full page, and `Alt+Shift+H` selected text. Change assignments at `chrome://extensions/shortcuts`.
- **X / Twitter:** the Atlas button in a tweet’s action bar saves the author, text, and permalink.

Page capture requires a normal web page. Chrome restricts capture on internal browser pages and certain protected pages.

## Your library

Choose **Open library** in the popup. Browse visual captures, filter by type, tag, or category, sort by date, and search by keyword. Open a capture to read its saved content or return to its source. Create a note directly in the library with **New note**.

Captures and images are stored in IndexedDB in this browser profile. There is no automatic cloud sync. **Settings → Export metadata** downloads text, links, and metadata as JSON; it does not include image files and is not a complete backup.

## Optional organization

In **Settings**, turn on **Organize automatically** to use the Atlas companion for OCR, summaries, and tags. Open **Set up the companion** for its address and startup command:

```sh
npx @notpritam/atlas-agent
```

The default companion address is `http://127.0.0.1:8791`. It needs your Claude Code connection. Save settings to apply changes. If the companion is unavailable, captures remain saved and wait for organization.

Organization sends capture content to your configured companion. Its model provider may process that content remotely. Running the companion locally does not mean all processing stays on your computer.

## Advanced browser control

Existing local bridge and hosted relay settings are available under **Settings → Advanced: browser control**. Set a `ws://` or `wss://` relay address and account token for a hosted connection, or leave the relay address blank to use the local bridge. Enable the on-page Agent button to grant access to an individual tab. Control is separate from the capture library.

## Development checks

From the repository root, run `bun install --ignore-scripts`, install Chromium with `bunx playwright-core install chromium`, then run `bun run test:extension`.

For an existing browser installation, set `CHROMIUM_PATH` to the Chromium executable. `PLAYWRIGHT_MODULE` can point to an existing `playwright-core` module. The tests use temporary browser profiles and synthetic captures.

Run `node scripts/preview-server.mjs` for the sample website and library preview on port 9048. Demo fixtures stay outside the packaged extension.
