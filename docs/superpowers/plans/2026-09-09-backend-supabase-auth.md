# Backend-owned Supabase Auth implementation plan

**Goal:** Add social sign-in through Foundkeep without distributing Supabase keys or tokens.
**Architecture:** Verified Supabase identities map to existing Foundkeep accounts; the backend issues existing web/native sessions. Two PKCE exchanges and browser binding protect the provider callback and native handoff.
**Tech Stack:** Bun, Hono, SQLite, Supabase Auth REST, React Native/Expo, browser Web Crypto.
**Spec:** ../specs/2026-09-09-backend-supabase-auth-design.md

## Constraints

Version stays 1.0.0. Providers are off until configured and verified. Existing captures and password login continue working. Never log upstream auth responses or expose keys. No silent email-based account merges. Apple must be configured before iOS advertises third-party sign-in.

## Tasks

- [x] Add `apps/backend/src/supabase-auth.ts`: strict server config, provider authorization redirect, PKCE code exchange, verified identity lookup, remote deletion. Bound every network request and sanitize errors. Test with injected fetch.
- [x] Add SQLite identity/flow/deletion-proof/cleanup tables; add `customer-oauth.ts` route module using existing account/session/rate helpers. Write failing integration tests first, then implement cookie binding, local-verifier handoff, collision password confirmation, credential-bound deletion and bounded cleanup.
- [x] Add web provider buttons and a completion module with sessionStorage verifier, allowlisted destinations and explicit account-link password confirmation. Add social reauthentication for account deletion.
- [x] Add native provider buttons and root OAuth completion screen. Keep pending verifier in memory, reject unsolicited/expired deep links, exchange only at Foundkeep, then store its device session through the shared Keychain. Support existing-account linking and deletion reauth.
- [x] Run backend/mobile tests, type checks, compiled browser interaction checks, static secret-boundary checks. Request independent security code review before merging.
- [x] Document Supabase/provider callback setup and secure credential input. Keep production social login disabled until actual credentials and live validation are available; record remaining activation work accurately.
