# FoundKeep help site + onboarding drip

Status: approved design (2026-09-16)
Owner: notpritam

## Summary

Two content-led sub-projects to turn installs into active users:

1. **Help site** — a dedicated **Astro Starlight** site in its own repo
   `notpritam/foundkeep-help`, built to static HTML and served at
   **help.foundkeep.app** via a Caddy `file_server` vhost (no systemd service).
   Use-case guides + tips, each article linkable, with built-in search & nav.
2. **Onboarding drip** — three designed, email-safe HTML templates (Day 0 / 2 / 7)
   authored **content-first** (no email provider wired yet), with a documented
   send-plan and a `sendOnboarding()` seam so hooking up a provider later is small.

Decisions locked: content-first (sender TBD later); 3-email drip; recipients =
new signups + a one-time backfill of existing friends-beta users (wired later);
help site is its own codebase on its own subdomain; framework = Astro Starlight.

## Product facts the content MUST be accurate to

FoundKeep = a private place to keep the things worth keeping and find them again.
- **Save types:** note, bookmark, tweet, selection (highlight), screenshot, image,
  video, audio, document, file.
- **Capture surfaces:** browser extension (Chrome/Edge/Brave), iOS app (Share
  sheet + in-app notes), Android (signed APK beta), web dashboard (add/paste a
  URL, drop files, write notes). Save from any app's Share menu.
- **AI processing** (available on all plans during early access; consent-gated):
  summary, tags, category, OCR on images, readable text extraction — makes
  everything searchable. Can be re-run per item.
- **Organize:** folders + tags (AI-generated tags *and* your own personal tags),
  full-text search, filter by type/status/category, link related saves, a graph
  of connections.
- **Collections:** group saves, share them, members + followers, public
  collections you can discover/follow.
- **Preservation:** saved tweets/threads get the full text + media preserved
  server-side (not just a link); articles get readable text; files keep originals.
- **Agents / MCP:** connect Claude & Codex at foundkeep.app/connect — your library
  becomes a tool your AI can read, search, and organize (no token; browser sign-in).
- **Plans:** Free + Pro ($5/mo). Friends-beta accounts have complimentary Pro.
- **Privacy:** private by default; you choose what to share.

Copy rules: brand is **FoundKeep** (capital F, capital K). Warm, plain, concise;
no hype. Dark theme, emerald accent `#4cc38a`. Never promise features not listed
above (e.g. no "report" button exists yet; owner moderation only).

## Sub-project 1 — Help site (Astro Starlight)

**Repo:** `notpritam/foundkeep-help` at `~/personal/apps/foundkeep-help`.
**Stack:** Astro + `@astrojs/starlight`, TypeScript, pnpm/npm/bun install; **static
output** (`astro build` → `dist/`). Node build via `/usr/bin/node`; installs via
`bun`/`bunx` (nvm node is broken on omni).

**Branding:** dark theme default; Starlight custom CSS to FoundKeep palette
(near-black `#0f1011`, emerald `#4cc38a` links/accents); FoundKeep wordmark/logo
(reuse `studio-mark.svg` from the main site), favicon, social card; site title
"FoundKeep Help"; footer links back to foundkeep.app, /connect, privacy, support.

**Nav / sidebar groups:**
- *Start here* — Getting started; Save from anywhere; Let AI do the filing.
- *Organize* — Folders & tags; Search & filters; Link saves & the graph;
  Collections & sharing.
- *Use cases* — Research library; A reading list you'll finish; Inspiration board;
  A second brain your agent can use; Keep tweets & threads forever.
- *Power* — Connect Claude & Codex; Tips & shortcuts; Plans & storage; Privacy.

**Article requirements:** each is an `.md`/`.mdx` file under `src/content/docs/`
with frontmatter (title, description). Real prose (not stubs), accurate to the
facts above, cross-linked, with concrete step lists where relevant. Getting
started should orient a brand-new user in <2 min and link out to the deeper guides.
"Connect Claude & Codex" mirrors foundkeep.app/connect (marketplace command,
`.mcpb`, Codex config) and links to it as the source of truth.

**Hosting:** `deploy/` in the repo with a `deploy.sh`: `bun install` →
`astro build` → rsync `dist/` to `/var/www/foundkeep-help/`. Caddy vhost:
```
help.foundkeep.app {
    tls internal
    encode zstd gzip
    root * /var/www/foundkeep-help
    try_files {path} {path}/ {path}.html /404.html
    file_server
}
```
Behind Cloudflare (user adds `help` CNAME → foundkeep.app, proxied; SSL Full).
Caddy edit follows the safety ritual (backup, verify every existing vhost before
& after, `caddy validate`, reload).

## Sub-project 2 — Onboarding drip (content + design only)

**Location:** in the help repo (or main repo) `emails/` — three standalone HTML
files + a shared inline-styled layout. Email-safe: table layout, inline styles,
~600px, dark FoundKeep logo on a light body (deliverability), system fonts, alt
text, a plaintext alternative per email.

**Templates & intent:**
- **Day 0 — Welcome:** what FoundKeep is great for; save-from-anywhere; 3 use
  cases with links to help articles; CTA → dashboard + "install the extension".
- **Day 2 — Let it organize itself:** AI summaries/tags/search + collections; the
  one habit (save now, find later); link to Organize guides.
- **Day 7 — Your agent's memory:** connect Claude & Codex (MCP); link to
  /connect + the "second brain" use case.

**Variables:** `{{name}}`, `{{dashboardUrl}}`, `{{helpUrl}}`, `{{connectUrl}}`,
`{{unsubscribeUrl}}` — documented in a README.

**Preview:** a tiny static `emails/index.html` (or a `preview` npm script) that
renders all three with sample values, so they're reviewable in a browser; can be
served locally or dropped under `/var/www/foundkeep-help/emails-preview/` (noindex).

**Send-plan (documented, NOT built now):** `emails/SEND_PLAN.md` — trigger point
= account creation in the backend OAuth exchange (`customer-oauth.ts`, web branch
where `session()` is issued for a new owner) enqueues Day-0 immediately and Day-2 /
Day-7 on a delay; a backfill script sends Day-0 once to existing friends-beta
accounts. Define the seam `sendOnboarding(step: 0|2|7, to, vars)` (provider
adapter TBD: Resend or SMTP). No provider dependency added yet. Respect
consent/unsubscribe when wired.

## Testing / done

- `astro build` succeeds; `astro check` (or tsc) clean; no broken internal links
  (Starlight link check or a grep pass).
- Static site serves locally (`bunx astro preview` or file_server) — index, an
  article, search, 404 all work.
- Deployed: `help.foundkeep.app` returns the help index (once DNS is added);
  origin-served check via `--resolve` works before DNS.
- Email templates render in a browser preview; links point at real help URLs;
  plaintext alternatives present.
- No regression to other Caddy vhosts (all present before & after).

## Rollout

1. Build + push `notpritam/foundkeep-help`; static build to `/var/www/foundkeep-help`.
2. Add Caddy vhost (safety ritual); verify origin serving; user adds `help` CNAME.
3. Land the email templates + preview + SEND_PLAN.
4. (Later, separate task) pick a provider, implement the `sendOnboarding` adapter,
   wire the signup trigger + backfill.
