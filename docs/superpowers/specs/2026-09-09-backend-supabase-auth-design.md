# Foundkeep backend-owned Supabase social authentication

The user explicitly selected a backend-only Supabase integration: no Supabase key, SDK session, provider token, or service credential in the website, extension, or mobile bundle. Existing email/password accounts and collections remain in Foundkeep SQLite. Supabase supplies verified social identities; Foundkeep remains the session and authorization authority. This is an additive social-auth integration, not a silent migration of password hashes or capture storage.

## Flow and trust boundaries

Clients request a configured provider from `/api/auth/providers`, generate a random local verifier, and send its SHA-256 challenge to `/api/auth/oauth/start`. The backend creates a bounded, expiring transaction with its own separate Supabase PKCE verifier. The returned URL is a Foundkeep authorization route. A secure HttpOnly per-flow cookie binds the browser callback; native clients establish this cookie when the system browser opens. The backend obtains the provider redirect from Supabase without exposing its API key. Providers return through Supabase to `/api/auth/oauth/callback/<flow-id>`.

The backend exchanges the Supabase code, reads `/auth/v1/user` using the resulting access token, validates confirmed email and provider identity, and discards all Supabase/provider tokens. The callback redirects a one-use, short-lived Foundkeep handoff code to the web completion page or `foundkeep://oauth/complete`. Redemption also requires the initiating client's verifier. This prevents an intercepted deep link from minting a session. Only redemption issues a Foundkeep web cookie or native device credential; native credentials enter the existing shared Keychain so the Share Extension continues working.

Identity mapping uses the verified Supabase user ID, never client-supplied profile data. An email collision with an existing local account requires that account's password and explicit connection confirmation. Existing mapped identities cannot silently move accounts. Social-only accounts can delete their account after a fresh provider round trip and final confirmation; a short-lived deletion proof is scoped to the existing Foundkeep credential. Deletion queues Supabase-user cleanup in a durable outbox so a provider outage cannot preserve the local account or its captures.

## Rollout

Providers default off. Server-only environment: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `FOUNDKEEP_OAUTH_PROVIDERS` (apple, google, github, twitter). No `EXPO_PUBLIC_`, `NEXT_PUBLIC_`, or browser config carries these. iOS social login is advertised only when Apple is enabled alongside other selected providers. Provider credentials are configured in Supabase's dashboard; no Google/GitHub client secret is needed in Foundkeep. Password authentication and installed version 1.0.0 continue working while credentials are supplied.

Do not publish an OAuth OTA update or change the App Store reviewer flow until the real providers have been configured and tested. Domain/client IDs in the browser consent flow are public identifiers, not secrets; the integration does not claim to hide OAuth protocol navigation. Foundkeep sessions are revoked by Foundkeep; Supabase admin changes do not retroactively revoke an already-issued Foundkeep session.

## Verification

Use an injected fake Supabase gateway for real Hono/SQLite integration tests: disabled providers, cookie/PKCE validation, expired/replayed/swapped codes, verified identity validation, email collision protection, account and credential revocation during callback, social-only deletion proof, cleanup retry, and absence of upstream tokens/keys in every public response. Preserve all existing customer tests. Test mobile callback parsing/PKCE and compiled web/mobile flows. Live OAuth testing requires the user's actual provider setup.
