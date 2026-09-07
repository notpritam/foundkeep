# Foundkeep 1.0.0 — Chrome Web Store reviewer guide

Use this with the private reviewer credential file generated for the release. Do not add passwords or recovery codes to this repository, a GitHub release, or the public listing.

## Before submitting

1. Upload `foundkeep-store-1.0.0.zip` in the Chrome Web Store dashboard.
2. Copy the 32-character extension ID assigned by Google.
3. Add the ID alongside the existing self-hosted ID in `apps/web/customer-config.json` and the production `ATLAS_CUSTOMER_EXTENSION_IDS` value.
4. Deploy those two allowlist changes and verify `https://foundkeep.app/customer-config.json` returns both IDs.
5. Install the exact uploaded package from the dashboard's trusted-tester flow and run the release checks below.

The allowlist step is required because the website can connect only extension origins that Foundkeep explicitly trusts. It does not grant access to any account.

## Test account

Paste the sign-in URL, email, and password from the private `REVIEWER-CREDENTIALS-1.0.0.md` file into the dashboard's **Test instructions** field. The account contains three harmless sample captures and has no administrative access.

## Reviewer path

1. Install and pin Foundkeep.
2. Sign in at `https://foundkeep.app/auth.html?mode=login` with the supplied reviewer account.
3. On the dashboard, choose **Connect this browser**. The page creates a short-lived, single-use pairing code; the extension claims it and stores a scoped browser credential.
4. Open any public HTTP(S) page and open the extension popup.
5. Choose **Save page**. Foundkeep stores the readable page text plus the original and canonical URLs, title, site, description, author, dates, language, lead image URL, favicon URL, heading outline, timestamps, extraction status, capture method, and a SHA-256 content fingerprint when available.
6. Try a highlight, a region or full-page screenshot, a PNG/JPEG/WebP image from the right-click menu, and a note. Each item first commits to the extension's local IndexedDB library. New items then sync to the connected private account when automatic sync is enabled.
7. Return to the dashboard and open a capture. The **Original source** section shows the stored provenance and links back to the source.
8. Open **Account & extension settings**. Change any capture method, bookmark detail, note-source, popup, sync, organization, badge, or context-menu setting and save. If the extension is detected, the dashboard refreshes it immediately; otherwise it refreshes within five minutes.
9. Optional account checks: export the cloud library or delete a newly created test capture. Please leave the supplied account password, recovery code and browser connection unchanged for later reviewers.

## Expected data flow

- Local capture: IndexedDB in the extension profile.
- Connection settings and preference cache: `chrome.storage.local`, restricted to trusted extension contexts.
- Cloud copy: owner-scoped Foundkeep SQLite records on the Foundkeep server; images are stored as validated PNG, JPEG, or WebP bytes.
- Authentication: an HttpOnly website session cookie for the dashboard and a separately revocable bearer credential for the connected extension.
- Network destinations: `https://foundkeep.app` for account preferences and sync, plus the user-selected image URL when **Save image** is invoked.

## Browser support

The submitted store package targets Chromium desktop browsers. Chrome is the reviewed distribution channel. Edge, Brave, Opera, Vivaldi, and Chromium support the same MV3 APIs and can use the manual package while their own store channels are prepared. Firefox and Safari are not included in 1.0.0.

## Remote configuration and updates

Foundkeep does not download or execute remote code. Twenty account settings and a narrowly scoped operator policy are data-only controls delivered over HTTPS and validated by the extension. The operator policy can disable packaged features and lower packaged safety limits; it cannot add behavior, permissions, origins, or code. Changes to JavaScript, permissions, content scripts, manifest fields, security behavior, or executable UI logic require a new reviewed store version. Chrome Web Store then distributes approved updates automatically.
