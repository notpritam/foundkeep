# Foundkeep extension 1.0.0 launch audit

Audit date: 2026-09-07

## Result

The customer extension, dashboard, account API, local-first queue, store package and reviewer path were reviewed together. The release package remains Chrome Web Store version `1.0.0`. Its only external launch gate is the new extension ID that Google assigns on the first dashboard upload; that ID must be added to the website and backend allowlists before submitting the item for review.

## Data flow verified

1. A customer invokes a capture from the popup, keyboard shortcut, right-click menu, X action, or local library.
2. The extension records the selected content and a provenance envelope in its own IndexedDB before reporting success. Images remain as Blob values; capture and connection settings use `chrome.storage.local`.
3. If an account is connected, the record is bound to that account and enters a durable, idempotent upload queue. Offline and interrupted uploads remain local and retry without changing owners.
4. The Foundkeep API authenticates the extension with a separately revocable bearer credential, validates and bounds every field, verifies PNG/JPEG/WebP signatures, and stores owner-scoped captures in SQLite.
5. The dashboard authenticates with an HttpOnly cookie. Library reads, image reads, export and deletion require the website session and the original account. An extension bearer can upload, read preferences and disconnect itself, but cannot read or delete the cloud library.
6. The dashboard renders capture text as text, validates same-origin image paths and exposes the original, canonical and target URLs from the stored provenance record.

## Findings closed for 1.0.0

- Moved article hashing into the extension service worker so readable bookmarks work on ordinary HTTP pages.
- Increased the bounded readable copy to 500,000 characters and records intentionally shortened copies as `partial` instead of `complete`.
- Preserved the last valid account controls during reconnect rather than enabling bundled defaults.
- Made an explicit **Try sync again** bypass the automatic-sync pause for that one customer request.
- Matched image producers to the API: only PNG, JPEG and WebP can be saved for cloud sync.
- Bounded selected text, link titles, image streams, full-page dimensions, pixel area and final encoded bytes before saving.
- Restored the page's scroll position and inline scroll behavior after full-page capture, including error paths.
- Replaced full-library reads in the popup, cloud queue and status panel with IndexedDB cursors and compound indexes. A v1-to-v2 migration test proves existing captures survive the upgrade.
- Rejected obvious private-network image targets, redirecting image responses, synthetic X action clicks and oversized streaming image bodies.
- Removed query-string bearer authentication from the legacy API. Legacy multipart uploads now accept only signature-verified PNG/JPEG/WebP bytes, and blob responses carry sandbox, anti-sniffing and same-origin resource headers.
- Reduced persistent host access to `https://foundkeep.app/*`. Other HTTP(S) origins are optional and requested only for the selected image's exact origin after a customer gesture.
- Added HSTS, removed an unused duplicate SVG and removed stale UI CSS.
- Made dual-install detection prefer the build already connected to the dashboard's signed-in account.

## Live controls and update boundary

Twenty account settings control capture methods, bookmark detail, note sources, popup layout, automatic sync, OCR, summaries, tags, feedback and context menus. A second exact-schema operator policy can globally disable packaged capture/sync/menu features and lower packaged article, selection, image and full-page limits. Both documents are data only, validated before use and cached for offline operation. A cold local save uses the bundled safe policy immediately while refreshing in the background.

Foundkeep does not download or execute remote JavaScript, WASM, HTML templates or arbitrary rules. JavaScript, HTML, CSS, permissions, content-script matches, origins, storage migrations, schemas and capture algorithms require a new Chrome Web Store package. Google distributes approved store updates automatically.

## Package and permission review

- Manifest V3; store version `1.0.0`.
- Named permissions: `activeTab`, `scripting`, `contextMenus`, `storage`, `alarms`.
- Persistent host: `https://foundkeep.app/*`.
- Optional hosts: HTTP and HTTPS, requested at the selected image's exact origin only.
- No `debugger`, remote executable code, signing key, self-hosted `key`, `update_url`, agent, relay, companion, or browser-control files.
- ZIP creation is deterministic, uses an explicit runtime-file allowlist and maximum DEFLATE compression. Source remains readable for Chrome Web Store review; minification would save little at this size and reduce auditability.

## Release evidence

- Real Chromium MV3 flows cover page text, highlights, region and full-page screenshots, notes, IndexedDB, account preferences and the local library.
- Queue tests cover pairing origin boundaries, account switching, offline/restart recovery, idempotency, revocation, reconnect and manual retry.
- Backend tests cover account isolation, password/recovery, CSRF, quotas, body deadlines, image signatures, bearer scope, query-token rejection, safe blob delivery and enrichment.
- Browser tests cover signup, pairing, settings, cloud sync, provenance display, image access, export/revoke/delete, responsive layouts and dual-install selection.
- Store verification rebuilds the ZIP twice and requires identical SHA-256 hashes.

Final pass counts and artifact hashes are recorded in the generated submission kit's `SHA256SUMS` and release handoff.

## Known boundaries

- A bookmark is a bounded readable-text copy plus source metadata, not raw HTML or a complete offline mirror of scripts, styles, media and subresources.
- Chrome is the reviewed distribution channel. Chromium-family browsers share the required MV3 APIs, but Firefox and Safari are outside 1.0.0.
- A Web Store build receives a new extension ID and therefore cannot read the manual build's local-only IndexedDB data. Customers must sync wanted records before removing the manual build.
- The first Web Store upload must remain unpublished until its assigned ID is added to both allowlists and the exact uploaded build completes the cloud flow.
