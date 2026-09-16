# FoundKeep onboarding drip

Three educational emails sent over a new user's first week. Authored
**content-first** — the templates are final and reviewable; the actual sending
(provider + trigger + backfill) is wired later. See `SEND_PLAN.md`.

| Step | File | When | Point |
|---|---|---|---|
| Day 0 | `01-welcome.html` / `.txt` | on signup | what FoundKeep is for + save-from-anywhere + top use cases |
| Day 2 | `02-organize.html` / `.txt` | +2 days | AI filing, search, personal tags, collections |
| Day 7 | `03-agents.html` / `.txt` | +7 days | connect Claude/Codex (MCP) — your library as your AI's memory |

Each email ships as **HTML + a plaintext alternative** (send both parts).

## Template variables

Replace `{{...}}` before sending:

| Variable | Example |
|---|---|
| `{{name}}` | recipient's first name (fall back to "there") |
| `{{dashboardUrl}}` | `https://foundkeep.app/dashboard` |
| `{{helpUrl}}` | `https://help.foundkeep.app/` (trailing slash; article links append e.g. `getting-started/`) |
| `{{connectUrl}}` | `https://foundkeep.app/connect` |
| `{{unsubscribeUrl}}` | per-recipient unsubscribe link |

## Design notes

Email-safe: table layout, inline styles, ~600px, light body with a dark
`FoundKeep` wordmark, emerald `#0d7a50` accent/CTA (darker than the app's
`#4cc38a` for contrast on white), system fonts, hidden preheader, mobile media
query, alt-friendly (no critical images).

## Preview

```sh
/usr/bin/node render.mjs   # writes ./preview/*.html with sample values
# open preview/index.html
```
