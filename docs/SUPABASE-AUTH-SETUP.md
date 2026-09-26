# Foundkeep social sign-in setup

Implementation date: September 9, 2026. Apple and Google were enabled in production for real-account testing on September 10, 2026. Existing Foundkeep password login and collections continue working. Successful provider token exchange and physical-iPhone sign-in still need verification.

## What is connected

The personal Supabase project URL and server secret key have been securely supplied. Read-only checks of Auth settings and the admin endpoint both returned HTTP 200. The project now advertises **email, Apple, and Google** (September 10, 2026); GitHub and X remain disabled. No Supabase password-account migration has been performed.

Rechecked September 9, 2026 after TestFlight build 15: Supabase Auth settings and admin access both return HTTP 200; Google, Apple, GitHub and legacy Twitter are disabled. Foundkeep's production provider discovery returns an empty list for both web and iOS. This verifies connectivity and disabled-provider state, not successful real-provider sign-in. This historical check did not verify the dashboard Site URL or redirect allowlist. On September 10, live Apple and Google cancellation flows returned to their exact generated Foundkeep callbacks, verifying acceptance of those callback URLs; the dashboard Site URL itself was not inspected.

Backend credentials are in `/home/pritam/.config/foundkeep/supabase.env`, outside Git, with owner-only permissions. The backend service loads this file using `deploy/foundkeep-auth.conf`. Do not put keys in Expo/EAS public variables, app configuration, web scripts, browser-extension configuration, or chat.

## How sign-in works

1. The website or iPhone creates a temporary proof and asks Foundkeep to start sign-in.
2. Foundkeep's backend starts Supabase PKCE authorization and redirects the system browser to the selected provider. A separate HttpOnly browser cookie binds the callback.
3. The provider returns to Supabase. Supabase redirects a short-lived authorization code to Foundkeep's backend.
4. The backend exchanges that code, verifies the user with Supabase, and discards upstream session tokens. It maps the verified Supabase subject to a Foundkeep account.
5. A one-use Foundkeep handoff returns to the original website tab or `foundkeep://oauth/complete`. The original local proof is required to redeem it. A copied deep link cannot sign into another device.
6. Foundkeep issues its own HttpOnly browser cookie or revocable iPhone credential. The iPhone credential is stored in the shared Keychain, so Share-sheet saves use the same account. The extension continues to pair through the web dashboard.

Supabase is the social identity provider; Foundkeep's existing backend and storage remain responsible for accounts, collections, captures, preferences, and device access. Existing password accounts stay local. A matching email alone never silently merges collections: connecting a social identity to an existing password account requires that account's current password and explicit confirmation.

Social-only accounts reauthenticate with a provider before explicitly confirming account deletion. Foundkeep deletes local data immediately, queues deletion of the Supabase identity, and retries outages. A bounded 24-hour identity tombstone blocks old in-flight callbacks. Deleted provider accounts such as Google/GitHub themselves are unaffected.

The app/website contain **no Supabase SDK, anon/publishable key, secret/service-role key, or Supabase session tokens**. Provider consent pages necessarily show public OAuth client IDs and callback domains. Those public routing details cannot be hidden by a backend architecture. Foundkeep's own device credential is necessarily held by the installed app to authenticate its requests.

## Supabase dashboard

Open the [existing Supabase project](https://supabase.com/dashboard/project/lxeuplzhtzpugnvgyrzo), then **Authentication → URL Configuration**:

| Field | Value |
| --- | --- |
| Site URL | `https://foundkeep.app` |
| Redirect URL | `https://foundkeep.app/api/auth/oauth/callback/*` |

The narrowly scoped wildcard is required because each callback contains a random flow ID. Do not add a whole-domain wildcard or the iPhone custom scheme to Supabase: only Foundkeep's backend receives the Supabase code.

All providers use this **provider callback URL**:

```text
https://lxeuplzhtzpugnvgyrzo.supabase.co/auth/v1/callback
```

This URL is public configuration, not a credential.

Configure social methods under **Authentication → Sign In / Providers**. There is no need to enable Supabase's OAuth Server feature. The existing Foundkeep password and recovery-code flow remains on our backend; Supabase email login, password-reset emails, and magic links are not connected to that flow. SMTP is not required merely to activate these social providers.

## Google

Use [Google Cloud Console](https://console.cloud.google.com/) with `notpritamsharma@gmail.com`, and create or select a personal project named **Foundkeep**. Open **Google Auth Platform**.

| Field | Value |
| --- | --- |
| App name | Foundkeep |
| User support email / developer contact | `notpritamsharma@gmail.com` |
| Audience | External |
| Homepage | `https://foundkeep.app` |
| Privacy policy | `https://foundkeep.app/privacy.html` |
| Terms of service | `https://foundkeep.app/terms.html` |
| Authorized domain | `foundkeep.app` |
| Data access | `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile` |
| OAuth client application type | Web application |
| Client name | Foundkeep Web Sign-In |
| Authorized JavaScript origin | `https://foundkeep.app` |
| Authorized redirect URI | `https://lxeuplzhtzpugnvgyrzo.supabase.co/auth/v1/callback` |

Create the client, then enter its **Client ID** and **Client secret** directly in Supabase **Authentication → Sign In / Providers → Google**, enable the provider, and save. Keep email and nonce validation enabled. Add testers if Google's console requires them for the chosen testing configuration, and complete its production/branding requirements before public launch. Basic sign-in does not need Gmail, Drive, or Calendar scopes.

The current browser-mediated flow uses the web client for both the website and iPhone. It does not need a separate iOS Google client or Chrome-extension Google client.

No Google client secret is needed in Foundkeep or Expo; enter it directly in Supabase.

## GitHub

1. In your personal GitHub [Settings → Developer settings → OAuth Apps](https://github.com/settings/developers), create a new OAuth app named Foundkeep. Use an OAuth App, not a repository-access GitHub App.
2. Homepage: `https://foundkeep.app`. Authorization callback URL: the Supabase provider callback above.
3. Generate a client secret and enter the client ID and secret directly in Supabase's GitHub provider settings; enable GitHub.

Foundkeep requests basic profile and email scopes (`read:user user:email`), not repository access. A verified email is required.

## Apple — required before iPhone social buttons are enabled

Build 15 uses Apple's browser OAuth flow through Supabase. `apps/mobile/app.json` currently has `usesAppleSignIn: false`: native Apple Authentication Services are not implemented in this binary. Supabase recommends native Apple sign-in on iOS. Adding that module, entitlement, and backend ID-token exchange would require another binary, while retaining backend-only Supabase keys. The browser flow can be configured and tested with the steps below.

1. In your personal Apple Developer team **6HVH7CKN3M**, enable Sign in with Apple for the primary Foundkeep App ID `app.foundkeep.ios`.
2. Register a **Services ID** for browser sign-in: description **Foundkeep Sign In**, proposed identifier `app.foundkeep.auth`. Enable Sign in with Apple on that Services ID and associate it with the primary Foundkeep App ID `app.foundkeep.ios`.
3. Configure its website domain as `lxeuplzhtzpugnvgyrzo.supabase.co` and its exact return URL as the provider callback above. Apple's current web configuration instructions say a server verification file is not required.
4. Create a key with **Sign in with Apple** enabled. You need its private `.p8` file, Key ID, Team ID, and Services ID to generate the Apple client-secret JWT. Enter the Services ID and generated secret in Supabase's Apple provider settings; enable Apple.
5. Apple's browser OAuth secret must be renewed before its expiry (maximum six months). Supabase documents this rotation requirement.

The existing App Store Connect upload key is a different kind of key; it cannot substitute for a Sign in with Apple key. If help generating the Apple secret is needed, provide its `.p8` only through secure file/secret input.

| Apple/Supabase field | Value |
| --- | --- |
| Apple team | `6HVH7CKN3M` |
| Primary App ID | `app.foundkeep.ios` |
| Services ID to create | `app.foundkeep.auth` |
| New signing-key name | Foundkeep Sign In with Apple |
| Signing-key capability | Sign in with Apple, associated with Foundkeep |
| Supabase Apple Client IDs, current browser flow | `app.foundkeep.auth` |
| Supabase Apple secret | Generated client-secret JWT, not the raw `.p8` contents |

Use the local-in-browser generator in [Supabase's Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple#configuration), with the Team ID, Services ID, new Key ID and private signing key. Keep the `.p8` for renewal and record the JWT expiry; renew before it expires. If native Apple sign-in is subsequently added, include `app.foundkeep.ios` after the Services ID in Supabase's Client IDs; the Services ID must remain first for browser sign-in.

Apple's browser flow does not provide a full name to this adapter. Test the profile-name fallback and Hide My Email. A private-relay email is a valid account email, but it cannot automatically identify an existing account under a different address. Do not promise automatic merging. Register outbound email sources with Apple's private relay if Foundkeep later sends email to those relay addresses.

## X / Twitter — optional

The backend currently has a legacy `twitter` adapter. Supabase now offers **X / Twitter (OAuth 2.0)** using provider identifier **`x`**. Enabling that new provider alone will not make our existing adapter compatible: its authorization request and identity verification need updating and tests. Keep X disabled until that work is complete; prioritize Apple, Google, then GitHub for launch.

For a new X developer app, use its web OAuth 2.0 setup, enable requesting the user's email, set the same Supabase provider callback, and enter its Client ID and Client secret in Supabase's **X / Twitter (OAuth 2.0)** provider. Our backend requires a verified email. Do not confuse the OAuth 2.0 client credentials with legacy API-key credentials. See [Supabase's current X provider announcement](https://supabase.com/blog/x-twitter-oauth-2-provider).

## Activate after provider setup

The operator must add this server-only setting to the protected backend environment after successful provider setup:

```dotenv
FOUNDKEEP_OAUTH_PROVIDERS=apple,google
```

Restart `atlas-backend` to apply. The provider discovery response contains only allowlisted provider names. A disabled provider disappears without a client release. iOS advertises no social methods until `apple` is included; the website may enable a subset independently. The old Atlas website redirects to Foundkeep before sign-in, preserving the canonical host cookie boundary.

Prefer an isolated backend/staging origin with a narrowly scoped additional callback for real-account tests. For the authorized production testing rollout on September 10, Apple and Google were enabled after live provider-page and callback preflight checks. This enables the customer to finish real-account testing; it does not establish release readiness. Verify new account, returning account, existing-password-account connection, Share-sheet upload, dashboard sync, and account deletion before treating social sign-in as fully verified.

The iPhone implementation opens the system browser and returns through the existing custom scheme. A terminated app intentionally loses its temporary proof and asks the customer to start again. Navigating away cancels screen ownership; late-issued device credentials are revoked. OAuth UI can be delivered with a compatible EAS Update after physical-device verification. Native entitlement, permission, module, or runtime changes still require a new App Store binary. Version remains `1.0.0`.

Update App Store privacy/review information for the authentication processor and sign-in options before publishing the social-sign-in app release. This code change does not submit a new Apple build or silently change a build under review.

## Details still needed

- Complete Google and Apple sign-in with real accounts on the website and TestFlight build 15. Do not send account passwords.
- Verify existing-account connection, returning sign-in, Apple Hide My Email, iPhone handoff, Share-sheet sync, logout, and account deletion.
- GitHub configuration is optional and still pending; leave it disabled until configured and tested.
- No additional Apple key or Google client secret is needed. Apple configuration and the generated client secret have already been supplied.

No additional Supabase anon key, database password, or database connection string is required.

Google and GitHub secrets should be entered directly in Supabase; a confirmation that each provider is saved is sufficient for us. Apple private-key access is only needed if we are generating or renewing its client secret on your behalf. Never send provider passwords or paste private keys into chat.

## Remaining release checks

Provider configuration is the main authentication blocker, but credentials alone do not establish release readiness. Real-provider tests must cover new/returning accounts, existing password-account connection, Apple Hide My Email, cancellation, expired/replayed callbacks, iPhone return links, Share-sheet saves, dashboard sync, logout and account deletion. Enabling providers on the backend does not require a new binary by itself; adding native Apple sign-in does.

The latest saved App Store submission record also lists the App Review contact phone number and published App Privacy answers as unfinished. Recheck App Store Connect before final submission; that historical record refers to build 14, while the newer approved UI is in TestFlight build 15. Do not treat this document as proof that a public review submission has been made.

## Official references

- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [GitHub setup](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [Apple setup and secret rotation](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Apple Services ID and website configuration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/)
- [X OAuth 2.0 setup and migration](https://supabase.com/blog/x-twitter-oauth-2-provider)
- [Supabase API-key security](https://supabase.com/docs/guides/getting-started/api-keys)

## Verification and deployment record

September 9, 2026:

- Backend suite: 108 tests passed, including callback binding, PKCE, expiry/replay, existing-account confirmation, credential-bound deletion, cleanup, and in-flight deletion races.
- Mobile suite: 46 tests passed; mobile TypeScript passed. Compiled app browser checks cover start, returning callback, local proof, existing-account confirmation, cancellation, and cold-start rejection. Run `npm run verify:oauth` from `apps/mobile` after setting `CHROMIUM_PATH` if needed.
- Website: 19 browser tests passed, including real local account/collection flows and social callback UI.
- Independent review found and verified fixes for stale deletion handoffs, late native responses, callback ownership transitions and duplicate-return expiry. Real provider and physical-iPhone tests are still pending configuration.
- Credential-boundary scan found zero server-key or Supabase-project-configuration matches in web/extension assets and the compiled mobile preview.
- The production SQLite backup passed integrity verification. Backend service restarted with the protected Supabase environment file. Public provider discovery remains empty; attempts to start an unconfigured provider return 503.
- A disposable production password account successfully registered, saved/read a collection note, deleted its account, and lost access afterward. The test account was cleaned up.
- No OAuth OTA, new TestFlight binary, or new App Store review submission was published by this change.
- The repository's standalone backend `tsc` command still reports pre-existing errors in `apps/backend/src/captures.ts` and `apps/backend/test/backend.test.ts`; the newly added OAuth files produce no TypeScript errors. Runtime backend tests pass.

## September 10, 2026 activation check

Apple and Google are enabled upstream and allowlisted in the protected backend environment. The backend restarted successfully; public provider discovery returns exactly `apple,google` for web and iOS. GitHub and X remain disabled. No client release or version change was made.

- Both provider authorization pages returned HTTP 200 and showed sign-in UI without an authorization configuration error. Apple used Services ID `app.foundkeep.auth`.
- Live Apple and Google flows on both web and the iOS API passed authorization, exact backend callback routing, and cancellation. Website cancellation clears its temporary proof. iOS cancellation points to `foundkeep://oauth/complete`; opening the actual installed app is still unverified.
- The 15 backend gateway/OAuth tests passed with 92 assertions.
- These checks do not test a real account, successful provider token exchange, the Apple client secret at token exchange, or physical-iPhone login. The user must complete those tests next.
- The Apple signing key is kept outside Git with owner-only permissions. Its generated client secret expires March 9, 2027; renew by February 7, 2027. Keep “Allow users without an email” disabled; Apple's private relay address supplies an email.

[Live redirect evidence](auth-verification/2026-09-10/live-redirect-checks.json) · [Live mobile-width sign-in screenshot](auth-verification/2026-09-10/sign-in-mobile.png)
