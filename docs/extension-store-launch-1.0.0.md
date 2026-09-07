# Foundkeep Chrome Web Store launch — 1.0.0

## Release channels

The Chrome Web Store launch starts at `1.0.0`, sourced from `deploy/store-version.txt`. The existing self-hosted signed channel remains at `1.6.0`; it has a separate version history and cannot accept a lower-version update. The Web Store assigns a new extension ID on the first upload.

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

`<all_urls>` is required to capture on arbitrary customer-selected pages and retrieve the original bytes of a selected cross-origin image. The extension does not read pages in the background.

The required and optional listing images are generated under `deploy/dist/store-assets`. Store copy, privacy answers, permission justifications, data disclosures, distribution choices and reviewer instructions are in `deploy/STORE_LISTING.md`.

## Validation

- Backend security, account isolation, quota, image, enrichment and relay tests.
- Real Chromium extension capture, IndexedDB, pairing, sync, retry, security, keyboard, responsive UI and package tests.
- Landing-page and privacy-policy tests.
- Customer signup, recovery, account controls, pairing, capture, source provenance and cloud-library tests.
- Manual visual review at the popup’s 390×600 surface, the local library at 1440×1050, and all store asset dimensions.

## First-upload sequence

1. Upload the 1.0.0 ZIP as a new Chrome Web Store item without submitting it for review yet.
2. Copy the item’s assigned extension ID.
3. Add that ID alongside the established self-hosted ID in `apps/web/customer-config.json` and the production `ATLAS_CUSTOMER_EXTENSION_IDS` setting.
4. Deploy and verify pairing, preference refresh and sync with the store build.
5. Complete the Store listing, Privacy, Distribution and Test instructions tabs, then submit for automatic publication after review.
