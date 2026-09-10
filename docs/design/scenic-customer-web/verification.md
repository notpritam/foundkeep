# Scenic customer web and account linking — 10 September 2026

The customer web inherits the approved scenic landing: social-first sign-in, a white gallery shell with azure controls, sky notes and mint highlights, plus matching setup/settings, item detail, support and policy surfaces. Native purple Gallery is unchanged.

Account linking preserves one local account and collection for matching verified provider emails. The selected upstream identity must attest the same verified email; Supabase account confirmation by itself is insufficient. A local password-only account needs its password once. Legacy mappings keep their ownership but receive no retroactive verification assertion; their next verified sign-in records the evidence. Established subjects do not move accounts when emails change. Apple private relay addresses remain separate. Pending old OAuth flows are invalidated by migration; active Foundkeep sessions/connections are preserved.

## Verification

- `bun test --timeout 120000`: 171 passing tests, 1,506 assertions.
- Targeted gateway/account-linking suite: 25 passing tests, including selected-provider false/missing/mismatched verification, first-link ownership, concurrent handoffs, native same-library access, all-identity deletion and legacy migration.
- Final customer, installed-extension customer-flow and landing browser suites: 38 passing tests after review corrections.
- A failed provider start leaves its message visible and both retry/secondary email usable.
- Responsive screenshots at 1440 and 390px; overflow checks also cover 320px. Gallery content in screenshots is fixture data, never a customer's library.
- Design detector ran once, in degraded regex mode because parser modules were unavailable. Only reported finding: Geist usage; retained to match the user's existing visual system. This scan does not certify contrast or accessibility.
- Existing account's configured identity checked through protected backend configuration: one mapped account checked, one compatible verified provider identity, no missing verification or lookup failures. This is not a completed interactive provider login.
- Production SQLite snapshot backed up with mode 0600 before deployment. Migration rehearsed on a copy: account/capture/identity/folder/session/connection counts retained. Schema 11 → 12. An existing orphan connection foreign-key finding was identical before/after; migration introduced none and did not alter that unrelated row.

## Review

The independent backend reviewer identified insufficient selected-provider email verification. Fixed and re-reviewed: no substantive remaining issues in the reviewed backend scope.

The visual reviewer requested stronger auth-scene text contrast, stronger input boundaries and saved content before metadata. Applied as a single batch: stronger scene overlay, control border #708f9a, and collapsed Source details after saved content. Focused final verdict: **ship**, all three listed fixes resolved. Reviewer samples: desktop scene supporting text 5.85–6.22:1; phone large heading 3.53–5.36:1; input borders 3.45:1. This focused verdict is not a comprehensive accessibility certification.

## Artifacts

`auth-desktop.png`, `auth-mobile.png`, `dashboard-desktop.png`, `dashboard-mobile.png` show the selected customer web. Extended viewport/dialog evidence is under `.impeccable/review/` locally.

Existing mountain assets are reused from the landing; provenance is in `../scenic-landing/assets.md`. Provider SVGs are bundled vector brand marks for their labeled sign-in methods. No remote scripts, fonts or provider image requests were added.

## Release limits

A real successful Google/Apple login and cross-provider login should still be exercised by the account owner. Automated tests use verified gateway fixtures and check account/data ownership end to end. Supabase keys and provider tokens remain backend-only.

This release does not publish the separately prepared Chrome Store popup hotfix. The public Store 1.0.0 popup still requires a Store update; its proposed internal revision 1.0.0.1 and the GitHub publication permission issue are tracked in `../../bugs/2026-09-10-extension/verification.md`.

## Live deployment

Code commit `29b10fa` pushed to main and fast-forwarded into production. Backend restarted successfully. Live database is schema 12, integrity check `ok`, and protected row counts match the pre-deploy snapshot; the one pre-existing orphan-connection foreign-key finding is unchanged.

`live-verification.json` records the September 10 production browser check: auth/dashboard/support/privacy/terms return 200, Apple and Google are available, email is secondary and expands, final theme token is present, and no browser script errors occurred. `live-auth-mobile.png` is the actual public sign-in page with no signed-in customer data. No interactive provider authentication was performed.

Design documentation was completed by the primary agent after the independent documenter produced no files within its bounded pass. No implementation changes followed the final visual verdict. Existing raster metadata omissions were not adopted as a design rule.
