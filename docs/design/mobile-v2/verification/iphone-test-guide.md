# Foundkeep Gallery: iPhone test guide

This guide covers the Gallery iteration of Foundkeep 1.0.0. Install **1.0.0 (14)** from Foundkeep Internal in TestFlight. The release record is in [gallery-status.md](gallery-status.md).

## Install

Open TestFlight with the Apple account already invited to Foundkeep Internal. Select Foundkeep and install the newest build listed in the release record. This iteration changes the native Share Extension; install the TestFlight binary before testing it. An OTA update cannot add the new native share behavior to an older build.

## Try the complete save flow

1. Sign in to Foundkeep using your existing Foundkeep email and password. Complete or skip the share setup guide.
2. In Safari, open a public article. Tap Share → Foundkeep. If it is hidden, use More and add Foundkeep to Favorites.
3. Pick a folder and one or more tags, optionally add a note, then tap Save.
4. Return to Foundkeep. Confirm the saved item appears in Gallery and the selected folder/tag filters can find it.
5. Open the item. Check its readable content and use Open original source to return to the page. Some pages provide no preview image; those should show a readable link card rather than a broken image.
6. Use Edit and organize to change your title, note, folder, or tags. Save and confirm Gallery updates. The original source should remain intact.
7. Create a note. In its organization sheet, add a custom tag and create a folder. Save, reopen, and confirm both persist.

## Check iPhone-specific behavior

- Scroll a populated collection: search and filters should stay at the top. Initial loading shows shimmer, then actual cards or a useful empty/error state.
- Switch light/dark appearance. Increase Dynamic Type, then relaunch Foundkeep and check Gallery, details and save sheets. Also check a live font-size change; the Simulator showed stale text layout until relaunch in that case.
- With the keyboard open, enter a custom tag in the organization sheet. Return adds it. The sheet must scroll so its controls remain reachable.
- Enable Reduce Motion and check welcome/sign-in, loading and sheet interactions. The code honors this setting; this native toggle still needs physical-device verification.
- Share a photo, a PDF and multiple images; inspect the resulting items and the View items saved together action.
- With a page already open, disconnect the network and save from its Share menu. Reconnect and open Foundkeep. Check that the queued item uploads once and retains its folder/tags.
- If a queued item’s folder was deleted on another device, check the recovery action in Settings and verify that related items stay grouped.

## Scope of this build

Password sign-in, Gallery, previews, personal edits, organized saves and Safari sharing are the focus. Social sign-in, APNs provider activation and persistent offline collection browsing remain tracked separately. Do not treat this guide as a claim that those features are ready.

If a test fails, record the TestFlight build number, iPhone/iOS version, action and expected result. A screenshot or short screen recording helps reproduce UI issues; avoid including passwords or private saved content.
