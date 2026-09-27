# FoundKeep extension configuration and updates

FoundKeep uses two update paths with a strict boundary between account data and executable extension code.

## Live account controls

The dashboard stores one validated preferences document per account. Connected extensions read it over authenticated HTTPS, cache it for at most five minutes, and retain the last valid copy when offline. Saving settings from a dashboard that can detect the extension triggers an immediate revision-checked refresh.

| Area | Live controls |
| --- | --- |
| Capture methods | Page, highlight, region, full page, image, X post, note |
| Bookmark copy | Readable text, extended metadata, heading outline |
| Notes | Attach the open page as the note source |
| Popup | Secondary action order, recent section, recent item count |
| Sync | Automatic cloud upload |
| Automatic context | OCR, summaries, tags |
| Feedback | Success badge |
| Browser menus | Right-click actions |

These 20 values change extension behavior without repackaging or waiting for a store release. The server validates the exact schema before saving it. The extension validates it again before applying it. A bad response falls back to the last valid cache or built-in defaults.

## Operator controls

FoundKeep also publishes a strictly validated data-only policy at `/extension-policy.json`. It can disable any capture method, automatic sync, or browser context menus globally, and can lower the packaged limits for article text, selected text, images, full-page pixels, and full-page height. It cannot enable a feature the customer disabled, raise a packaged safety ceiling, add permissions, change network destinations, or execute code.

The extension uses a valid cached policy immediately and refreshes it every minute. On a cold or offline start it applies the bundled safe policy without delaying a local save, then refreshes in the background. Change the policy's `revision` whenever publishing a new document so an older response can never replace a newer cached revision.

## Changes that require a store release

The following are executable or privileged extension behavior and therefore ship only through a new reviewed package:

- JavaScript, HTML, CSS, or packaged assets
- Manifest permissions, host access, keyboard commands, content scripts, and externally connectable origins
- Capture algorithms, extraction fields, storage schema, encryption or authentication behavior
- New browser APIs or new kinds of network access
- The fixed FoundKeep API origin

Manifest V3 and Chrome Web Store policy prohibit using remotely hosted JavaScript or an arbitrary over-the-air code loader. FoundKeep intentionally fetches JSON account configuration only. Store updates are automatic after Google approves a new version, so customers normally do not need to update the extension by hand.

The manual self-hosted build has its own signed update channel and version history. The Chrome Web Store channel starts at `1.0.0` and omits the self-hosting `key` and `update_url` fields because Google owns signing, identity, and updates for that channel.

## Separate development and production

`bun run extension:build:dev` creates **FoundKeep Dev**, ID `fngoidplpdpoamenhgpabbheghpkdkcb`, targeting only `https://dev.foundkeep.app`. Its fixed public key is tracked in `deploy/extension-dev-identity.json`; never regenerate it for an update. It is an unpacked development build with no signed update feed. The public key fixes its browser identity; no private signing key is included or needed for loading unpacked.

`bun run extension:build:prod` creates the production manual build, preserving ID `mjfcgmboaijfcaanepdipbgmipnccnpn`, the existing database name, and the signed production update URL. The separate Web Store packaging command remains `bun run store:pack`. Both packaging paths read `deploy/extension-files.json` so they contain the same application modules.

The separate IDs isolate Chrome storage, credentials, offline queues, and IndexedDB even in one browser profile. Development also uses database name `atlas-dev`; production keeps `atlas` so updates retain existing captures. Capture uploads, policies, preferences, pairing, library requests, and dashboard links all follow the packaged origin. There is no runtime environment switch or automatic data migration.

For dev deployment, create a new static asset release under `/home/pritam/.local/share/foundkeep-dev-web/releases`. Copy `apps/web` into it, overwrite `customer-config.json` with the generated dev config, place the dev ZIP at `ext/foundkeep-extension-dev.zip`, and replace both generic extension ZIP aliases with that dev ZIP. Remove copied production CRXs and update manifests from this dev release. Atomically set `/home/pritam/.local/share/foundkeep-dev-web/current` to the new release.

The dev backend service uses:

```ini
Environment=ATLAS_WEB_DIR=/home/pritam/.local/share/foundkeep-dev-web/current
Environment=ATLAS_CUSTOMER_EXTENSION_IDS=fngoidplpdpoamenhgpabbheghpkdkcb
```

An explicit `ATLAS_CUSTOMER_EXTENSION_IDS` is a complete allowlist, replacing production defaults. Keep `ATLAS_DATA_DIR=/home/pritam/.local/share/foundkeep-dev` and `ATLAS_CUSTOMER_ORIGINS=https://dev.foundkeep.app`. Restart only the dev backend for these settings, then deploy the customer site following `deploy/NEXT_WEB.md`. Production retains its separate `/home/pritam/.local/share/atlas` database and its existing extension IDs.

Verify `/customer-config.json`, `/extension-policy.json`, `/ext/foundkeep-extension-dev.zip`, and the dev Apps & devices installation flow. `tests/extension-environments-browser.mjs` loads both real MV3 builds in one temporary profile against two disposable databases, verifies pairing, local/cloud isolation, cross-environment token rejection, and offline dev saves while production continues syncing. Never use existing customer databases for this test.

## Automatic connection (extension 1.7.4)

An authenticated dashboard checks the configured environment’s extension IDs on mount and window focus. A compatible unpaired extension connects with an account-bound one-use code; an expired connection can renew only for the same account. Repeated checks reuse the existing connection. The web shell coalesces overlapping checks, and the extension rechecks account ownership before storing a claimed credential. An explicit account switch still uses the existing confirmation flow.

The `atlas-ping` response advertises `autoConnect` support, its bound account (including when its token needs renewal), and an explicit-disconnect pause. `atlas-auto-connect` accepts only a one-use code and the expected account ID, from the same trusted top-level origins as manual pairing. The extension never accepts a caller-selected destination or credential. It revokes unsuccessful stale/mismatched claims, and a pending automatic claim cannot overwrite a newer manual choice or disconnect. Local historical saves are not imported by automatic pairing. Older extension versions retain manual connection until updated.

`tests/next-extension-autoconnect.mjs` verifies the real extension and Next shell: automatic connection from My library, a cloud note save, deduplication across routes/focus, account-switch confirmation, and an explicit disconnect that stays disconnected. Use a disposable backend, or `FOUNDKEEP_ALLOW_DEV_TEST=1 BASE_URL=https://dev.foundkeep.app` for temporary dev-only accounts that the test deletes afterward. Production is rejected.

## Floating dock entry point (extension 1.7.5–1.7.12; replaced the side panel in 1.7.13)

**Superseded.** Extension 1.7.5 gave the toolbar action a native Chrome side panel (`src/library.html`) with no popup — capture controls, quick notes, local saves, account settings, account search/editing, folders and bookmark imports all lived in that one panel. 1.7.13 removed the side panel, the popup and the local-library dashboard entirely (`manifest.json` no longer declares `sidePanel`; `library.html`/`popup.html`/`dashboard.html` and their scripts are deleted) and replaced them with a floating **dock**.

The toolbar action has no popup and no side panel. Clicking it shows or hides a small dock on the current page (clicking an already-expanded dock collapses it); dragging its grip repositions it, and the position is remembered. Capture actions (save page, highlight, region/full-page screenshot, note) expand from the dock; its **⋯** menu opens **Library** (the FoundKeep dashboard), **Show on every site**, **Hide on this site**, **Import browser bookmarks** (the standalone `src/import.html` page) and **Settings** (the dashboard's browser-capture settings). There is no packaged page left for account search/editing or local-library browsing — that lives entirely on the dashboard now.

Capture messages include the displayed tab ID and URL. The worker checks them before capture and checks the active tab before/after screenshot reads. Region completion or cancellation reopens the review card without losing the draft. Note drafts survive failures; notes and captures retain the existing account-bound durable queue and environment isolation.

`<all_urls>` is optional, requested only from the dock's **⋯** menu → **Show on every site**. Chrome's `captureVisibleTab` requires activeTab or all-URL access; a per-site grant alone does not enable screenshots across tabs. The initial toolbar grant still works without this optional permission. Install-time permissions stay unchanged.

`tests/extension-dock-ui.mjs` and `tests/extension-dock-flow.mjs` open the real dock and its review card in a real MV3 worker and cover stale-tab rejection and a real region-drag screenshot; `tests/extension-review.mjs` covers the review card directly. The side panel's own action test (`tests/extension-action.mjs`) is deleted along with the side panel.

## Destination review (extension 1.7.6)

X/Twitter content-script buttons open the review card (framed in the dock, or a fallback popup window) from the click's user gesture and stage the exact tweet text/author/permalink. Dock capture actions and notes, context menus, and keyboard captures use the same destination review. Staging never writes a library record or uploads content. Pending requests are tab-scoped, bound to the current account, and kept in trusted `chrome.storage.session` for up to 30 minutes so worker suspension does not lose the review. Explicit Cancel removes the request; the next save also restores an outstanding review.

Confirmation validates the account and selected folder/collection again. Collection review displays visibility, submission rules and the exact shared fields; images require an explicit checkbox. A stable capture ID makes a retry after worker interruption idempotent. The private capture stores `folderId` and optional `collectionSubmission` alongside its existing account-bound outbox. Upload retries retain the chosen destination, persist the remote capture ID before collection submission, and reuse a stable submission client ID. Changing collection visibility/access stops sharing with a recoverable local error. Existing captures and identities are preserved without a database migration.

`tests/extension-review.mjs` exercises the review card, cancellation, confirmation and draft restoration (including across a fresh module instance and a changed account); `tests/extension-dock-flow.mjs` covers the same for the X content script. The cloud tests cover folder delivery, ambiguous collection acknowledgements and visibility changes.

## Appearance and remaining entry points (extension 1.7.7)

All packaged extension screens use the website's Inter font and a shared green light/dark palette, reacting to the device's system appearance. The sidebar's own System/Light/Dark picker described above no longer exists after 1.7.13 removed the side panel; the equivalent manual override now lives on the dashboard (Settings → Appearance, `apps/site/components/appearance/theme.tsx`), independent of the extension's own storage.

Right-click image capture requests host permission on the final confirmation gesture, after destination selection. Non-note/non-tweet captures recheck the target tab at confirmation. Internal capture messages are restricted to trusted packaged UI senders (`src/review.html`, `src/import.html`, `src/dock-settings.html`).

The complete entry-point audit and the next social-media preservation design are in [the 14 September audit](beta/2026-09-14-extension-audit-and-social-media.md). The 1.7.7 extension release does not introduce the new multi-asset/transcription backend.
