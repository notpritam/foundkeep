# Foundkeep Chrome Web Store launch — 1.0.0

## Release channels

Foundkeep is publicly available from the Chrome Web Store at version `1.0.0`, sourced from `deploy/store-version.txt`. Its Store ID is `cficnecbdbiddngllpfbacabgbcjinmk`. The existing self-hosted signed channel is `1.6.1`; it has a separate version history and cannot accept a lower-version update.

## Customer flow

1. Install Foundkeep from the Chrome Web Store.
2. Save pages, highlights, links, images, screenshots and notes into the local IndexedDB library.
3. Optionally create an account at `foundkeep.app` and connect the browser with a short-lived, one-use pairing code.
4. New captures commit locally first and enter an account-bound durable upload queue when automatic sync is enabled.
5. The dashboard shows the synced library, source provenance and account-controlled capture and organization settings.

The extension contains no local companion, model-provider setup, relay, browser control, debugger permission, remotely executed code, advertising or behavior tracking.

## Captured origin record

Depending on the customer’s account settings and what the source page exposes, a saved page can retain readable text, headings, visited URL, canonical URL, target URL, page title, description, site name, authors, publication and modification dates, language, lead image URL, favicon URL, capture method, capture and extraction timestamps, extraction status, extractor version and a SHA-256 content fingerprint. Foundkeep does not save raw page HTML.

## Store package

Run:

```sh
bun run store:pack
bun run store:verify
bun run store:assets
```

Upload `deploy/dist/foundkeep-store-1.0.0.zip`. The package is deterministic, has `manifest.json` at its root, strips the self-hosted `key` and `update_url`, contains runtime files only, and declares these named permissions:

- `activeTab`
- `scripting`
- `contextMenus`
- `storage`
- `alarms`

Persistent host access is limited to `https://foundkeep.app/*` for account settings, data-only runtime policy, and capture sync. HTTP(S) host access is optional and requested only for the selected image's exact origin after the customer invokes **Save image**. Active-tab access covers explicit current-page capture, and the extension does not read pages in the background.

The required and optional listing images are generated under `deploy/dist/store-assets`. Store copy, privacy answers, permission justifications, data disclosures, distribution choices and reviewer instructions are in `deploy/STORE_LISTING.md`.

## Moving from the manual build

The Chrome Web Store assigns a new extension ID, so Chrome gives it a separate IndexedDB and extension-storage area. Before removing the manual build, connect it to the intended Foundkeep account, explicitly import any wanted local-only captures, and wait until its pending count reaches zero. Then install and connect the store build. Cloud captures appear in the same dashboard; unsynced local-only records cannot move automatically between extension IDs. During an overlap, the dashboard prefers the installed build already connected to the signed-in account.

## Validation

- Backend security, account isolation, quota, image, enrichment and relay tests.
- Real Chromium extension capture, IndexedDB, pairing, sync, retry, security, keyboard, responsive UI and package tests.
- Landing-page and privacy-policy tests.
- Customer signup, recovery, account controls, pairing, capture, source provenance and cloud-library tests.
- Manual visual review at the popup’s 390×600 surface, the local library at 1440×1050, and all store asset dimensions.

## Published listing

The public install URL is `https://chromewebstore.google.com/detail/cficnecbdbiddngllpfbacabgbcjinmk`. The assigned ID is present alongside the migration build in the website and backend allowlists. Chrome owns Store signing and automatically distributes approved updates.
