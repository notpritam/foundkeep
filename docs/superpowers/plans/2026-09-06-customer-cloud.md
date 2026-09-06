# Atlas customer product — implementation contract

Approved direction: preserve Atlas Studio + Operator visual design, make capture the focus. Customer journey: create account, install/connect extension, save, open a private synced dashboard. User authorized implementation and launch. Existing local captures remain local until explicit import. Legacy relay and data must remain isolated from customer data.

## Shared HTTP contract

Production origin `https://atlas.notpritam.in`. All customer routes under `/api`. JSON errors `{error: machine_code, message: human_text}` with appropriate HTTP status. Browser session cookie HttpOnly, Secure in production, SameSite=Lax; reject cross-origin mutations. Extension uses bearer connection credential, never website session. Customer objects never expose password/token hashes.

`Account = {id,email,name,createdAt}`. `Connection = {id,name,createdAt,lastSeenAt}`.

- POST `/api/auth/register` `{email,password,name}` -> `{account,recoveryCode}` and cookie. Password minimum 12 characters, max 128. Recovery code displayed once, stored hashed.
- POST `/api/auth/login` `{email,password}` -> `{account}` and cookie.
- POST `/api/auth/recover` `{email,recoveryCode,password}` -> `{account,recoveryCode}` and cookie; rotates code and revokes old sessions/connections.
- POST `/api/auth/logout` -> `{ok:true}` clears/revokes cookie.
- GET `/api/me` -> `{account,connections,usage:{captures,bytes,maxCaptures,maxBytes}}`; accepts cookie or extension credential.
- POST `/api/auth/password` `{currentPassword,password}` -> `{ok:true,recoveryCode}`; revoke other sessions/connections, rotate recovery.
- DELETE `/api/account` `{password}` -> `{ok:true}`; deletes account-owned data and credentials.
- GET `/api/account/export` -> JSON export of account captures with image data URLs (bounded by account quota; may implement streamed export).
- POST `/api/pairing` `{}` cookie only -> `{code,expiresAt}` (5 minute, one-use, 32 random bytes).
- POST `/api/pairing/claim` `{code,name}` -> `{account,connection,token}`. Token random, stored hashed, revocable, 90 day expiry; token never in URL.
- DELETE `/api/connections/:id` -> `{ok:true}`, cookie only, owner scoped.
- GET `/api/captures?q=&type=&limit=60&cursor=` -> `{captures,nextCursor,total}`. Search owner scoped; descending capturedAt/id; bound limit 100. Type optional.
- GET `/api/captures/:id` -> `{capture}`.
- POST `/api/captures` -> `{capture,duplicate:boolean}`. Accept JSON `{clientId,type,sourceUrl,sourceTitle,selectionText,noteText,articleText,dataUrl,width,height,capturedAt}`. Preserve idempotency per account/clientId; ignore submitted enrichment/owner fields. Allowed types `screenshot,selection,bookmark,image,note,tweet`.
- DELETE `/api/captures/:id` -> `{ok:true}` owner scoped.
- GET `/api/captures/:id/blob` -> validated PNG/JPEG/WebP image only, owner authentication, nosniff, private/no-store.

Capture DTO `{id,clientId,type,status,sourceUrl,sourceTitle,selectionText,noteText,articleText,summary,ocrText,category,tags,blobUrl,width,height,capturedAt,createdAt,updatedAt,enrichError}`. Strings nullable, tags array. status pending/processing/done/failed. blobUrl null or same-origin `/api/captures/:id/blob`. Do not return inline blob in lists.

Limits: max 8 MiB decoded image, 100k article characters, 50k note/selection, 1000 captures / 200 MiB per account. Bound request bodies and signup/login attempts; prevent cross-tenant access and legacy API access. SQLite migrations append-only. Customer tables use customer_ prefix. No customer capture enters legacy tool-enabled enrichment worker. Safe customer worker can use local OCR and extractive text summaries/tags, never execute instructions in captured content or fetch arbitrary source URLs.

## Extension contract

Fixed signed ID `mjfcgmboaijfcaanepdipbgmipnccnpn`. Keep public manifest key. Add externally_connectable only production web origin. Exact sender origin validation. Website sends via chrome.runtime.sendMessage:

- `{kind:'atlas-ping'}` -> `{ok:true,version,account: Account|null}` (never token).
- `{kind:'atlas-connect',code}` -> `{ok:true,account}` or `{ok:false,error}`. Claims against hardcoded production origin; no caller-selected backend. Existing account requires confirmation on website before switching; pending old-account records stay bound to old account.

Store customer connection state in chrome.storage.local. Add accountId/clientId/upload status to local records. Only new captures made while connected automatically upload; old local records require explicit import confirmation. Network failures retain durable local queue; alarms/save/startup retry; 401 shows reconnect required; bounded retry concurrency; syncing cannot cross an account switch. Local saves succeed even offline. Popup offers account/setup, sync status, hosted dashboard; local library remains available. Website and extension state must show actual connection/sync errors. No developer token setup in primary customer flow.

## Customer web UX

New static `/auth.html`, `/dashboard.html` (server redirects /signup,/login,/dashboard to corresponding page). Use existing fonts/colors; polished responsive real UI, no fake account/data. Auth handles signup/login/recovery, one-time recovery code download and explicit saved acknowledgement before navigating. Dashboard handles loading/session expiry/empty/error/search/filter/pagination/detail/image/new note/delete/account settings/device revoke/logout/password/delete/export.

Onboarding: install button uses actual configured Chrome Web Store URL when available; otherwise truthful direct install instructions and ZIP with setup friction called out. Detect extension, one-click connect using session-created code, successful first capture state. Feature-detect chrome.runtime. Website settings displays connected browsers and limits. Never put auth token in localStorage, URL, DOM, or logs.

## Work ownership and execution

1. Backend implementer: customer schema/auth/API/tests; owns db.ts appended migration, new customer.ts and customer.test.ts, app.ts route mount/static redirects. Exposes customer data schema/helper contract to root for worker.
2. Web implementer: auth/dashboard HTML/CSS/JS, landing CTA/copy and privacy truthfulness. Owns apps/web text/code only (not signed archives), customer browser tests as useful.
3. Extension implementer: apps/extension plus tests/extension*.mjs updates; customer pairing/durable queue/UI. Preserve local data and existing capture behavior. Do not bump version yet.
4. Root: safe enrichment worker, integration fixtures/e2e, build/distribution/docs/CI, migration backup/deploy and verification. Review each contribution and obtain independent final security review. No overlapping edits without coordination.

## Validation and release

Prove signup/login/recovery/logout; tenant isolation for list/detail/blob/delete/export/devices; CSRF and token revocation; expired/reused pairing; limits; idempotent upload. Real Chromium MV3 signup → connect → capture → dashboard; offline retry and owner-switch tests. Existing tests stay passing. Before launch back up production SQLite using backup API, deploy append-only migrations, health-check live, verify public account flow with disposable QA account then delete it. Signed v1.4.0 release with unchanged ID. Build CWS upload and refreshed listing, but store publishing requires publisher account/access and actual store review; do not claim one-click store installation before available.
