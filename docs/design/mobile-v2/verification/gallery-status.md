# Gallery implementation verification

Selected: Gallery, canonical Foundkeep mark, short legal footer, sticky collection controls, restrained shimmer, folders and personal tags on save.

Verified locally:
- Mobile TypeScript passes; 39 mobile tests pass.
- 93 backend tests pass, including folder/tag ownership, atomic capture metadata, revision conflicts, storage accounting, migration, and enrichment preservation.
- 17 website/extension customer-flow tests pass against isolated local servers.
- Compiled RN web interaction checks pass: shimmer, stationary header during list scroll, images without source-site credential forwarding, folder filter, complete long article, edit invalidation, note save with new folder/custom tag, and short legal copy.
- Archived design comparison passes its interaction checks and marks Gallery selected.

Native verification on the enrolled Mac:
- Expo prebuild and CocoaPods installation pass.
- Signed Xcode Debug Simulator build passes at `48171d6`; the incremental rebuild with the final Safari preprocessing resource from `5a639fb` also passes, including the Share Extension and shared native module. Native password sign-in and shared Keychain access work.
- 43 native Swift queue checks pass, including stable account ownership, legacy quarantine, explicit deleted-folder recovery, and preserving a partially uploaded share's original batch through folder correction. The batch regression was verified failing before the fix and passing afterward.
- Native note creation and nested edit/organization sheets pass against a disposable production account. Backend reads confirm folder selection, custom tags, additional tags, and preservation when moving an item to Unfiled.
- Fixed keyboard avoidance in iOS sheets. The test driver incorrectly treated controls behind the keyboard as visible; scrolling within the exposed sheet before tapping verifies the actual Add tag button. Keyboard Return also adds the tag. Neither test is accepted without checking stored data.
- Dark mode and accessibility-extra-large Gallery/organization checks pass after launch. Gallery switches to one column; the introductory heading makes room for collection controls. A live Simulator font-size change showed stale text layout until relaunch; physical-device font changes still need checking.
- Safari exposed a property-list-only handoff that the old loader discarded. `48171d6` converts its validated page URL into one bookmark while retaining title/readable text and respecting policy. The regression fails before the fix and all 10 real NSItemProvider loader checks pass afterward. Safari then exposed a second transport failure: optional null values cannot cross Apple’s property-list boundary. `5a639fb` omits those absent values; its regression fails before the fix and passes afterward. The signed Simulator share flow now passes from Safari through the backend to Gallery: Example Domain, readable article text, original URL, Reading folder, and Work tag all persist.
- Browser fixtures are synthetic review evidence. Native screenshots are under `.impeccable/review/gallery/native/`; neither replaces physical-device testing.

Production backend:
- Deployed the Gallery API and organization migration on September 8, 2026 after an online SQLite backup and integrity check.
- Live health check and 12 smoke checks pass: registration, starter organization, create folder, organized save, folder/tag filtering, edit preservation, image save, private preview, unauthenticated denial, folder deletion, content/tag preservation, and disposable account cleanup.
- Existing account data is preserved. Mobile UI is available in TestFlight as 1.0.0 (14).

Known pre-existing check limitation: backend TypeScript reports errors in `src/captures.ts` and `test/backend.test.ts`; new customer API/organization code has no reported TypeScript errors.

Release boundary: app version remains 1.0.0. New native Share Extension and queue methods require a new binary. A final regression confirmed that Expo did not automatically fingerprint custom Share Extension files copied by the config plugin. Added these sources and the native mark explicitly. The regression passes on Linux and the enrolled Mac and proves that changes to share Swift, Safari preprocessing, Info.plist, the native mark and the shared module change the runtime, while Gallery UI and native test changes do not. Do not send this JavaScript to an incompatible OTA runtime. OAuth, APNs provider setup, and persistent offline collection browsing are separate outstanding work.


Independent review of `190eea3..48171d6` and the final `5a639fb` producer fix: **disposition: ship** for the reviewed code, including Safari fallback validation, deduplication, policy enforcement, keyboard/tag changes and reduced motion. This does not certify TestFlight readiness.

Native checks on macOS (from `apps/mobile`):
```sh
xcrun swiftc modules/foundkeep-shared/ios/FoundkeepQueueScope.swift modules/foundkeep-shared/tests/QueueScopeTests.swift -o /tmp/foundkeep-queue-tests
/tmp/foundkeep-queue-tests
xcrun swiftc -parse-as-library share-extension/ShareItemLoader.swift share-extension/SharePolicy.swift share-extension/tests/ShareItemLoaderTests.swift -o /tmp/foundkeep-loader-tests
/tmp/foundkeep-loader-tests
```

Release worktree: `/Users/notpritamm/Developer/foundkeep-gallery-review`. Final Simulator build log: `/tmp/foundkeep-share-fixed-build.log`. Builds 9–13 were not submitted. Build 12 failed because a dependency symlink outside the temporary checkout changed the local Expo runtime fingerprint. Replaced the symlink with a frozen-lockfile dependency installation; runtime compatibility enforcement remains enabled. The released beta version remains 1.0.0. Disposable QA credentials stay outside the checkout and are not reviewer access.

Native Simulator evidence from the disposable QA account:
- [Safari share with Reading folder and Work tag](native-safari-share.jpg)
- [Saved bookmark in Gallery](native-gallery.jpg)
- [Saved item with source navigation](native-saved-detail.jpg)

Reduce Motion is respected in code, including auth, but the native system-setting toggle was not verified in this run. The Expo Doctor cloud check reports two newer SDK patch releases (`expo` 57.0.21 and `expo-router` 57.0.20); this build retains the tested, locked 57.0.20/57.0.19 pair.

The disposable native QA account and its credentials were deleted after verification. A direct read of the production database confirms no `gallery-native-*` accounts remain.

[Physical iPhone test guide](iphone-test-guide.md).

Independent review of `d81543a`: **disposition: ship** for the fingerprint configuration and regression. The reviewer independently verified all seven file cases.

Release candidate: EAS build `55a3b3d6-2656-4d7e-8e2d-3cbba98a6ea4`, version **1.0.0 (14)**, source `d81543a`. The cloud production archive completed successfully. Inspected the release IPA: both bundle IDs, both 1.0.0 (14) version values, bundled Safari fix, native mark, production update channel and embedded runtime `e9e5b5409ee2413aba0d29e723045cc0b58d74fa` are correct. The 17,262,758-byte IPA was uploaded directly with Apple’s altool and the existing API key; Apple reported no upload errors (delivery `c4ec4541-c4f3-4dff-954b-bcebfe1104fc`). Apple processing is **VALID**; build 14 is assigned to **Foundkeep Internal**, with internal state **IN_BETA_TESTING** and test notes saved in en-US. Public App Store review has not been submitted for this iteration.

Submission fallback: EAS requires Enterprise to attach test notes through its submission parameter. The standard EAS upload remained queued, so it was canceled (`064f67b9-55b9-45fa-86ac-5ac6a6de14ef`, verified CANCELED) before direct Apple upload. A temporary launchd job kept the uploader independent of Mac remote-session restarts.

## TestFlight release

Verified on September 8, 2026 through App Store Connect API: **Foundkeep 1.0.0 (14)**, Apple build ID `c4ec4541-c4f3-4dff-954b-bcebfe1104fc`, internal testing state **IN_BETA_TESTING**, assigned to the existing **Foundkeep Internal** group. Open TestFlight → Foundkeep → Update, then follow the [iPhone test guide](iphone-test-guide.md). No new invitation or Apple ID password is needed for the already accepted internal tester.

The release source is on `main` (code `d81543a`; native evidence and guide `beaaec9`). [GitHub’s clean-runner iOS verification](https://github.com/notpritam/foundkeep/actions/runs/34265762252) has passed tests, TypeScript and prebuild; its additional Simulator compilation is still running. The EAS production archive and local signed Simulator builds already passed.
