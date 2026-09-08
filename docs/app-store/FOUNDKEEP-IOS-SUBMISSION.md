# Foundkeep 1.0.0 — App Store submission sheet

Use these values for the first iPhone release. Text marked **account-owner action** depends on the legal Apple Developer account and cannot be inferred from the codebase.

## 1. Create the app record

| App Store Connect field | Enter |
| --- | --- |
| Platforms | iOS |
| Name | `Foundkeep` |
| Primary language | English (U.S.) |
| Bundle ID | `app.foundkeep.ios` |
| SKU | `foundkeep-ios-100` |
| User access | Full Access, unless the team intentionally restricts this app |

The bundled Share Extension identifier is `app.foundkeep.ios.ShareExtension`. It is included inside the iPhone app and does not get a separate App Store record.

## 2. App information

| Field | Enter |
| --- | --- |
| Subtitle | `Keep what you find` |
| Primary category | Productivity |
| Secondary category | Utilities |
| Content rights | Yes — the app can display material a customer explicitly saves from another source. Confirm that Foundkeep's terms require customers to have the right to save that material. |
| License agreement | Apple's standard license agreement |
| Copyright | `2026 NotPritam` |

### Age rating questionnaire

Use these answers for the present private-collection build:

- Parental controls: No
- Age assurance: No
- Unrestricted web access: No. Source links open in the system browser; Foundkeep has no embedded browser.
- User-generated content: No. Foundkeep does not broadly distribute customer content.
- Messaging and chat: No
- Advertising: No
- Social media: No
- Every mature-theme, medical, sexuality, violence and chance-based-content frequency: None
- Gambling and loot boxes: No
- Made for Kids / higher-rating override: Not Applicable
- Age Suitability URL: leave blank

Apple should calculate the lowest general rating. Do not manually promise a numeric rating because Apple localizes ratings by region and OS version.

## 3. Pricing and availability

| Field | Enter |
| --- | --- |
| Price | Free |
| In-App Purchases | None |
| Availability | All intended countries/regions; omit any country where the account owner cannot meet local obligations |
| App release | Manually release this version, so the website and announcement can be coordinated after approval |
| Apple silicon Mac availability | Disable for 1.0.0; the Share Extension and interface are designed and tested for iPhone |
| Apple Vision Pro availability | Disable for 1.0.0 |
| EU Digital Services Act trader status | **Account-owner action:** answer from the seller's legal/business status and publish the required contact details if classified as a trader |

## 4. Version 1.0.0 listing

### Promotional text

```text
Save links, articles, highlights, photos, videos, audio, documents, files, and notes into one private collection—with every source attached.
```

### Description

```text
Foundkeep is a private collection for the things you want to return to.

Share from Safari, Photos, Files, and other iPhone apps without interrupting what you are doing. Foundkeep accepts links, readable pages, selected text, photos, videos, audio, PDFs, documents, and other files. You can also write a note directly in the app.

EVERY SOURCE STAYS ATTACHED
Foundkeep preserves the strongest origin record available: the original and canonical links, page title, site, author, dates, capture method, filename, media type, and capture time. Open a saved item to return to where it came from.

ONE PRIVATE COLLECTION
Everything you save appears in a searchable, filterable collection. Items shared together stay grouped together. The same account powers the iPhone app and your Foundkeep web dashboard.

BUILT FOR THE SHARE MENU
Open Foundkeep once to sign in. Then choose Foundkeep from the iOS Share menu, add an optional note, and save. If the network is unavailable, the Share Extension keeps a protected local copy and retries after you reopen Foundkeep.

OPTIONAL CAPTURE ALERTS
Turn on private capture-ready alerts from Settings. Alerts contain no saved title, text, source, file, email address, or account name. Tap an alert to open the exact item in Foundkeep.

YOU STAY IN CONTROL
Delete captures from the app, export your cloud library from the web dashboard, or permanently delete your account. Data-only safety policy and feature settings can refresh without changing native permissions. Native capabilities arrive through signed App Store updates.

Found it? Keep it.
```

### Keywords

```text
bookmark,read later,save links,collection,notes,share sheet,documents,highlights,research
```

### URLs

| Field | Enter |
| --- | --- |
| Support URL | `https://foundkeep.app/support.html` |
| Marketing URL | `https://foundkeep.app/` |
| Privacy Policy URL | `https://foundkeep.app/privacy.html` |
| Privacy Choices URL | `https://foundkeep.app/dashboard.html` |

The privacy-choices page requires the customer to sign in because it exports private account data. Permanent deletion is also available directly in the iPhone app under Settings.

### What's New

Leave blank for the first App Store version. App Store Connect only uses this field for later versions.

## 5. Screenshots

Upload the PNGs in `docs/app-store/screenshots/en-US/6.9-inch/` in filename order:

1. `01-welcome.png`
2. `02-collection.png`
3. `03-source-detail.png`
4. `04-new-note.png`
5. `05-settings.png`

Each image is a real render of the shipped React Native interface at 1290 × 2796 pixels, RGB, with no alpha channel. The sample content is fictional and contains no private customer data. No app preview video is needed for 1.0.0.

## 6. App privacy

Answer **Yes, we collect data from this app**. Foundkeep does not use data for tracking.

### Data linked to the customer

For every item below select **App Functionality**, **Linked to the User: Yes**, and **Used for Tracking: No**:

| App Privacy type | Why it is collected |
| --- | --- |
| Contact Info → Name | Creates and displays the customer's Foundkeep account |
| Contact Info → Email Address | Signs the customer in and identifies the account |
| Identifiers → User ID | Keeps captures scoped to the correct private account |
| User Content → Photos or Videos | Stores images or videos the customer explicitly shares |
| User Content → Audio Data | Stores audio the customer explicitly shares |
| User Content → Other User Content | Stores links, readable page text, highlights, notes, documents and files the customer explicitly shares |
| Browsing History | Stores the URL and available source metadata for pages the customer explicitly shares; the app does not monitor browsing |
| Identifiers → Device ID | Stores the opt-in Expo push token with the customer's revocable iPhone connection so capture-ready alerts reach that device |

### Data not linked to the customer

For every item below select **App Functionality**, **Linked to the User: No**, and **Used for Tracking: No**:

| App Privacy type | Why it is collected |
| --- | --- |
| Diagnostics → Crash Data | Used by Expo update delivery to diagnose update failures |
| Diagnostics → Other Diagnostic Data | Operating-system, error and delivery information keeps updates reliable |

Do not select health, financial, precise/coarse location, contacts, emails/text messages, search history, purchases, advertising, product personalization, or third-party advertising. Foundkeep does not request Apple's advertising identifier.

## 7. Export compliance

When asked whether the app uses encryption, answer based on Apple's exact flow:

- The app uses standard HTTPS and Apple-provided Keychain/security APIs.
- It does not implement proprietary or non-exempt cryptography.
- `ITSAppUsesNonExemptEncryption` is already `false` in the binary.
- No export-compliance document is expected for this build.

## 8. App Review information

### Sign-in information

- Sign-in required: Yes
- User name: copy it from the private reviewer-credentials artifact created during deployment
- Password: copy it from the same private artifact
- Contact first name / last name / phone / email: **Account-owner action:** use a monitored contact who can answer Apple during review

### Notes for App Review

```text
Foundkeep is a private collection app with an iOS Share Extension.

Use the supplied review account to sign in. The account contains fictional sample captures only.

To test the main app:
1. Sign in with the review credentials.
2. The Collection tab shows the private sample collection.
3. Open any item to see its saved source record.
4. Use New note to save a note, then delete it from its detail screen if desired.
5. Account deletion is available in Settings → Delete account and requires the current password plus a final confirmation.
6. In Settings, enable Capture-ready alerts. After saving a new note, the generic notification opens that exact item. Foundkeep does not put saved content or account details in the alert.

To test the Share Extension:
1. Open Safari and visit any public page.
2. Tap Share, choose More if needed, and select Foundkeep.
3. The extension shows the item and its source. Add an optional note and tap Save.
4. Return to Foundkeep; the item appears in Collection. If the device was offline, opening Foundkeep retries the protected queue.

The Share Extension also accepts selected text, images, video, audio, PDFs, documents, and other files up to 50 MiB each. It receives only items the reviewer explicitly shares. Source links open in the system browser. The app has no embedded unrestricted browser, advertising, social feed, messaging, purchases, or tracking.

Account export is available after signing in at https://foundkeep.app/dashboard.html. Permanent account deletion is available directly in the app under Settings. Privacy details are at https://foundkeep.app/privacy.html and support is at https://foundkeep.app/support.html.
```

## 9. Build and submission order

1. Confirm the Apple Developer account has the main App ID, Share Extension App ID, and App Group capability.
2. Authenticate EAS CLI and link the local Expo project.
3. Create the production iOS build from `apps/mobile`.
4. Install the build through TestFlight and test sign-in return links, capture notifications, notes, deletion, all Share-menu types, a multi-item share, offline queue retry, and source return links on a physical iPhone.
5. Upload/select build 1, add the screenshots and listing text, complete privacy and age-rating forms, and paste the private review credentials.
6. Submit for review with manual release selected.

Native code, entitlements, permissions, Share Extension changes and native dependency changes require a new App Store binary. Compatible JavaScript/interface fixes can ship through the production EAS Update channel. Foundkeep's remote mobile policy is strictly data-only and can change capture availability, bounded limits, notices and the minimum supported version without executing remote code.
