# Onboarding drip — send plan (to wire later)

The templates are done. This is how sending will hook up once a provider is
chosen. **Nothing here is built yet** — no provider dependency is in the repo.

## The seam

Add one adapter the rest of the code calls:

```ts
// step: 0 | 2 | 7  → picks 0N-*.html + .txt, fills vars, sends html+text.
export async function sendOnboarding(
  step: 0 | 2 | 7,
  to: { email: string; name?: string; unsubscribeUrl: string },
): Promise<void>;
```

Only `sendOnboarding` knows the provider. Swapping Resend ↔ SMTP is a one-file
change. It loads the template from `emails/onboarding/`, substitutes the
variables (see README), and sends both the HTML and plaintext parts.

## Trigger (new signups)

New accounts are created in the backend OAuth exchange
(`apps/backend/src/customer-oauth.ts`, the `/auth/oauth/exchange` web branch that
calls `d.session(c, owner.id)` for a brand-new `owner`). On new-owner creation:

- send **Day 0** immediately (best-effort; never block or fail sign-in),
- enqueue **Day 2** and **Day 7** with delays.

Simplest durable scheduler that fits this codebase: a small
`customer_onboarding_emails(account_id, step, send_at, sent_at)` table, enqueued
at signup, drained by a timer in `index.ts` (same pattern as the preservation /
enrichment ticks). No external queue needed.

## Backfill (existing friends-beta users)

One-off: for every existing account with a verified email, insert a Day-0 send
(and optionally Day-2 / Day-7 staggered) into the queue, so current friends get
educated once. Guard with a `backfilled` marker so it runs exactly once.

## Consent / compliance

- Honor an email preference: add an `email_opt_out` flag on the account and a
  real `{{unsubscribeUrl}}` (a one-click token endpoint) before any bulk send.
- Skip users who opted out; never send to unverified emails.
- Transactional welcome is generally fine; the Day-2/Day-7 nurture should respect
  opt-out.

## Provider options (decide later)

- **Resend** — API key + verify `foundkeep.app` (SPF/DKIM DNS). Best deliverability,
  simplest API, supports html+text in one call.
- **SMTP** — reuse an existing mailbox; fine for low volume, weaker for bulk.

Set the provider secret in `~/.config/foundkeep/*.env` (mode 600), never in the repo.
