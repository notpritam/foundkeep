# Atlas customer release 1.5.0

Atlas 1.5.0 turns page bookmarks into traceable, readable captures and gives
customers direct control over their extension from the account dashboard.

## Customer behavior

- **Save page** keeps bounded readable article or main text and available
  headings. Raw page HTML is not stored.
- Every new capture keeps a structured origin record. Depending on the page and
  capture type, it includes the visited and canonical URLs, target URL, title,
  description, publisher, authors, dates, language, lead image, favicon,
  timestamps, capture method, extractor version, extraction status and SHA-256
  content fingerprint.
- Capture detail views show the origin record with safe links back to the page.
  The full record is also retained in account exports.
- Account settings control capture methods, bookmark extraction, note source
  attachment, popup action order and recents, right-click menus, automatic sync,
  OCR, summaries, tags and success feedback.
- Connected extensions refresh after a settings save and otherwise use a short,
  account-bound cache. Preference changes do not require reinstalling Atlas.
- The popup has a fixed header and footer, one scrolling surface, a primary page
  action, compact secondary actions, progress feedback, notes and configurable
  recent captures.
- One MV3 package supports Chrome, Edge, Brave, Opera and Vivaldi on desktop.
  Firefox and Safari packages are not part of this release.

## Data and processing

The browser stores local captures in IndexedDB. Connected captures upload to the
customer's private cloud library when automatic sync is enabled. Processing
choices are copied onto each capture at save time, so later preference changes
cannot silently change how queued content is handled.

Backend migrations 5 and 6 add account-owned preferences and provenance plus
processing options to customer captures. Both migrations are additive. Account
deletion removes the preference document as well as captures, connections and
sessions.

## Distribution

The self-hosted signed extension retains ID
`mjfcgmboaijfcaanepdipbgmipnccnpn`. Existing managed installations can update
from the GitHub release feed. Unpacked customers replace the files in their
existing folder and choose **Reload** in the browser's extensions page to retain
their local IndexedDB library.

Chrome Web Store publication still requires the publisher account and Google
review. The separate store upload omits the self-hosted signing key and update
URL. The live site continues to describe manual ZIP installation until an
approved store listing exists.

## Pre-deployment verification

The release candidate passed on 6 September 2026:

- 51 Bun backend tests, including tenant isolation, strict preferences,
  provenance validation, export, quotas and immutable processing choices.
- 39 extension tests, including a real Manifest V3 browser, readable extraction,
  every capture origin record, account switching, offline queues, preference
  caching and the 600px popup layout.
- 14 customer browser tests, including the real signup → connect → preference
  refresh → readable page/highlight/screenshot → dashboard → revoke flow.
- 5 landing browser tests across 320px through 1440px layouts.
- The signed CRX reports version 1.5.0, retains the established extension ID,
  matches the update manifest and passes signature verification.

## Production verification

Atlas 1.5.0 was deployed to `https://atlas.notpritam.in` on 6 September 2026
from commit `89ed5dbe8768b7fa0b4e8a474338a863261cd34a`.

- The pre-migration SQLite backup is
  `/home/pritam/.local/share/atlas/backups/before-atlas-1.5.0-20260906T161714Z.sqlite`;
  it has mode 0600 and passed `PRAGMA integrity_check`.
- The production database reached migration level 7 and passed its integrity
  check after the backend restart.
- The live landing checks and the complete live signup → connect → preference
  refresh → capture → dashboard → revoke → account cleanup journey passed.
- GitHub Actions run `34044961636` passed and published `ext-v1.5.0`. The
  downloaded release CRX passed signature, extension ID, version and update
  manifest verification. Store submission and listing-asset archives are
  attached to the release for publisher upload.
