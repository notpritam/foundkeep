# Collapsing dock label flicker

September 10, 2026. Release source: `e6783efe036a7e020f135354a5326a98378d38b6`.

## Cause and fix

The Gallery/You dock used an underdamped spring to shrink label width to zero. Its unclamped interpolation produced a negative label width for four sampled frames (minimum approximately -0.018 px). Native layout briefly displayed the full labels over the compact icons before settling. A simulator recording reproduced that exact flash.

Clamp both tab and label interpolation at their endpoints and stop the spring on overshoot. Fade only label content during the first 65% of collapse, so text is invisible before its clip reaches zero. Keep the glass material fully opaque to its own compositor and retain screen-reader, Dynamic Type, reduced-motion, keyboard, and tab-navigation behavior. Interpolation nodes are memoized across renders.

## Verification

- Two regression tests failed against the original animation, then passed with the fix. They sample real Animated JS spring frames and test overshoot, reversal values, narrow screens, and fully hidden labels at rest.
- TypeScript and all 52 mobile tests passed. The added tests run in the existing scroll suite, preserving the package metadata used by Expo's native fingerprint.
- Compiled browser gallery checks passed, including navigation, compact header, narrow viewport, footer clearance, dark mode, and accessibility material fallbacks.
- Native iPhone 17 / iOS 26.5 simulator: recorded three collapse/reveal cycles and Gallery/You navigation. Frame-by-frame comparison shows the original flash and no returning labels after the fix.
- Native runtime matches TestFlight **1.0.0 (15)**: `03660500bff0bed464c73b169d8c9f0d01e85f19`. No native code or app version changed.
- Temporary QA account and its 12 captures deleted; session rejection verified. Credential files removed.

Recordings, transition contact sheets, and native proof are in `.impeccable/review/dock-flicker/`. Testing used the simulator, not the user's physical iPhone.

## Published update

- Personal Expo account: `notpritam`; production iOS channel.
- Update group: `981b9a79-fc2d-4747-ab03-b2b248c04e92`.
- iOS update: `01a08ac1-aea2-71d0-9b25-5fd897a56680`, published at `2026-09-10T09:59:04.098Z`.
- Production manifest returns the exact update ID for build 15's runtime. Its 2,197,476-byte launch bundle was downloaded and matched the manifest SHA-256 hash.
- Open Foundkeep to download the update, then fully close and reopen it to apply. App version remains **1.0.0**.
