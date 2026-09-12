# Quiet Collection + Glass Horizon release

Released September 10, 2026 from `0267c058235d4578c89e11fa328cc2bc97bc010a` on `feat/mobile-scenic-glass`.

## Delivered design

Quiet Collection supplies the warm paper background, editorial type, simple settings, share guide, note composer, compact filters, and subtle floating glass dock. Glass Horizon supplies the two-column preview cards, translucent captions, and overlapping saved-item header. Landscape images use their actual proportions; long screenshots keep a bounded preview.

The app opens directly to Apple/Google sign-in, with email available through a disclosure. There is no welcome/Get started step. Connected accounts skip authentication, old welcome links remain usable, and registration keeps recovery-code setup. Live Dynamic Type changes remeasure native labels without resetting forms, navigation, or drafts.

## Release

- Expo owner: `notpritam` (personal account).
- iOS app version: **1.0.0**, compatible TestFlight binary **15**.
- Production update group: `03f4a9fd-7e36-45ea-a6a4-7c855f63a9cd`.
- iOS update: `01a08a8a-d135-76fe-baf5-ad1da6efc4e0`.
- Runtime: `03660500bff0bed464c73b169d8c9f0d01e85f19`; matched build 15 on the Mac using a frozen lockfile install. No forced runtime override.
- Published bundle: 2,196,824 bytes. Retrieved through the production update endpoint with the matching iOS runtime/channel, then verified against the manifest SHA-256 hash. Asset requests used the authorization headers supplied by the Expo manifest extensions.
- No new App Store binary or App Store review submission was needed for this UI update.

To receive it, install/open TestFlight **1.0.0 (15)**, allow the launch-time update download to finish, then fully close and reopen Foundkeep. The existing configuration downloads updates in the background and applies them on a subsequent launch.

## Validation

- TypeScript and 50 mobile unit tests passed.
- Production web and iOS exports passed; EAS generated and published the final Hermes bundle.
- Compiled browser checks covered direct/legacy entry routes, connected-account redirects, email login, registration/recovery, legal links, OAuth browser handoff/callback/cancellation, gallery filters, private image requests, complete article text, edit invalidation, organized notes, related saves, collapsing headers/dock, narrow screens, dark mode, reduced transparency, and increased contrast.
- Signed native simulator build passed on Xcode 26.6 / iPhone 17 / iOS 26.5. Native checks covered real email login, provider availability, keyboard access, gallery images, reader, edit sheet, scrolling, settings, login deep links, dark mode, live accessibility text resizing, increased contrast, and large-type sign-in.
- The initial automated login pause was the system Save Password dialog; continuing with Not Now confirmed the successful login. Test automation also explicitly scrolls the password field into view before typing.
- A temporary QA account and all 12 test saves were deleted after verification; its session returned 401. Temporary credential-bearing files were removed and simulator display preferences restored.

Screenshots and machine-readable release evidence are in `.impeccable/review/hybrid-native/`. Browser fixtures are in `.impeccable/review/gallery/`. These are simulator/browser checks; the update has not been observed on the user's physical phone during this turn.
