# Foundkeep social sign-in setup

Implementation date: September 9, 2026. Social providers remain disabled until configured and tested. Existing Foundkeep password login and collections continue working.

## What is connected

The personal Supabase project URL and server secret key have been securely supplied. Read-only checks of Auth settings and the admin endpoint both returned HTTP 200. The project currently advertises **email only**. No Supabase password-account migration has been performed.

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

Open this project's **Authentication → URL Configuration**:

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

## Google

1. In your personal Google Cloud project, configure the OAuth consent screen for Foundkeep. Use `foundkeep.app` as the authorized domain, `https://foundkeep.app` as the homepage, and the live privacy/terms pages.
2. Create an OAuth client of type **Web application**. Authorized JavaScript origin: `https://foundkeep.app`. Authorized redirect URI: the Supabase provider callback above.
3. In Supabase **Authentication → Sign In / Providers → Google**, enter the Google client ID and client secret and enable Google. Keep email verification checks enabled.
4. While Google's consent app is in Testing, add the personal accounts that will test it. Complete Google's production/verification requirements before offering it publicly.

No Google client secret is needed in Foundkeep or Expo; enter it directly in Supabase.

## GitHub

1. In your personal GitHub **Settings → Developer settings → OAuth Apps**, create a new OAuth app named Foundkeep.
2. Homepage: `https://foundkeep.app`. Authorization callback URL: the Supabase provider callback above.
3. Generate a client secret and enter the client ID and secret directly in Supabase's GitHub provider settings; enable GitHub.

Foundkeep requests basic profile and email scopes (`read:user user:email`), not repository access. A verified email is required.

## Apple — required before iPhone social buttons are enabled

This implementation uses Apple's browser OAuth flow through Supabase.

1. In your personal Apple Developer team **6HVH7CKN3M**, enable Sign in with Apple for the primary Foundkeep App ID `app.foundkeep.ios`.
2. Register a **Services ID** for browser sign-in, for example `app.foundkeep.auth`. Associate it with the primary Foundkeep App ID.
3. Configure its website domain as `lxeuplzhtzpugnvgyrzo.supabase.co` and its exact return URL as the provider callback above. Follow any domain verification Apple requests.
4. Create a key with **Sign in with Apple** enabled. You need its private `.p8` file, Key ID, Team ID, and Services ID to generate the Apple client-secret JWT. Enter the Services ID and generated secret in Supabase's Apple provider settings; enable Apple.
5. Apple's browser OAuth secret must be renewed before its expiry (maximum six months). Supabase documents this rotation requirement.

The existing App Store Connect upload key is a different kind of key; it cannot substitute for a Sign in with Apple key. If help generating the Apple secret is needed, provide its `.p8` only through secure file/secret input.

## X / Twitter — optional

The backend has an opt-in `twitter` adapter. Configure the corresponding provider in Supabase using the callback above. Only enable it if your X developer application can return a verified email with the permissions and provider flow currently supported by Supabase. Accounts without a verified email are rejected. Google/GitHub/Apple should be tested first.

## Activate after provider setup

The operator must add this server-only setting to the protected backend environment after successful provider setup:

```dotenv
FOUNDKEEP_OAUTH_PROVIDERS=apple,google,github
```

Restart `atlas-backend` to apply. The provider discovery response contains only allowlisted provider names. A disabled provider disappears without a client release. iOS advertises no social methods until `apple` is included; the website may enable a subset independently. The old Atlas website redirects to Foundkeep before sign-in, preserving the canonical host cookie boundary.

Perform real-provider tests on an isolated backend/staging origin with a narrowly scoped additional callback, then enable production and verify new account, returning account, existing-password-account connection, canceled sign-in, Share-sheet upload, dashboard sync, and account deletion. Never enable a provider based only on mock tests or discovery.

The iPhone implementation opens the system browser and returns through the existing custom scheme. A terminated app intentionally loses its temporary proof and asks the customer to start again. Navigating away cancels screen ownership; late-issued device credentials are revoked. OAuth UI can be delivered with a compatible EAS Update after physical-device verification. Native entitlement, permission, module, or runtime changes still require a new App Store binary. Version remains `1.0.0`.

Update App Store privacy/review information for the authentication processor and sign-in options before publishing the social-sign-in app release. This code change does not submit a new Apple build or silently change a build under review.

## Details still needed

- Confirmation that the Supabase Site URL and callback allowlist are saved.
- Google provider configured with its client ID/secret in Supabase.
- GitHub provider configured with its client ID/secret in Supabase.
- Apple Services ID, Sign in with Apple Key ID/private key, and provider configuration. Team ID is already known.
- An account available for each real-provider test. Do not send its password.

No additional Supabase anon key, database password, or database connection string is required.

## Official references

- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [GitHub setup](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [Apple setup and secret rotation](https://supabase.com/docs/guides/auth/social-login/auth-apple)
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
