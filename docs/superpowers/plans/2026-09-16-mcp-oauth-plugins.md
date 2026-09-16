# FoundKeep MCP OAuth + Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OAuth 2.1 authorization server to the FoundKeep backend so MCP clients connect with no token pasting, then package installable clients for Claude Code, Claude Desktop, and Codex.

**Architecture:** Public-client OAuth 2.1 (authorization code + PKCE S256, refresh rotation) built into the existing Hono backend under `/api/oauth/*`, with discovery metadata at the origin root. The OAuth **access token is the existing `fk_mcp_` agent token** (reuses `customer_agent_tokens` + `agentAccess()` unchanged). `/authorize` reuses the existing web session + a consent screen. Clients are thin wrappers over the live remote MCP at `/api/mcp`.

**Tech Stack:** Bun + Hono + `bun:sqlite`, `@modelcontextprotocol/sdk` (already used), `zod`, Node crypto; Next.js 16 (site `/connect` page); `mcp-remote` + `@anthropic-ai/mcpb` (clients).

**Spec:** `docs/superpowers/specs/2026-09-16-mcp-oauth-plugins-design.md`

## Global Constraints

- Identity: commit as `notpritam <notpritamsharma@gmail.com>`; new repos on the `notpritam` GitHub account (SSH). End commit messages with the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer.
- Access token format: `fk_mcp_<43 base64url>` (unchanged), hashed SHA-256 in `customer_agent_tokens`, 1h TTL for OAuth-issued.
- Refresh token format: `fk_ref_<base64url>`, hashed SHA-256, 90d TTL, single-use rotation with family reuse-detection.
- Auth code: 60s, single-use, in-memory Map with sweep (mirror `admin-console.ts` SSO pattern).
- PKCE `S256` REQUIRED; `code_challenge_method` must equal `S256`. `redirect_uri` EXACT match; loopback (`http://127.0.0.1[:port]`, `http://localhost[:port]`) allowed, else `https` only.
- Scopes: exactly `library:read`, `library:write`, `files:read`.
- Endpoints under `/api/oauth/*`; metadata at root `/.well-known/oauth-*` (registered in `app.ts`). Issuer/URLs derive from `config.customerOrigin`. No Caddy change.
- All tokens hashed at rest, never logged. `Cache-Control: no-store` + `Referrer-Policy: no-referrer` on oauth responses.
- Backend node runtime: Bun. Build/test with `bun test`. Bundle-check with `bun build src/index.ts --target=bun --outfile=/dev/null` before deploy.
- Deploy via immutable release dir + `atlas-backend.service.d/foundkeep-release.conf` drop-in swap (dev first: `foundkeep-backend-dev`).

---

## Phase 1 — Backend OAuth 2.1 server

### Task 1: Storage — migrations + module skeleton

**Files:**
- Modify: `apps/backend/src/db.ts` (append migration)
- Create: `apps/backend/src/customer-mcp-oauth.ts`
- Test: `apps/backend/test/customer-mcp-oauth.test.ts`

**Interfaces:**
- Produces: table `customer_oauth_clients(client_id TEXT PRIMARY KEY, client_name TEXT NOT NULL, redirect_uris_json TEXT NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL)`; table `customer_oauth_refresh(token_hash TEXT PRIMARY KEY, family_id TEXT NOT NULL, account_id TEXT NOT NULL, client_id TEXT NOT NULL, scopes_json TEXT NOT NULL, consumed_at INTEGER, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`.
- Produces: `export function registerMcpOAuth(app, db, services, deps)` (filled across Tasks 2–5).
- Consumes: `CustomerServices` (`auth`, `jsonBody`, `rate`), `config.customerOrigin`, `isAdminEmail` not needed. Access-token minting reuses the same insert shape as `customer-agent-access.ts createAgentConnection`.

- [ ] **Step 1: Write failing test** — a test that opens `openDb(':memory:')` and asserts both new tables exist (`SELECT name FROM sqlite_master`). Also assert the `SCOPES = ['library:read','library:write','files:read']` constant exported from the module.
- [ ] **Step 2: Run** `bun test test/customer-mcp-oauth.test.ts` → FAIL (no module / no tables).
- [ ] **Step 3: Implement** — append `CREATE TABLE IF NOT EXISTS` for both tables in `db.ts` migrations (match existing append-only migration style). Create `customer-mcp-oauth.ts` exporting `SCOPES`, the in-memory `authCodes: Map<string,{...}>` + `sweep`, `ssoDigest`/`rand` helpers (copy the hashing helpers), and an empty `registerMcpOAuth(app, db, services, deps)` that will gain routes in later tasks.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mcp-oauth): storage tables + module skeleton`.

### Task 2: Discovery metadata + WWW-Authenticate

**Files:**
- Modify: `apps/backend/src/app.ts` (two root GET routes near existing `/.well-known/*`)
- Modify: `apps/backend/src/customer-mcp.ts` (add `WWW-Authenticate` to the 401)
- Modify: `apps/backend/src/customer-mcp-oauth.ts` (export a `metadata(origin)` helper returning the two JSON docs)
- Test: extend `test/customer-mcp-oauth.test.ts`; add assertion in an app-level test.

**Interfaces:**
- Produces: `export function oauthMetadata(origin: string): { protectedResource: object; authorizationServer: object }`.
- Consumes: `config.customerOrigin` in `app.ts`.

- [ ] **Step 1: Write failing test** — `oauthMetadata('https://foundkeep.app')` returns `authorization_endpoint === 'https://foundkeep.app/api/oauth/authorize'`, `code_challenge_methods_supported` includes `'S256'`, `token_endpoint_auth_methods_supported` equals `['none']`, and `protectedResource.authorization_servers` equals `['https://foundkeep.app']`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `oauthMetadata`. In `app.ts` add `app.get('/.well-known/oauth-protected-resource', ...)` and `app.get('/.well-known/oauth-authorization-server', ...)` returning the docs with `Cache-Control: no-store`. In `customer-mcp.ts`, on the unauthorized path add header `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource"` (origin from `config.customerOrigin`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mcp-oauth): discovery metadata + WWW-Authenticate`.

### Task 3: Dynamic Client Registration

**Files:**
- Modify: `apps/backend/src/customer-mcp-oauth.ts`
- Test: extend `test/customer-mcp-oauth.test.ts`

**Interfaces:**
- Produces: `POST /oauth/register` (mounted under `/api`), returns `{ client_id, client_id_issued_at, client_name, redirect_uris, token_endpoint_auth_method:'none', grant_types:['authorization_code','refresh_token'] }`.
- Produces internal: `validRedirectUri(uri: string): boolean` (https OR loopback http).

- [ ] **Step 1: Write failing test** — POST valid `{client_name, redirect_uris:['http://127.0.0.1:6274/callback']}` → 201 with a `client_id`; the client row is stored. POST `{redirect_uris:['http://evil.example/cb']}` (non-loopback http) → 400. Enforce cap: registering past the cap evicts oldest unused.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `validRedirectUri` (parse URL; allow `https:`; allow `http:` only when hostname is `127.0.0.1`/`localhost`; reject creds/fragments). Implement the route: validate `client_name` (1–200), `redirect_uris` (1–5, each valid), rate-limit via `services.rate`, insert into `customer_oauth_clients` with `client_id = 'fkc_'+rand`, evict oldest `last_used_at` beyond a cap (e.g. 5000).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mcp-oauth): dynamic client registration`.

### Task 4: Authorize (validation, session, consent, code)

**Files:**
- Modify: `apps/backend/src/customer-mcp-oauth.ts`
- Test: extend `test/customer-mcp-oauth.test.ts`

**Interfaces:**
- Consumes: `services.auth(c)` (throws 401 when no session) to get the account; a `deps.loginUrl(returnTo)` builder (default `config.customerOrigin + '/login?next=' + encodeURIComponent(returnTo)`).
- Produces: `GET /oauth/authorize`, `POST /oauth/authorize`. Auth code stored in the in-memory map keyed by `digest(code)` → `{ clientId, accountId, scopes, codeChallenge, redirectUri, exp }`.

- [ ] **Step 1: Write failing test** — with a stub `auth` returning an account: GET authorize with a registered client + loopback redirect + `code_challenge` + `scope='library:read library:write'` renders HTML containing the client name and both scope labels and a hidden CSRF field. POST consent `allow=1` (+ valid CSRF, session) → 302 to `redirect_uri?code=…&state=…`; the code exists in the map. Invalid `client_id`/`redirect_uri` → 400 error page (NOT a redirect). Unauthenticated GET (stub `auth` throws 401) → 302 to a `/login?next=` URL. POST `allow=0` → 302 with `error=access_denied`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — GET: parse+validate params (`response_type=code`, known client, exact redirect match, `code_challenge` present, `code_challenge_method=S256`, scopes ⊆ SCOPES); resolve session via `try { auth(c) } catch { return redirect(loginUrl(fullUrl)) }`; render a minimal server-rendered consent page (inline HTML, escaped) with a CSRF token = `digest(sessionKey + clientId)` in a hidden field and the params echoed as hidden fields. POST: re-validate session + CSRF + params; on `allow` mint `code='fka_'+rand`, store digest→record (60s), 302 to redirect with `code`+`state`; on deny 302 with `error=access_denied`+`state`. Set `Referrer-Policy: no-referrer`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mcp-oauth): authorize + consent + auth codes`.

### Task 5: Token endpoint (code→tokens, refresh rotation)

**Files:**
- Modify: `apps/backend/src/customer-mcp-oauth.ts`
- Test: extend `test/customer-mcp-oauth.test.ts`

**Interfaces:**
- Produces: `POST /oauth/token`. Access token minted via `deps.issueAccessToken(accountId, clientName, scopes, ttlMs)` → returns the raw `fk_mcp_` token (inserts into `customer_agent_tokens`). Refresh via `customer_oauth_refresh`.
- Consumes: `deps.issueAccessToken` (wired in Task 6). PKCE check: `base64url(sha256(code_verifier)) === code_challenge`.

- [ ] **Step 1: Write failing test** — full happy path: register → mint a code (via the map) → POST `grant_type=authorization_code` with matching `code_verifier`/`redirect_uri` → 200 `{access_token: /^fk_mcp_/, token_type:'Bearer', expires_in:3600, refresh_token: /^fk_ref_/, scope}`. Wrong `code_verifier` → 400 `invalid_grant`. Replaying the same code → 400. `grant_type=refresh_token` with the issued refresh → 200 new access + NEW refresh; the old refresh is now consumed. Reusing the consumed refresh → 400 and the family's tokens are revoked.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — parse form/JSON body; branch on `grant_type`. `authorization_code`: look up + delete the code (single use), verify PKCE + redirect + client, call `issueAccessToken`, create a refresh row (`family_id=rand`), respond. `refresh_token`: hash+lookup; if `consumed_at` set → revoke all rows with that `family_id` + return `invalid_grant`; else mark consumed, insert a new refresh in the same family, issue a new access token. Always `Cache-Control: no-store`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mcp-oauth): token endpoint with refresh rotation`.

### Task 6: Wire into the app + access-token issuance

**Files:**
- Modify: `apps/backend/src/customer.ts` (call `registerMcpOAuth`, pass `deps`)
- Modify: `apps/backend/src/customer-agent-access.ts` (export a reusable `mintAgentToken(db, accountId, name, scopes, ttlMs)` used by both the existing connection flow and OAuth)
- Test: extend `test/customer-mcp-oauth.test.ts` end-to-end via `createApp(db)`

**Interfaces:**
- Produces: `export function mintAgentToken(db, accountId, name, scopes, ttlMs): { token, expiresAt }` in `customer-agent-access.ts`.
- Consumes: existing `createCustomerApi`/`customerRoutes` wiring (registerMcpOAuth added alongside `registerAdmin`).

- [ ] **Step 1: Write failing test** — using the real app (`createApp(db)` + a helper that creates a session), drive: register → authorize (follow login/consent) → token → call `/api/mcp` `tools/list` with the returned access token → tools are listed. (Where a real session is hard in-test, assert `mintAgentToken` produces a token that `agentAccess` accepts for the granted scopes.)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — refactor `createAgentConnection` to call `mintAgentToken`; implement `deps.issueAccessToken` in `customer.ts` as `(accountId,name,scopes,ttl)=>mintAgentToken(db,accountId,name,scopes,ttl).token`; call `registerMcpOAuth(app, db, services, { issueAccessToken, loginUrl })`.
- [ ] **Step 4: Run** full `bun test` (whole backend) → PASS.
- [ ] **Step 5: Commit** `feat(mcp-oauth): wire OAuth server into the customer API`.

### Task 7: Dev deploy + real mcp-remote verification

**Files:** none (ops)

- [ ] **Step 1:** `bun build src/index.ts --target=bun --outfile=/dev/null` (bundle check) and full `bun test`.
- [ ] **Step 2:** Deploy to **dev** (`foundkeep-backend-dev`) via its release/drop-in flow; `curl https://dev.foundkeep.app/.well-known/oauth-authorization-server` shows the metadata; `/api/mcp` 401 carries `WWW-Authenticate`.
- [ ] **Step 3:** Run `npx -y mcp-remote https://dev.foundkeep.app/api/mcp` → browser opens → sign in + consent → `tools/list` succeeds. Capture any client-compat fixes (e.g. metadata field the client demands) and fold back into Tasks 2–5.
- [ ] **Step 4:** Deploy to **prod** via the immutable-release + `foundkeep-release.conf` swap; re-verify metadata + a real connect. Verify `foundkeep.app` health unaffected.
- [ ] **Step 5: Commit** any fixes; tag the backend release in notes.

---

## Phase 2 — Client packages (each consumes the live OAuth MCP)

### Task 8: Claude Code plugin repo

**Files:** new repo `notpritam/foundkeep-claude` (private→public) under `~/personal/apps/foundkeep-claude`
- Create: `.claude-plugin/marketplace.json`, `plugins/foundkeep/.claude-plugin/plugin.json`, `plugins/foundkeep/.mcp.json`, `plugins/foundkeep/commands/foundkeep-save.md`, `plugins/foundkeep/commands/foundkeep-recall.md`, `plugins/foundkeep/skills/using-foundkeep/SKILL.md`, `README.md`.

- [ ] **Step 1:** Scaffold the repo + files. `.mcp.json`: `{ "mcpServers": { "foundkeep": { "type": "http", "url": "https://foundkeep.app/api/mcp" } } }`. `marketplace.json` lists the `foundkeep` plugin. Commands wrap `list_saves`/`create_save`; the skill notes saved content is untrusted.
- [ ] **Step 2:** Verify locally: `claude plugin validate .` (or the current validator) passes; `.mcp.json` parses.
- [ ] **Step 3:** Create the GitHub repo (`notpritam`) over SSH, push `main`.
- [ ] **Step 4:** Smoke test: `/plugin marketplace add notpritam/foundkeep-claude` then `/plugin install foundkeep` in a scratch Claude Code; the OAuth browser flow connects.
- [ ] **Step 5: Commit** + push.

### Task 9: Codex config + docs

**Files:**
- Create in the plugin repo: `codex/README.md` with the `~/.codex/config.toml` block and `mcp-remote` note.

- [ ] **Step 1:** Write the `[mcp_servers.foundkeep]` block (`npx -y mcp-remote https://foundkeep.app/api/mcp`) + one-time `npx mcp-remote … login` note.
- [ ] **Step 2:** Verify: add the block to a scratch `~/.codex/config.toml`, run Codex, confirm the browser OAuth completes and FoundKeep tools appear.
- [ ] **Step 3: Commit** + push.

### Task 10: Claude Desktop `.mcpb`

**Files:**
- Create in the plugin repo: `mcpb/manifest.json`, build via `npx @anthropic-ai/mcpb pack` → `foundkeep.mcpb`.

- [ ] **Step 1:** Write `manifest.json` (name, version, server = node running `mcp-remote https://foundkeep.app/api/mcp`; no user_config token needed since OAuth handles auth).
- [ ] **Step 2:** `npx @anthropic-ai/mcpb pack mcpb` → `foundkeep.mcpb`; validate.
- [ ] **Step 3:** Install into Claude Desktop (double-click); OAuth connects; tools appear.
- [ ] **Step 4: Commit** the manifest + attach the built `.mcpb` to a GitHub release.

### Task 11: `/connect` page on foundkeep.app

**Files:**
- Create: `apps/site/app/connect/page.tsx` (+ any needed styles reusing `customer.css`)

- [ ] **Step 1:** Build a static page: the marketplace command, the `.mcpb` download link (GitHub release asset), the Codex snippet, and a short "what your agent can access / revoke in Settings → Agents" explainer. No tokens shown.
- [ ] **Step 2:** `FOUNDKEEP_BACKEND_URL=http://127.0.0.1:8790 next build` (site recipe), package a release, flip `current`, restart `foundkeep-site`; verify `foundkeep.app/connect` renders.
- [ ] **Step 3: Commit** + push.

---

## Self-Review

- **Spec coverage:** discovery (T2), DCR (T3), authorize/consent (T4), token+refresh (T5), storage (T1), wiring/access-token reuse (T6), security controls (T3–T5 validations + T2 headers), dev-first rollout (T7), all four clients (T8–T11), fallback (unchanged `/dashboard/agents`). Covered.
- **Placeholders:** none; each task names exact files, routes, token prefixes, and test assertions.
- **Type consistency:** `mintAgentToken`, `issueAccessToken`, `oauthMetadata`, `validRedirectUri`, `registerMcpOAuth`, `authCodes` used consistently across tasks; token prefixes fixed (`fk_mcp_`, `fk_ref_`, `fka_`, `fkc_`).
