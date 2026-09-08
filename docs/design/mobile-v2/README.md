> **Selected direction: 02 / Gallery (2026-09-08).** Native implementation now uses the canonical mark, short legal footer, sticky search/filter header, accessible Gallery cards and shimmer. User also requested folders and tags at save time; custom folders, personal tags, starter suggestions, and iPhone share organization are included in this implementation. OAuth and persistent offline collection browsing remain separate work.

# Foundkeep mobile: UX, authentication, and performance audit

Date: 2026-09-08. Baseline: the working Foundkeep 1.0.0 TestFlight app. This packet contains **interactive design concepts, implementation notes, and native verification evidence**. The selected Gallery UI is available in **TestFlight 1.0.0 (14)**; see the [release record](verification/gallery-status.md) and [iPhone test guide](verification/iphone-test-guide.md). OAuth and disk-based offline reading remain outstanding.

## Archived comparison: Gallery selected

Open [the interactive comparison](https://omni--8914.getbb.app), or serve this directory and open `index.html`. Use the Collection / Sign in / First save controls. Each phone supports opening a card, editing a title/note, inspecting grouped images, searching, and demonstrating offline/dark states. Sample content only; the buttons never authenticate or upload anything.

| Direction | Structure | Strength | Tradeoff |
| --- | --- | --- | --- |
| 01 Inbox | Recent saves in a readable list; previews beside title, source and processing state | Fast everyday use with mixed content | Fewer large images visible |
| 02 Gallery | Two-column visual cards; type-specific text/file cards mixed with images | Recognize images and references at a glance | Long titles and accessibility text sizes need adaptive layout |
| 03 Home | Pinned items first, then compact recent saves | Resume work and revisit favorites | Adds pinning/account preference work and uses more vertical space |

Recommendation: **01 as the default, with a remembered 02 grid/list toggle**. Every view uses the same entities and state, so switching views cannot create another cache or stale copy. Keep 03 as an alternative rather than add a fourth primary destination.

### Direction contract for this comparison

1. **Purpose:** help a person save from another iPhone app and reliably find the saved item again. One collection across iPhone, web, and extension; no agent features.
2. **Structure:** compare the three collection structures above against a shared sign-in → share setup → first saved item → optional notifications flow. Preserve source traceability in every detail view.
3. **Visual system:** established Foundkeep warm paper, near-black, vermilion action color and moss status color. System typography in native controls, restrained brand display moments. 44-point native targets; distinct light/dark tokens; content-led hierarchy.
4. **Behavior:** native push/back navigation, sheets for focused tasks, source opening, explicit edit/save, visible queued/processing/ready/failed states, original source separate from user notes. Motion responds to an action; no decorative looping animation. Honor Reduce Motion, Dynamic Type and screen readers.
5. **Boundary:** this is a browser prototype to select a structure. It does not validate native gestures, provider authentication, persistence, push delivery, or frame performance. The user selected 02 / Gallery; native implementation and its verification follow below.

PRODUCT.md now includes the native Gallery and organization model. DESIGN.md remains the brand authority. The seven structures considered were readable library, gallery, timeline, topic shelves, search-first, inbox, and pinned/recent home; surface seed `ae4fbaf8` dealt inbox, gallery, and pinned/recent. No replacement visual identity is proposed.

## What was actually broken

| Finding | Evidence | User impact | Status |
| --- | --- | --- | --- |
| JSON cut at 64 KB before parsing | `src/api/client.ts` called `response.text().slice(0, 64 * 1024)` | Long saved articles could turn a successful response into `null`, breaking both list and detail | Fixed locally; reproduced before fixing |
| Collection downloaded full content for 50 items | Backend mobile list selected all article, OCR, summary and note text | Large downloads, JSON parsing and JS allocation before showing a few lines | Optional compact card representation implemented; default remains compatible with old installs |
| Client repeated server search over truncated/display fields | `filterCaptures()` ran after API search | A match deep in an article/OCR could disappear from the results | Removed from collection; search remains server-authoritative |
| No previews rendered | Collection and detail import/render no image component | Saved images and article lead images show as text/file labels | Confirmed; native preview implementation still required |
| Existing blob route accepts browser cookies only | `/api/captures/:id/blob` calls `auth(c, true)` | Pointing a native image at the web URL will not solve previews | Native authenticated blob/thumbnail route still required |
| Lead-image metadata missing from native type contract | Backend provenance includes `leadImageUrl`; mobile type does not | No consistent native preview resolver | Still required |
| List/detail stayed stale after processing | List refreshed on focus only; detail fetched once on mount | Enriched details did not appear while viewing a screen | Focus/foreground/invalidation refresh and bounded active-screen polling added locally |
| Requests could race | Filter key alone did not distinguish successive same-query loads; stale errors/finally were unguarded | Older results or errors could overwrite newer state | Screen request-generation guards added |
| Search ran per keystroke | Query directly controlled focus callback | Redundant network/database work while typing | 250 ms debounce and 200-character input bound added |
| Account lookup blocked list completion | Collection awaited `/me` after every load/search | Extra request on each search; slow account lookup delayed loading completion | Account refresh removed from search and decoupled from manual card refresh |
| Grouped captures only opened the first item | Group card uses `items[0]`; detail has no sibling route | Other items in a multi-item share are hidden | Confirmed; group detail and full batch pagination still required |
| Entire icon catalogue imported | Three screens imported aggregate `@expo/vector-icons` | Unused icon metadata/font assets in export | Direct Ionicons imports added |
| OAuth does not exist yet | No provider routes/identity table; `usesAppleSignIn` is false | Users must register/login with passwords | Designed below; provider integration still required |

Safari shares can supply readable text and metadata via the bundled preprocessor. A URL shared by another app may contain only the URL/title. The current customer enrichment worker derives information from supplied content; a safe URL-metadata/article fetching job is still needed to fill those gaps. An unavailable lead image must never imply the bookmark itself failed to save.

## Loading and caching: implemented foundation

`GET /api/mobile/captures?view=cards` selects at most 480 characters for each text-heavy field in SQLite, before serializing JSON. Search still operates on the complete stored text. Each result identifies `contentView: card`; detail keeps the complete representation. Requests without `view=cards` retain the previous response behavior for installed clients. Filename and source URL now participate in server search.

The mobile API client caches successful capture reads **in memory only**:

- List pages: 10-second freshness. Detail: 20 seconds. Identity and usage responses are not retained as cached authorization.
- Maximum 20 entries and a 4 MiB estimated text budget, with least-recently-used eviction. This is an estimated payload budget, not a measurement of total JS heap. Larger responses remain readable but are not retained.
- Concurrent reads of the same endpoint share one promise. Query, type and cursor are part of the key. Card and detail representations have different paths.
- A changed/removed device credential clears the cache before reuse. There is no public CDN cache or plaintext on-disk collection cache.
- Writes invalidate before and after the operation. An older read cannot repopulate the cache after a write. Failed reads are not cached; a 401 clears retained data.
- Explicit refresh bypasses cached values. Successful native queue retry invalidates capture reads. Focused screens subscribe to invalidation; old responses cannot overwrite the current request.
- Existing items stay visible during refresh and transient errors. Empty initial-load failures offer Retry rather than pretending the collection is empty.
- Pending detail and first-page collection states refresh every five seconds while active/focused, stopping when settled or blurred/backgrounded. Automatic list polling pauses after loading additional pages to avoid resetting the user’s scroll/pagination; opening a pending item still refreshes its detail. A subsequent phase replaces this first-page limitation with entity-level change sync.

### Measured evidence

Run `bun docs/design/mobile-v2/benchmark.mjs`. It creates an in-memory synthetic account and 50 articles, each 162,000 characters; it uses no customer data.

| Measurement | Before/full representation | Compact cards |
| --- | ---: | ---: |
| Response bytes for 50 synthetic articles | 8,125,354 | 49,354 |
| Payload reduction | — | 99.39% |
| Local in-process request + serialization, one sample | 10.13 ms | 1.33 ms |

The byte comparison is reproducible for this fixture. Timings vary and exclude mobile network, rendering and image downloads. This is not a claim that the app is 99% faster.

Direct icon imports reduced the Expo **web test export** from approximately 1.8 MB to 1.3 MB of JS, 972 to 918 bundled modules, and 37 to 19 assets. Native IPA size, startup, memory use and scroll performance still need measurement on the actual release build.

## Next performance layer

| Layer | Implementation | Correctness rule |
| --- | --- | --- |
| Entity store | One account-scoped entity store keyed by capture ID, lists containing ordered IDs, merges by server revision | A card, a detail sheet and a search result must reference the same current entity |
| Change sync | Cursor over `(updated_at,id)` plus deletion tombstones; query the bounded visible/loaded set, batch changes | Refresh must preserve scroll and pages, remove deleted items and never regress an entity revision |
| Offline content | Device-protected, account-partitioned local database; schema migration and quota; metadata first, explicit downloaded content | Sign-out/account deletion clears account content and private preview files; distinguish cached from fully downloaded |
| Mutations | Optimistic edits with operation IDs, rollback/retry and server revision conflict detection | A later server result must not silently undo a newer user edit; original provenance is preserved |
| Search | Debounced server search now; measure realistic 1,000-item libraries before adding FTS | Preserve search semantics or explain the changed matching behavior; account filters apply to every query |
| Thumbnail service | Generate bounded size variants for uploads and cached remote lead images; retain original separately | Authenticate on every request or issue short-lived, owner-scoped URLs; never leak account bearer tokens to source websites |
| Image display | `expo-image` with fixed dimensions, downsampled sources, explicit loading/error fallback and bounded prefetch | Cache key includes account, capture, rendition and content revision; clear private disk cache on logout |
| Lists | Memoized type-specific cards, stable callbacks, virtualization and at most the next viewport prefetched | Support large text without clipping or relying on a fixed card height |
| Startup | Restore secure session once; render cached collection; refresh identity/config independently | No replay of stale auth callbacks and no previous-account content flashing during account changes |
| Retry | Connection-aware exponential backoff and bounded concurrency; no constant polling after failures | Idempotent client IDs survive retry and app restarts; failed uploads remain recoverable |
| Telemetry | Aggregate latency/bytes/cache-hit/error/frame metrics, no saved text/URLs/tokens in logs | Separate server, network, parse and render time so optimization follows evidence |

Proposed release targets, **not measured results**: cached collection visible within 300 ms of authenticated navigation; first network card page within 1.5 s on a representative mobile connection; smooth 60 Hz scrolling on the baseline supported iPhone; card preview sizes normally under 100 KB; no unbounded download/prefetch work. Capture p50/p95 cold launch, warm launch, query latency, memory peak, cache hit ratio and dropped frames on device before declaring these targets met.

## Onboarding and native interaction

1. One welcome screen: what Foundkeep saves, a real preview example, Continue with Apple, Continue with Google, then email/GitHub/X under more options. Login and signup converge rather than making people choose the wrong form first.
2. Returning accounts go directly to their requested item/collection. New accounts see a skippable guide to favoriting Foundkeep in the iOS share menu. The app cannot add itself to the user’s share favorites automatically.
3. Guide a first save and show its actual state: queued on device → uploading → saved → processing → ready. A saved item remains usable while optional enrichment runs.
4. Offer notifications after explaining their value, not on first launch. “Not now” must leave the collection fully usable. Existing missing APNs provider configuration remains a separate delivery dependency.
5. Keep account/provider connections, storage, appearance, sync state and share setup in a native grouped settings list. Add note is an action/sheet, not a permanent tab destination.

Use iOS navigation stacks with edge-swipe back intact, sheets with explicit close/save, optional light haptics for completed user actions and interruptible transitions. A long press may expose a context menu; normal taps must still expose every action. Destructive deletion has an explicit confirmation. Visual list/grid, grouping, source details, and failed-preview fallbacks must work with VoiceOver and large text. Avoid custom gesture systems until native navigation has been tested.

## Authentication architecture

Preserve the existing Foundkeep account ID and collection. Add a provider identity mapping with a unique `(provider, provider_subject)` key pointing to that account; do not create a separate collection per provider. Existing email/password sign-in remains usable.

```mermaid
sequenceDiagram
    participant App as iPhone / website
    participant Auth as Foundkeep auth service
    participant Provider as Apple / Google / GitHub / X
    participant Store as Account + identity store
    App->>Auth: Start sign-in (state, nonce, device challenge)
    Auth->>Provider: Authorization request
    Provider-->>Auth: Authorization code / verified native credential
    Auth->>Provider: Server-side token exchange + identity verification
    Auth->>Store: Resolve provider subject to Foundkeep account
    Auth-->>App: Short-lived one-use completion grant
    App->>Auth: Redeem grant with device verifier
    Auth-->>App: Foundkeep session / device credential
    App->>App: Store in shared Keychain; resume intended screen
```

Use a maintained OAuth/OIDC implementation for exchange/signature validation. Validate issuer, audience, expiry, nonce and signature for OIDC; use the provider’s authenticated identity endpoint for providers that do not return an ID token. Bind state to the initiating browser/device and use PKCE where supported. Client secrets stay on the server. Expo documents the server exchange requirement and supported browser-session redirect handling in its [authentication guide](https://docs.expo.dev/guides/authentication/).

Native Apple sign-in should use the native credential sheet and server verification. Preserve name/email when first supplied, handle private-relay addresses, and support provider revocation/account deletion. Adding `expo-apple-authentication` and its entitlement/config requires a new native build. [Expo AppleAuthentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/).

For browser providers, return to a fixed Foundkeep HTTPS callback, then a dedicated allowlisted app completion route. Deep links carry only a short-lived, one-use grant bound to a device verifier, never a durable bearer token. Do not reinterpret arbitrary `returnUrl` parameters. Preserve the existing pending route when sign-in is cancelled/retried; cold-start and warm-start callback redemption must be idempotent.

### Account linking and recovery

- Resolve a known provider subject directly. Never use mutable display names or email as the provider’s primary ID. [GitHub OAuth best practices](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app).
- If an email matches an existing account, require sign-in to that account before linking. Do not automatically merge based on an unverified provider email or assume matching private-relay addresses.
- Connect additional providers from an authenticated settings session with recent reauthentication. Prevent unlinking the last usable method without adding another.
- Provider-only accounts need a deliberate schema migration: current password/recovery columns are mandatory. Use explicit passwordless credential semantics, not fabricated passwords. Recovery, email verification, password setup and deletion must support provider-only accounts.
- The current mobile account deletion endpoint requires a password; add recent-provider-reauth support before enabling provider-only signup.
- Use the existing shared Keychain to let the iOS share extension upload immediately after login. Store Foundkeep device credentials there, not provider secrets.

### Provider setup still required

These are **proposed callback URLs to implement**, not live endpoints today.

| Provider | Configuration needed | Proposed HTTPS callback |
| --- | --- | --- |
| Apple | Enable Sign in with Apple for `app.foundkeep.ios`; configure web Services ID if web login is included; dedicated Sign in with Apple key/config | `https://foundkeep.app/api/auth/oauth/apple/callback` |
| Google | Foundkeep consent screen and OAuth client; authorized domain `foundkeep.app`; basic profile/email identity scopes | `https://foundkeep.app/api/auth/oauth/google/callback` |
| GitHub | OAuth app/client credentials; only identity/email permissions | `https://foundkeep.app/api/auth/oauth/github/callback` |
| X | OAuth 2 app, PKCE, identity endpoint access and permitted email scope; handle unavailable email explicitly | `https://foundkeep.app/api/auth/oauth/x/callback` |

Google requires registered OAuth credentials and matching redirects. [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect). GitHub now supports PKCE. [GitHub authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps). X documents OAuth 2 PKCE and its identity/email scope options; verify the actual app’s access before presenting it as available. [X OAuth 2](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

The App Store Connect publishing key already supplied is for submission automation; it is not evidence that Sign in with Apple is configured. Provider credentials will be requested through the secure secret-input flow when the integration contract is implemented. Provider availability can then be controlled by a data-only server response; show only genuinely configured and tested providers.

## OTA and release boundary

Existing runtime-compatible JS/layout/caching changes can be delivered through EAS Update. New native modules, entitlements, app-group changes or native share-extension code require a new App Store/TestFlight binary. Keep fingerprint-based runtime matching so an OTA update cannot require a module absent from an installed build. [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).

A new authentication/native-image build can still display marketing version **1.0.0** during this initial TestFlight iteration, with an incremented build number. Data-only policy can control provider visibility and already-bundled behavior; it cannot supply arbitrary executable code or create native capabilities.

Release sequence: select collection structure → finish authenticated previews/group details/editing/entity sync → implement social identity/account linking/onboarding → configure providers and verify test accounts → build with Apple auth/image dependencies → test on the real phone → release to TestFlight → stage compatible OTA fixes. The server’s optional compact endpoint can deploy before the new app; older clients continue using the full representation.

## Validation performed and still owed

Performed locally:

- Regression tests reproduced both the long-JSON failure and missing compact response before implementation.
- Mobile test suite, backend customer API tests and TypeScript checks pass (latest counts recorded in the work log).
- Compiled Expo web app smoke test: collection loads, a server match absent from the excerpt remains visible, typing yields one debounced request, and a >64 KB detail renders with no page errors.
- Interactive concept test covers edit propagation across all three designs, grouped-image access, optional onboarding, offline/demo states, images and widths 320/390/768/1024/1440.
- Independent concept review found two issues (provider placeholder marks and dark pending-label contrast); both fixes were scored resolved. This review does not approve a native implementation or replace native implementation validation.

Still owed before release:

- Native image previews for uploaded image files, screenshot blobs, remote article covers, missing/expired images, HEIC and large originals.
- All items accessible in mixed multi-share batches across cursor pages.
- Provider signup/login/cancel/link/unlink/recovery/deletion; Apple relay and repeat login; Google/GitHub/X missing-email and denied-consent cases.
- Duplicate/expired/forged OAuth callbacks, app-killed callback resumption, wrong account, revoked session, and invalid return paths.
- Queue retry while app/background/share extension move between offline and online; progress without duplicates; metadata changes reflected across devices.
- Actual iPhone Dynamic Type, VoiceOver, dark appearance, edge back, sheet dismissal, keyboard and reduced motion.
- Native performance profiling and account-isolated offline/image-cache clearing. Browser benchmarks cannot substitute for these.

## Prototype asset provenance

These downloaded photos illustrate fictional saved items; source labels in the concepts are sample labels, not claims about the photographs’ publishers. Photos are only in this design packet, not added to the shipped app.

- `assets/architecture.jpg`: https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82
- `assets/landscape.jpg`: https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=82
- `assets/interior.jpg`: https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=82
- `assets/clarity.woff2`: existing Foundkeep Clarity City Bold from `apps/web/assets/fonts`.
- Screenshots are browser captures of this local prototype, generated by `verify-prototype.mjs`, not App Store or Simulator screenshots.
