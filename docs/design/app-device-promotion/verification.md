# App and extension promotion

Verified 10 September 2026. This change presents the iPhone app and browser extension as two ways into the same Foundkeep collection, preserving the scenic web design and existing native app.

## Customer flow

- The hero, platform section and footer offer iPhone access alongside the Chrome extension. iPhone/iPad browsers see the app first; desktop and Android retain the existing platform order.
- The account page links to both platforms. The dashboard has **Apps & devices**, separate iPhone/browser setup and a dismissible suggestion for adding the missing platform. Existing collections are not covered by a full onboarding panel.
- iPhone connection status means **connected to this account**, not installed on the current device. Browser status still uses the real extension handshake and preserves the account-switch confirmation.
- Opening the app with the same account shares the collection. Returning to the dashboard refreshes connection state; revocation removes the app from the active device status. An existing app connection retains an install link for another iPhone.
- iPhone access leads to real beta instructions and an email request; it does not promise immediate enrollment. Existing testers can open the installed app through the existing allowlisted handoff.

## Availability and configuration

Apple's authenticated API still reports version 1.0.0 as `PREPARE_FOR_SUBMISSION`, build 15 `VALID`, and the Foundkeep Internal beta group. No public App Store or external TestFlight release was asserted or created.

`apps/web/customer-config.json` owns `iphone.distribution` and `iphone.url`. Supported values:

- `private-beta`: safe default, links to `/support.html#iphone-beta`.
- `testflight`: a published `https://testflight.apple.com/join/...` URL.
- `app-store`: the published `https://apps.apple.com/.../id...` listing.

The client allows only those HTTPS Apple destinations. Invalid, unavailable or missing configuration retains usable private-beta instructions. Landing, dashboard, support and app-handoff links share this configuration. Changing website configuration does not require a mobile/extension binary update. Do not switch it until the configured destination is publicly available.

## Connection data

Schema 13 adds `customer_connections.client_kind`: browser, mobile or unknown. Issuing routes set it for browser pairing, mobile password/register/recovery and mobile OAuth. Existing rows remain unknown until an authenticated `/mobile/me` call identifies a legacy app connection; device names are never used to infer its type. This works with the installed app build. `/me` includes only live connections owned by the signed-in account and never returns their credentials.

A protected SQLite backup was taken before migration. Rehearsal on that copy preserved all account, identity, capture, connection, session and folder counts, with integrity `ok`. One pre-existing orphan connection foreign-key finding was unchanged; no unrelated records were removed.

## Validation

- Full Bun suite: **172 passed**, 0 failed. After adding the migration regression, the targeted migration/OAuth suite passed **21 tests**, 0 failed.
- Final customer web, real extension/customer flow and landing suite: **43 passed**, 0 failed.
- Ten desktop/phone captures: no horizontal overflow or browser script errors (`browser-check.json`). Fixtures contain no customer content.
- Independent code and visual review: **ship**. The requested beta button correction now measures 5.64:1 normal and 7.61:1 hover at both 1440px and 390px. Distribution configuration was also verified on support and app-handoff pages.
- Design detector ran once in degraded regex mode; remaining Geist warnings refer to the approved incumbent typeface. Computed contrast was checked separately by the reviewer.

Screenshots: [desktop landing](landing-desktop.png), [iPhone landing](landing-mobile.png), [desktop setup](setup-desktop.png), [iPhone setup](setup-mobile.png), [dashboard suggestion](dashboard-desktop.png).
