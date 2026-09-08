# Foundkeep Mobile Collection Design

## Goal

Foundkeep for iPhone is a private universal collection. A customer can share a link, selected text, photo, screenshot, PDF, document, audio clip, video, or several items from any iOS app and save them without opening Foundkeep first. The same account and collection appear in the mobile app, browser extension, and web dashboard.

Version 1.0.0 includes account creation, sign-in and recovery, an iOS Share Extension, a searchable collection, capture details, source links, upload recovery, account settings, and production-safe over-the-air updates.

## Architecture decision

Three integration paths were evaluated:

1. **Owned native Swift Share Extension with an Expo app — selected.** The extension renders and saves inside Apple's Share sheet. It shares credentials and a durable queue with the containing app through an App Group and shared Keychain access group. This matches the expected WhatsApp-style flow and keeps the extension's memory use low.
2. **Expo `expo-sharing` inbound sharing.** SDK 57 can add a Share Extension target, but the documented implementation opens the containing app instead of completing the action inside a `ShareViewController`. Expo marks the capability experimental and notes that Apple does not officially support this behavior.
3. **Third-party React Native share extension.** `expo-share-extension` supplies a custom React Native share UI, but the stable compatibility table stops before SDK 57 and current SDK support is beta. Shipping it would make the highest-value flow depend on an unverified native compatibility layer.

The selected design uses Expo SDK 57 for the main application and an owned config plugin that adds the native Swift target during prebuild. Native code remains small and purpose-built. The app requires a development build or App Store build; Expo Go cannot load the custom target and native bridge.

## Customer flow

1. The customer installs Foundkeep and creates an account or signs in once.
2. The app stores a 90-day device connection token in the shared Keychain and non-secret account details in the shared App Group.
3. Foundkeep appears in the system Share sheet for URLs, plain text, images, movies, audio, PDFs, and general file attachments, including multiple items.
4. The Share Extension shows the items, original application or web source when iOS supplies it, an optional note, and **Save to Foundkeep**.
5. The extension writes a durable queue record before attempting network delivery. A successful upload removes the local payload. An offline or interrupted upload remains queued and the app retries it when opened.
6. The saved item appears in one collection on mobile and web. Multiple attachments from one Share action share a `batchId`, but each remains independently searchable, downloadable, retryable, and deletable.

If the device is not connected, the Share Extension explains that Foundkeep must be opened once and offers an **Open Foundkeep** action. It never asks for a password inside another app's Share sheet.

## Collection model

Every atomic item is a capture. Existing `screenshot`, `selection`, `bookmark`, `image`, `note`, and `tweet` values remain valid. Mobile adds `video`, `audio`, `document`, and `file`. A multi-item Share action creates several captures with the same optional `batchId` and note. This avoids a parent record that has no meaningful content and preserves backward-compatible capture URLs.

New capture metadata is additive:

```ts
type MobileCaptureMetadata = {
  clientId: string;
  batchId?: string;
  type: "bookmark" | "selection" | "image" | "video" | "audio" | "document" | "file" | "note";
  sourceUrl?: string;
  sourceTitle?: string;
  noteText?: string;
  selectionText?: string;
  fileName?: string;
  fileMime?: string;
  capturedAt: number;
  provenance: CaptureProvenance;
};
```

`clientId` is unique per account and makes every upload idempotent. `batchId` is a random UUID created once per Share action. File payloads are stored outside SQLite under the backend data directory and referenced by a server-generated relative storage key. Legacy image BLOBs remain readable.

## Origin and provenance

Foundkeep records only context supplied by the customer, iOS item providers, or bundled webpage preprocessing code. It does not monitor browsing or other applications.

For every share, provenance schema version 1 records:

- `captureMethod`: `ios-share-url`, `ios-share-text`, `ios-share-image`, `ios-share-video`, `ios-share-audio`, `ios-share-document`, `ios-share-file`, or `ios-app-note`.
- `sourceApplication`: the source application bundle identifier when iOS supplies it.
- `pageUrl` and `canonicalUrl` for Safari shares, retaining the exact visited URL separately from canonical metadata.
- `pageTitle`, site name, description, authors, dates, language, lead image URL, favicon URL, and readable text when the bundled Safari preprocessing script can safely extract them.
- `originalFileName`, declared content type, byte size, capture time, extraction time, extractor version, and a SHA-256 content hash for uploaded bytes or normalized text.

URLs are limited to credential-free HTTP(S) values. File names are normalized to a basename. Caller-supplied paths and executable metadata are never trusted. Unknown binary formats are stored as generic files and downloaded as attachments instead of rendered inline.

## Mobile authentication

Native account endpoints accept JSON over TLS and issue a device connection token rather than a browser cookie:

- `POST /api/mobile/register`
- `POST /api/mobile/login`
- `POST /api/mobile/recover`
- `GET /api/mobile/me`
- `POST /api/mobile/logout`

Registration and recovery return the same one-time recovery code behavior as the web flow. Password hashing, request limits, account ownership, connection expiry, connection limits, and revocation reuse the existing backend rules. Password recovery revokes existing mobile and browser connections. The dashboard lists the iPhone as another connected device.

The raw token is returned once, stored only in the iOS shared Keychain group, and sent as `Authorization: Bearer`. Account deletion, password recovery, logout, or dashboard revocation invalidates it server-side.

## Upload API and storage

Text and URL captures use the existing bounded JSON route with bearer authentication. Binary captures use:

```http
POST /api/mobile/captures/file
Authorization: Bearer <device token>
Content-Type: <payload MIME>
Content-Length: <bytes>
X-Foundkeep-Capture: <base64url encoded JSON metadata>

<raw file bytes>
```

The metadata header is limited to 16 KiB after decoding. A file is limited to 50 MiB, an account remains limited to 1,000 captures and 200 MiB, and active uploads retain the existing per-account and global concurrency bounds. The server streams to a randomly named temporary file, checks the actual byte count, sniffs supported safe formats, verifies images, checks quota again in the same critical section, moves the file atomically, then commits its capture row. Failed or disconnected requests remove the temporary file.

Safe images, PDFs, audio, and video may render inline with `nosniff` and a restrictive content security policy. Other formats use `Content-Disposition: attachment`. Filenames are escaped according to RFC 5987. Mobile bearer credentials can read their owner's collection and files; web sessions keep the existing browser experience.

Deleting a capture or account removes its file. Account export emits capture metadata and includes links for separately streamed files so the JSON response cannot exhaust server memory.

## iOS shared storage and retry behavior

The app and extension share:

- Keychain access group `$(AppIdentifierPrefix)app.foundkeep.shared` for the device token.
- App Group `group.app.foundkeep.ios` for non-secret session metadata, policy, pending JSON records, and copied payload files.
- URL scheme `foundkeep://` for opening the containing app when setup is required.

The native bridge exposes typed methods to sign in/out of shared storage, list pending records, submit pending records, and delete only payloads owned by a completed record. Queue writes use a temporary file plus atomic rename. The extension never removes a payload before a 2xx idempotent response. Retries use bounded exponential backoff and retain the same `clientId`.

iOS does not guarantee background execution after a share sheet closes. The extension makes a time-bounded direct attempt and the containing app drains the queue at launch, foreground, manual retry, and permitted background refresh opportunities.

## Main app

The main Expo app uses native stack navigation and four primary surfaces:

- **Welcome and account:** create account, sign in, recovery, one-time recovery-code acknowledgement.
- **Collection:** search, type chips, refresh, queue status, item cards, useful empty/error/offline states, and grouped context for multi-item shares.
- **Item detail:** safe preview, text, note, automatic summary/tags when available, capture metadata, complete origin record, source link, download/share, and delete.
- **Settings:** account details, device connection state, pending uploads, retry control, privacy/support links, sign out, and delete-account handoff to the web account surface.

The visual system follows Foundkeep's warm paper `#f3f3f0`, ink `#171917`, vermilion `#c63b23`, moss `#6b7553`, restrained borders, and direct product language. Dynamic type, VoiceOver labels, 44-point hit targets, safe-area insets, dark-mode contrast, keyboard movement, and Reduce Motion are required.

## Runtime policy and over-the-air updates

The app uses `expo-updates` with EAS Update channels `preview` and `production` and `runtimeVersion: { "policy": "fingerprint" }`. JavaScript, React UI, assets, copy, API routing, feature availability, limits below the binary's hard ceiling, and safe data-only policy can update over the air within a compatible runtime.

The backend publishes a signed, versioned, data-only mobile policy. The app and Share Extension cache the last valid policy and fall back to bundled safe defaults. The policy may disable a content kind, change display copy, change timeouts within fixed bounds, or require a minimum binary version. It cannot supply JavaScript, Swift, HTML, URLs outside the allowlisted Foundkeep API origin, entitlements, or new permissions.

Native Share Extension code, entitlements, Info.plist activation rules, iOS deployment target, Expo SDK/native dependencies, and security changes that alter native behavior require a new App Store build. App Store automatic updates distribute those builds according to the customer's device settings.

## Identifiers and release

- Product name: `Foundkeep`
- App version: `1.0.0`
- iOS build number: `1`
- Main bundle identifier: `app.foundkeep.ios`
- Share Extension identifier: `app.foundkeep.ios.ShareExtension`
- App Group: `group.app.foundkeep.ios`
- Public origin and API: `https://foundkeep.app`
- Support: `https://foundkeep.app/support.html`
- Privacy: `https://foundkeep.app/privacy.html`

The project pins the current Expo SDK 57 release line and uses an EAS development build for native verification. EAS Update production publishing happens only after an App Store binary with the matching runtime is installed.

## Verification and release gates

- Backend tests cover native auth, ownership, idempotent text and file uploads, type/MIME limits, interrupted streams, quota, safe serving, deletion cleanup, and revocation.
- TypeScript tests cover API serialization, queue state transitions, retries, file classification, and search/filter behavior.
- Expo config inspection and iOS prebuild verify the bundle IDs, target, activation rules, entitlements, App Group, Keychain group, privacy strings, deployment target, and native source membership.
- A real iPhone development build verifies first launch, sign-up, recovery code, Share sheet discovery, share from Safari/Photos/Files/Voice Memos, multiple selection, offline queue, retry, source navigation, sign out, and revoked-token handling.
- Store artifacts include the app icon, launch screen, iPhone screenshots, privacy answers, support/privacy URLs, App Review account, and reviewer steps.

The repository can prove code, web/backend behavior, Expo configuration, and generated iOS project on Linux. Compilation, signing, TestFlight installation, and real Share sheet verification require EAS/Apple credentials and an iPhone.
