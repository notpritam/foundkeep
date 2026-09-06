# Rich Capture, Provenance, and Customer Controls

## Goal

Atlas will preserve a useful, traceable record of every saved item, make bookmark saves into readable archives, give each customer account control over supported extension behavior, and keep the Chrome popup reliable within the browser's fixed popup viewport.

## Product decisions

- Customers own preferences. Atlas operators do not receive a hidden policy surface for changing an account's behavior.
- Account preferences apply to every browser connected to that account. A connected extension caches the last valid settings for offline use.
- Local-only users continue to use safe built-in defaults. Existing local captures are never uploaded without the current explicit import step.
- Bookmark capture stores readable text and bounded structured metadata. It does not store or replay page HTML, scripts, trackers, cookies, form values, referrers, or browsing history.
- Atlas keeps both the exact visited URL and the page-declared canonical URL. Canonical metadata never replaces the actual location the customer captured.
- Manifest permissions, content-script declarations, shortcut registration, new executable capabilities, and security fixes still require an extension release. Values and layouts already represented in the versioned preference contract do not.

## Capture provenance

Every new capture may include a `provenance` object with schema version 1:

```json
{
  "schemaVersion": 1,
  "captureMethod": "popup-save-page",
  "pageUrl": "https://example.com/posts/42?source=feed",
  "canonicalUrl": "https://example.com/posts/42",
  "pageTitle": "A useful article",
  "siteName": "Example",
  "description": "A concise page description.",
  "authors": ["A. Writer"],
  "publishedAt": "2026-08-14T09:30:00Z",
  "modifiedAt": "2026-08-15T11:00:00Z",
  "language": "en",
  "leadImageUrl": "https://example.com/images/42.jpg",
  "faviconUrl": "https://example.com/favicon.ico",
  "targetUrl": null,
  "capturedAt": 1786013400000,
  "extractedAt": 1786013400123,
  "extractorVersion": 1,
  "contentHash": "sha256-base64url"
}
```

All URL fields accept only credential-free HTTP(S) URLs and have bounded lengths. Authors are plain-text names with a small bounded count. Dates are normalized ISO strings when the source supplies valid values. The hash covers normalized readable text; it is evidence that the stored text corresponds to the captured extraction, not a claim that the live source will never change.

Capture methods distinguish popup, keyboard shortcut, context-menu selection/link/image, X/Twitter action, extension note, and local-library note. For a saved link, `pageUrl` identifies the containing page and `targetUrl` identifies the selected link. For a saved image, `pageUrl` identifies the containing page and `targetUrl` identifies the image URL. The existing `sourceUrl` remains the primary destination shown by old clients.

## Bookmark extraction

The extension injects a self-contained extractor into the active HTTP(S) tab when the customer invokes Save page. It collects safe metadata from the document, Open Graph fields, standard author/date elements, and selected JSON-LD Article fields. It chooses the most likely article container, removes navigation, controls, ads, scripts, styles, and hidden content, then emits normalized visible text and headings. If no article container is credible, it falls back to bounded visible body text.

The local record is committed before cloud upload starts. Extraction failures fall back to the page URL/title and are reported as a partial save rather than losing the bookmark. Article text is capped at 100,000 characters to match the API. The backend validates every structured field independently and never trusts metadata to choose ownership.

## Customer preferences

The backend adds one owner-scoped `customer_preferences` row per account. It contains a validated JSON document, revision, and update time. `GET /api/preferences` accepts either a website session or connected-browser bearer credential. `PUT /api/preferences` requires the website session and the existing account-intent header, so browser credentials can read behavior but cannot silently rewrite account settings.

Version 1 supports:

- Enable/disable region screenshot, full-page screenshot, highlight, bookmark, image, tweet, and note capture surfaces.
- Order the four popup capture actions.
- Choose whether bookmark saves include readable text, extended metadata, and headings.
- Choose whether notes attach the current page as their source.
- Choose whether recent items appear in the popup and how many appear, from zero to five.
- Enable/disable automatic cloud upload, image OCR, generated summaries, and generated tags.
- Enable/disable success feedback and the extension context-menu actions.

Defaults preserve today's behavior, with readable bookmark text and full provenance enabled. Unknown keys are rejected on writes and ignored safely by older readers. The backend responds with the complete normalized document so extensions never need to merge partial server state.

Connected extensions fetch preferences after pairing, at startup, when the popup opens, before a stale cached configuration is used, and every five minutes through the existing alarm. The cache records account ID, revision, value, and fetch time. Network failure uses the cached value; missing or invalid cache uses built-in defaults. Switching accounts never reuses another account's cached preferences.

Disabling automatic upload keeps newly captured records bound to the current account but queued locally until the customer re-enables upload. Disabling capture features removes or disables their UI and context-menu entry, while already saved records remain intact. Enrichment preferences are snapshotted into each uploaded capture so later settings changes do not rewrite the processing promise made at save time.

## Multiple browsers

Atlas continues to issue a separate revocable connection token for every installed browser. Every browser has its own local IndexedDB library and durable outbox. All successfully uploaded captures appear in the shared account library.

Pairing supplies a useful browser label derived locally from browser and operating-system information without adding fingerprinting libraries. The account screen shows the label, connection date, last activity, and revoke action. Account preferences are shared; local IndexedDB contents, upload queues, and extension removal remain device-specific.

## Popup structure

The popup remains an Operator-mode surface in the existing Studio visual system. Its task order is:

1. Current account/sync state and page identity.
2. One leading Save page action with a plain explanation that readable content and source details will be preserved.
3. Remaining enabled capture actions in a stable grid.
4. Compact note composer.
5. Optional recent items.
6. Fixed library/settings footer.

The body is 392 pixels wide and never exceeds Chrome's 600-pixel popup height. Only the main content region scrolls. Header and footer remain visible. Loading cloud preferences reserves space instead of changing the layout after paint. Capture actions stay open long enough to show extracting, saved locally, queued, synced, or actionable failure feedback. Keyboard focus remains visible and follows DOM order. Long titles, localized labels, empty recent lists, disconnected accounts, offline state, and five recent items must not overflow horizontally or obscure the footer.

## Dashboard

Account settings gain an Extension preferences section with grouped native controls and immediate save status. Preferences are fetched from and saved to the authenticated backend. The currently open connected extension receives a trusted refresh message after a successful save; other connected browsers observe the new revision on their next poll.

Capture cards continue to favor readable content. Bookmark detail adds an Origin section with actual page URL, canonical URL when different, site, authors, publication/modification dates, capture time, extraction status/version, and a source link. All rendered metadata is inserted as text, and links pass the existing safe-URL check.

## Storage and API

The existing `customer_captures` table gains `provenance_json` and `processing_options_json` columns through an additive migration. Local IndexedDB remains at version 1 because IndexedDB records are schemaless; new fields are optional.

The customer capture API accepts bounded provenance and processing options, includes normalized provenance in list/detail/export responses, and searches article text plus existing fields. Per-account quotas include the UTF-8 bytes of both JSON documents. The existing `(account_id, client_id)` uniqueness remains the retry/idempotency boundary.

## Failure behavior

- Extraction failure: save URL/title and a provenance error indicator locally, then sync the partial bookmark.
- Preference fetch failure: use same-account cache or built-in defaults and show a non-blocking stale state in settings.
- Preference validation failure: retain the last good value and show field-level dashboard errors.
- Offline save: commit locally and queue according to the cached automatic-upload preference.
- Revoked browser: preserve local records and require reconnection before uploads or preference refreshes resume.
- OCR/organization failure: preserve original capture and metadata, using the existing bounded retry behavior.

## Verification and release

Tests cover metadata extraction from representative article, non-article, malformed JSON-LD, and hostile pages; provenance validation and tenant isolation; preference normalization, mutation authorization, account cache isolation, feature visibility, context-menu reconciliation, upload behavior, and enrichment choices; multi-browser uploads into one account; popup geometry, long-content states, focus, loading, offline, and errors; and the full signup/pair/save-page/dashboard flow.

After automated checks, package the signed extension as version 1.5.0, deploy backend and web assets, verify the live API/site, publish GitHub release `ext-v1.5.0`, and confirm downloadable ZIP/CRX identity and contents. Chrome Web Store publication remains separate because it requires the publisher account and Google review.
