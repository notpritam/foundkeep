# Recent saves and flowing collections

September 10, 2026.

## Behavior

- Customer web dashboard and iPhone gallery use masonry: natural card heights, bounded image proportions, and consistent space between neighbors. Cards remain in chronological DOM/accessibility order. The native gallery mounts a window of cards during scrolling; large text switches to one column and screen-reader mode preserves access to every loaded card.
- All shows the newest arrivals in the collection, using server `created_at` with a stable ID tie-breaker. A save uploaded later from an offline device appears at the top even when its original capture date is old. Explicit All resets filters and returns to the top. Original capture dates remain available in source details.
- Visible collections refresh automatically approximately every 15 seconds and on foreground/focus. Native pagination retains already-loaded older saves during background refresh. Processing items use a shorter polling interval; failures back off.
- Source labels identify services such as YouTube, Instagram, GitHub, or the original website domain. Separate saving-channel labels identify iPhone, browser extension, or web dashboard. Source URLs and provenance remain available in the reader. Unknown legacy channels stay unknown rather than guessing.
- The server records the saving channel from the authenticated connection, not a caller-supplied label. This works with the existing browser extension; no Chrome package update is needed. Existing captures use recognizable provenance where available.
- Dashboard refreshes request bounded card excerpts. Opening a save still retrieves its full content. No native dependencies, capabilities, or app version changed.

## Data and rollout

Migration 14 adds a nullable saving-channel column and an account/recent-order index. Existing records, timestamps, credentials, and content are preserved. A consistent SQLite backup was taken before deploying the migration. The production backend passed its health check after restart.

Website source: `51c4caf`; mobile source: `e5ef6de`. The website was packaged as an immutable standalone release and activated through an atomic symlink switch. The previous release remains available for rollback. Public landing, login, unauthenticated dashboard redirect, and backend health checks passed.

## Verification

- Mobile and website TypeScript checks passed; 55 mobile tests passed.
- Backend customer, organization, and related-save suites passed (62 tests, 1,221 assertions), along with two migration checks and the focused card-excerpt regression.
- Compiled browser checks passed for both clients. Coverage includes newest cross-device arrivals with an old capture timestamp, source/channel labels, variable card heights, consistent gaps, image loading, sidebar reading, and phone widths down to 320 px.
- Native iPhone 17 / iOS 26.5 simulator checks passed: email login, mixed card gallery, image reader, editing, collapse/reveal, Gallery/You navigation, automatic newest arrival, pagination through 61 saves, All returning to the newest item, and accessibility large text. Source/channel badges were visually checked in the native screenshots. Initial harness failures came from stale form text and a selector for text grouped inside an accessible card; corrected selectors passed.
- The native fingerprint matches existing TestFlight **1.0.0 (15)**: `03660500bff0bed464c73b169d8c9f0d01e85f19`. This was simulator testing, not a test on the user's physical phone.
- Full backend TypeScript still reports existing errors in the unchanged agent capture handler and older backend test response types. The changed customer backend files have no reported type errors.

Evidence: `.impeccable/review/masonry-web/`, `.impeccable/review/masonry-native/`, and `.impeccable/review/gallery/19-recent-masonry.png`.

## Published iPhone update

- Personal Expo owner: `notpritam`; production iOS channel.
- Update group: `3a8265a0-40af-43c6-81a8-392c0367c987`.
- iOS update: `01a08ae2-7b26-7e20-8f9e-6c72c9260b62`, published at `2026-09-10T10:34:53.606Z` from `e5ef6de26e69a9de34701c3809a926fe08a131cc`.
- Production serves the exact update for build 15's runtime. Its 2,207,044-byte launch bundle was downloaded and matched the manifest SHA-256 hash.
- Open Foundkeep to download the update, then fully close and reopen it to apply. Version remains **1.0.0**.
- The temporary native QA account and all 61 saves were deleted; its session returned 401 afterward. Temporary credential files and matching Maestro logs were removed.
