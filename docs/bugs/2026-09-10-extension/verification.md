# Extension installation detection and popup repair

September 10, 2026.

## Findings

The public Chrome Web Store package (ID `cficnecbdbiddngllpfbacabgbcjinmk`, version `1.0.0`) was downloaded from Google's update service and its runtime files matched the checkout. Opening its real toolbar action produced a 25×25px viewport. The popup document constrained its own size using `100vw`/`100vh`, creating a circular dependency with Chrome's automatic popup sizing. Existing popup-as-tab tests did not reproduce this.

The landing page never sent an installation probe. Its three install calls to action always linked to the Store regardless of whether the extension was installed.

## Changes

- Give the popup root an intrinsic 390×600px size. Constrain only its content to Chrome's available viewport so the footer stays accessible on smaller screens and the body scrolls internally.
- Check the allowed Store and manual extension IDs using the existing trusted external-message handshake. Update all three landing install actions to connect/open the dashboard after a successful response.
- Recheck on focus, visibility restoration, and pageshow. After an explicit Store visit, a document lacking Chrome's external messaging API reloads once; it does not enter a reload loop.
- Keep both known extension IDs and the public Store URL available if the configuration request fails.
- Retain SVG icons when changing install labels, and announce installation state through the status text.
- Version the signed manual channel as `1.6.2`; Store version remains `1.0.0` until a package update is approved.

## Validation

- 47 extension tests passed, including the new real toolbar test using `chrome.action.openPopup()`, CDP input/mouse events, actual IndexedDB note saving, settings/back navigation, and the real webpage-to-extension handshake.
- The test fails against the downloaded public Store release at 25×25px and passes against the fixed source and prepared Store candidate.
- The complete Bun suite passed: 161 tests, 1,401 assertions. Its existing eight-pass native fingerprint test takes about 39 seconds locally; the extension release workflow now gives tests a bounded 120-second timeout instead of Bun's five-second default. No tests are skipped.
- The customer API/real-extension signup, capture, pairing, and isolation flow also passed.
- 19 customer browser tests passed, including account isolation, pairing, offline handling, and OAuth UI.
- 15 landing browser tests passed, including existing responsive coverage, installed/disconnected states, configuration failure, returning to the tab, and a one-time reload.
- Both manual CRX aliases share a valid signature for the established ID, and their update manifest points to `1.6.2`.
- Independent review found no material product or security regressions. Its stale version assertion finding was corrected and the landing suite rerun.

## Chrome Web Store release still pending

The user's prior requirement keeps the public version at `1.0.0`. Google requires every uploaded update to have a higher package version. A proposed ZIP is prepared at `/home/pritam/personal/apps/atlas/deploy/dist/foundkeep-store-1.0.0.1-proposed.zip`, using `version: 1.0.0.1` and `version_name: 1.0.0`. Its runtime files exactly match the verified source. It has not been uploaded or published, and the tracked Store version is unchanged.

Candidate SHA-256: `c7cbb3dffa44a2ebd6af7c992273d33db8688f3890c2a85a36b92385e5731711`.

The popup CSS is bundled code. This fix cannot be delivered to existing Store installations through data-only account preferences or runtime policy. Once an approved package update is published, Chrome distributes it through the normal Store update channel.

[Fixed toolbar popup](popup.png) · [Chrome popup sizing](https://developer.chrome.com/docs/extensions/reference/api/action#popup) · [Store update/version requirements](https://developer.chrome.com/docs/webstore/update#upload_an_updated_zip_file)

## Production verification

Commit `9e25fdb` was pushed to main and deployed. All 15 landing checks passed against `https://foundkeep.app`. The actual public Store package was loaded with its original public key/Store ID; the live website detected version `1.0.0` and changed all three install actions to connect the extension. Existing Apple/Google provider discovery remains active. The new manual ZIP is served by the site.

The live manual ZIP was downloaded through Chromium and matched the verified build byte-for-byte (106,162 bytes, SHA-256 `ee3027b9615db2b0ff486266e8178bf981352477490728c29a4b0c0aa6a980ce`).

The GitHub Actions run `34438273155` failed only on the existing five-second fingerprint timeout. Commit `5a627af` fixes that timeout; the complete 161-test suite then passed locally. Attempting to dispatch the updated workflow returned HTTP 403 (admin rights required), and creating the signed GitHub release was rejected for missing workflow scope. No alternate authorization route was attempted. Consequently the public manual ZIP is updated, but the GitHub `ext-v1.6.2` auto-update release has **not** been published. A repository owner must run the updated release workflow or grant the appropriate GitHub permission. Chrome Web Store publication also remains pending as described above.
