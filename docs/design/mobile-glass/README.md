# Scenic glass mobile UI

Implemented September 10, 2026. This replaces the earlier deep-purple mobile palette with the landing page's azure, pale blue and mint. The selected gallery layout and floating dock remain. The user requested code completion now and will reconnect the Mac later; this change has not been published to EAS Update or TestFlight.

## Visual review

These are screenshots of the compiled Expo web app at 390 × 844, using synthetic data. They demonstrate layout and the web material fallback; they are not iPhone or native Liquid Glass evidence.

- [Gallery](screenshots/gallery.png)
- [Welcome](screenshots/welcome.png)
- [Dark appearance](screenshots/dark.png)
- [Sign-in with configured providers](screenshots/sign-in.png)

The full browser run also captures shimmer, collapsed controls, narrow layout, solid accessibility surfaces, settings, the share guide, organization, the note composer and saved-item details in `.impeccable/review/gallery/`.

## Implementation

- `ScenicSurface.tsx` owns the shared material provider, fixed artwork, glass chrome and readable panels. The landscape is the same original artwork used on the landing page, bundled as an 86,934-byte WebP. It needs no image request at launch.
- Glass is limited to the collection controls, floating dock and welcome action panel. Compatible iOS uses the existing `expo-glass-effect` module. Web uses CSS backdrop filtering. Older iOS uses translucent fills; Android currently uses solid surfaces. There is no added native dependency.
- One root subscription tracks Reduce Transparency and Increase Contrast on iOS, with equivalent media queries in the web preview. Either preference makes controls opaque and removes the collection's decorative landscape. The welcome artwork remains an ordinary static image behind its opaque action panel. Decorative artwork is excluded from accessibility navigation.
- Gallery cards and long-form reading panels use a high-opacity fill without a per-card blur. The background is fixed, with no scroll-driven image movement or animation loop. Existing image fade, shimmer, header collapse/reveal and dock motion remain subject to Reduce Motion.
- Light/dark semantic colors apply to native iOS; web previews use the same palettes through CSS variables. Web shadow colors deliberately stay literal because React Native Web does not apply `shadowOpacity` to CSS-variable colors.
- Welcome, sign-in, registration, recovery, onboarding, gallery, settings, editing and reading share the scenic treatment. Recovery-code content can scroll on short displays. Website links use canonical routes.
- Auth, backend credentials, deep links, account linking, saved data, upload queues, notification behavior and native Share Extension code are unchanged. App version remains **1.0.0**. Existing native splash/icon configuration remains unchanged for this JavaScript/UI pass.

## Verification on Linux

- TypeScript: `tsc --noEmit` — passed.
- Mobile unit/config/runtime suite: **50 passed, 0 failed**.
- Production Expo web export — passed.
- Production iOS JavaScript/Hermes export — passed (2.7 MB bundle). This does not validate Xcode compilation or native rendering.
- `scripts/verify-gallery.mjs` — passed: tab navigation, 320 px fit and 44 px dock targets, final-item clearance, note creation, shimmer, scroll collapse/reveal, search focus, related navigation, source actions, full article rendering, edit invalidation, folders/tags and note save. Also verifies live reduced-transparency and contrast fallbacks, dark appearance and onboarding navigation.
- `scripts/verify-oauth.mjs` against the same web export — passed: provider start, browser handoff, callback verifier, existing-account confirmation, cancellation and rejection after a restart. All requests use test fixtures.
- Native fingerprint before/after this UI change: **`2153cb97c6b3979734055de11c7696f764212e0b`**, unchanged.

Reproduce from `apps/mobile` after installing the repository dependencies:

```sh
bun run typecheck
bun run test
bunx expo export --platform web --output-dir dist-gallery-preview
node scripts/verify-gallery.mjs
FOUNDKEEP_MOBILE_WEB_EXPORT=dist-gallery-preview node scripts/verify-oauth.mjs
bunx expo export --platform ios --output-dir .expo/glass-ios-check
```

Set `CHROMIUM_PATH` if Playwright's default Chromium is unavailable. The Linux verification used `/home/pritam/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`.

## When the Mac reconnects

1. Sync this commit into the personal Foundkeep checkout and use Expo account **notpritam**.
2. Verify the native iOS UI: light/dark appearance, actual Liquid Glass, Reduce Transparency, Increase Contrast, Reduce Motion, large Dynamic Type, keyboard avoidance, short displays, share sheet, app resume and OAuth return. Check that native headers and the floating dock remain readable and clear the home indicator.
3. Compare the installed TestFlight build and production channel runtime with the final Mac build. Previously recorded TestFlight **1.0.0 (15)** used runtime `03660500bff0bed464c73b169d8c9f0d01e85f19`, which differs from this Linux checkout's fingerprint. An unchanged fingerprint within this change alone does **not** prove compatibility with that installed binary. Do not override or force a runtime to match.
4. Publish a compatible OTA update after verification, or create and submit a new native build if the runtime differs. Keep the marketing version at 1.0.0; increment the build number when a new binary is required.

The Mac connection is needed for native verification and delivery, not for further implementation of this visual pass.
