# Foundkeep mobile chrome and related saves

The interactive comparison runs with `node docs/design/mobile-chrome/serve.mjs` on port 8926. It uses synthetic saves and the same scroll geometry as the app. Selected on September 9, 2026: **Floating dock + deep purple**. The archived bottom navigation choices are Floating dock, Edge bar, and Search dock; each supports purple/red, dark appearance, reduced motion, and opaque surfaces. Select a variant in the preview to record a preference locally. These are browser design previews, not native glass verification.

## Implemented in the app

- Purple accents, neutral backgrounds, and semantic light/dark colors replace moss; error colors remain distinct. The canonical Foundkeep mark stays intact.
- The compact collection bar keeps search and new-note actions available. Large title, search input, folder/tag controls and type filters translate out on downward scroll and return on deliberate upward scroll. Rubber-banding is clamped and search focus holds the controls open. List layout stays fixed during scrolling.
- The saved-item navigation bar has 44-point Edit/Organize, Open source and More actions. The overflow menu retains grouped saves, file sharing and confirmed deletion. Source metadata is expandable. File-only saves have a compact file row instead of a large empty preview.
- Related saves appear below source details with thumbnails and explicit reasons: same batch, same source, shared personal/suggested tags, or same folder. They are computed within the authenticated account, exclude the current save, rank deterministically and return at most six compact card responses. No article download or remote model call is required to find matches. Distinct URL query values remain distinct sources.
- The private client cache shares requests, expires after ten seconds and invalidates on writes/account changes. Related rows refresh on focus, foreground and edits, with shimmer, empty and retry states. The main item remains readable when related loading fails.

## Validation

- 50 mobile tests pass, including scroll reversal/overscroll and related-cache isolation.
- 56 relevant backend tests pass, including customer capture/organization regressions; related endpoint tests were rerun after reducing matching reads to metadata only.
- Mobile TypeScript and Expo web export pass. The compiled app browser check covers collapse/reveal, search focus, 44-point detail actions, source disclosure, related navigation, complete article text, edit invalidation, organized note creation, image credential isolation, and loading states.
- Impeccable detector reports no findings on the changed primary surfaces.
- Native iPhone 17 / iOS 26.5 Simulator checks pass for password sign-in, scroll collapse/reveal, search focus, deep-link opening, compact header actions and navigation to a related save. The dark-mode check caught navigation retaining the light theme; Expo Router’s ThemeProvider now follows the device scheme, including native navigation materials. Final light/dark images are under `.impeccable/review/chrome/`. Browser checks remain distinct from native verification.

## Release scope

App version remains 1.0.0. The related endpoint is deployed. Floating dock + deep purple is implemented with `expo-glass-effect` 57.0.2. It requires a new TestFlight binary; its native dependency is included in Expo’s fingerprint. Ordinary later JavaScript changes can use OTA only for matching runtimes. The release status is recorded below. No Supabase credential or auth-provider setting changes are part of this pass. No agent feature or explicit manually attached link graph is introduced; existing and future attached tags automatically participate in related matching.

## Native verification notes

The first Simulator login attempt hit the text labels instead of the input fields; the flow now uses existing `field-email` and `field-password` identifiers. The next attempt was held by Apple’s Save Password prompt; dismissing that system prompt completed sign-in. Synthetic cover URLs initially pointed to the authenticated BB preview and correctly failed without BB credentials; fixtures were corrected to a publicly accessible Foundkeep image. No credential was forwarded to the image host. Physical-device gesture feel still needs a beta pass.


## Floating dock verification — September 9, 2026

- The floating Gallery/You capsule and separate Create a note action use native Liquid Glass on supported iOS devices. Unsupported systems and Reduce Transparency use an opaque surface. No glass ancestor is faded to zero opacity.
- Gallery scroll state contracts the dock to icons; upward scroll restores labels. VoiceOver and larger text retain labels; larger text stacks them beneath icons. Keyboard presentation hides the dock. Gallery and Settings reserve enough space to reach their final content.
- All 50 mobile tests, TypeScript, Expo web export and compiled interaction checks pass. Browser checks cover tab navigation/selected semantics, 44-point targets, 320-point width, footer clearance, and creation through the dock. React Native Web always reports a screen reader; its expanded labels are expected. Native collapse is verified separately.
- Signed Xcode Debug build and native iPhone 17 / iOS 26.5 checks pass: sign-in, native glass surface, collapse/reveal, both tabs, keyboard hiding, and quick-add. Light, dark and accessibility-extra-large screenshots were inspected. Evidence: `.impeccable/review/dock/native-{light,compact,dark,large}.png`; these use a disposable account and synthetic saves.
- The initial unsigned Simulator build could not access the shared Keychain. Rebuilding with the existing local signing/team settings resolved the test setup; no auth bypass was added.
- Personal Expo ownership verified: `notpritam`, `notpritamsharma@gmail.com`. Public App Review contact details remain missing. No App Store submission is claimed.
