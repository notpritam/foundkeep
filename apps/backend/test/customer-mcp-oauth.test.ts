import { afterEach, beforeEach, expect, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { openDb } from '../src/db.ts';
import { createApp } from '../src/app.ts';
import { config } from '../src/config.ts';
import { SCOPES, oauthMetadata, validRedirectUri } from '../src/customer-mcp-oauth.ts';

let db: ReturnType<typeof openDb>, app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db);
});
afterEach(() => {
  db.close();
});

const ORIGIN = config.customerOrigin;
const b64url = (b: Buffer) => b.toString('base64url');
const pkce = () => {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
};

async function api(path: string, init: RequestInit = {}) {
  return app.request(ORIGIN + '/api' + path, init);
}
async function root(path: string, init: RequestInit = {}) {
  return app.request(ORIGIN + path, init);
}
// A real website session, established exactly like the customer flow does it.
async function register() {
  const r = await api('/auth/register', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'MCP User', email: crypto.randomUUID() + '@example.test', password: 'A sufficiently long test password' }),
  });
  expect(r.status).toBe(201);
  const account = ((await r.json()) as any).account;
  return { account, cookie: r.headers.get('set-cookie')!.split(';')[0]! };
}
async function registerClient(redirectUris = ['http://127.0.0.1:6274/callback'], clientName = 'Test MCP Client') {
  const r = await api('/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: clientName, redirect_uris: redirectUris, token_endpoint_auth_method: 'none' }),
  });
  return { status: r.status, body: (await r.json()) as any };
}

// Drive GET /oauth/authorize with a session and return the parsed consent form.
async function consent(cookie: string, clientId: string, redirectUri: string, challenge: string, scope = 'library:read library:write', state = 'st-123') {
  const url = ORIGIN + '/api/oauth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope, state, code_challenge: challenge, code_challenge_method: 'S256' });
  const r = await app.request(url, { headers: { Cookie: cookie } });
  const html = await r.text();
  const field = (name: string) => (html.match(new RegExp(`name="${name}" value="([^"]*)"`)) || [])[1];
  return { status: r.status, location: r.headers.get('location'), html, csrf: field('csrf') };
}
// Submit the consent form (form-encoded, same-origin) and return the redirect.
async function submitConsent(cookie: string, fields: Record<string, string>) {
  const r = await app.request(ORIGIN + '/api/oauth/authorize', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  return { status: r.status, location: r.headers.get('location') || '' };
}
// Full authorize → single-use code, returned from the redirect Location.
async function mintCode(cookie: string, clientId: string, redirectUri: string, challenge: string, scope = 'library:read library:write') {
  const g = await consent(cookie, clientId, redirectUri, challenge, scope);
  const posted = await submitConsent(cookie, { csrf: g.csrf!, client_id: clientId, redirect_uri: redirectUri, scope, state: 'st-123', code_challenge: challenge, code_challenge_method: 'S256', allow: '1' });
  return new URL(posted.location).searchParams.get('code')!;
}

async function token(fields: Record<string, string>) {
  const r = await api('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
  return { status: r.status, body: (await r.json()) as any, headers: r.headers };
}

// --- Task 1: storage + module constant ---
test('migration creates both OAuth tables and SCOPES matches the supported set', () => {
  const names = (db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(r => r.name);
  expect(names).toContain('customer_oauth_clients');
  expect(names).toContain('customer_oauth_refresh');
  expect(SCOPES).toEqual(['library:read', 'library:write', 'files:read']);
});

// --- Task 2: discovery metadata + WWW-Authenticate ---
test('oauthMetadata derives every URL from the issuer origin', () => {
  const m = oauthMetadata('https://foundkeep.app');
  expect(m.authorizationServer.issuer).toBe('https://foundkeep.app');
  expect(m.authorizationServer.authorization_endpoint).toBe('https://foundkeep.app/api/oauth/authorize');
  expect(m.authorizationServer.token_endpoint).toBe('https://foundkeep.app/api/oauth/token');
  expect(m.authorizationServer.registration_endpoint).toBe('https://foundkeep.app/api/oauth/register');
  expect(m.authorizationServer.code_challenge_methods_supported).toContain('S256');
  expect(m.authorizationServer.token_endpoint_auth_methods_supported).toEqual(['none']);
  expect(m.authorizationServer.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
  expect(m.protectedResource.resource).toBe('https://foundkeep.app/api/mcp');
  expect(m.protectedResource.authorization_servers).toEqual(['https://foundkeep.app']);
  expect(m.protectedResource.scopes_supported).toEqual(['library:read', 'library:write', 'files:read']);
});

test('metadata endpoints serve the documents at the root with no-store', async () => {
  const as = await root('/.well-known/oauth-authorization-server');
  expect(as.status).toBe(200);
  expect(as.headers.get('cache-control')).toContain('no-store');
  expect((await as.json()).authorization_endpoint).toBe(ORIGIN + '/api/oauth/authorize');
  const pr = await root('/.well-known/oauth-protected-resource');
  expect(pr.status).toBe(200);
  expect((await pr.json()).resource).toBe(ORIGIN + '/api/mcp');
});

test('/api/mcp 401 carries the WWW-Authenticate discovery header', async () => {
  const r = await api('/mcp', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{}' });
  expect(r.status).toBe(401);
  const header = r.headers.get('www-authenticate') || '';
  expect(header).toContain('Bearer');
  expect(header).toContain(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`);
});

// --- Task 3: dynamic client registration ---
test('validRedirectUri accepts https + loopback http, rejects the rest', () => {
  expect(validRedirectUri('https://example.com/cb')).toBe(true);
  expect(validRedirectUri('http://127.0.0.1:6274/callback')).toBe(true);
  expect(validRedirectUri('http://localhost/cb')).toBe(true);
  expect(validRedirectUri('http://[::1]:8080/cb')).toBe(true);
  expect(validRedirectUri('http://evil.example/cb')).toBe(false);
  expect(validRedirectUri('https://user:pass@example.com/cb')).toBe(false);
  expect(validRedirectUri('https://example.com/cb#frag')).toBe(false);
  expect(validRedirectUri('javascript:alert(1)')).toBe(false);
  expect(validRedirectUri('not a url')).toBe(false);
});

test('DCR stores a loopback client and rejects a non-loopback http redirect', async () => {
  const ok = await registerClient(['http://127.0.0.1:6274/callback']);
  expect(ok.status).toBe(201);
  expect(ok.body.client_id).toMatch(/^fkc_/);
  expect(ok.body.token_endpoint_auth_method).toBe('none');
  expect(ok.body.redirect_uris).toEqual(['http://127.0.0.1:6274/callback']);
  const row = db.query('SELECT client_name FROM customer_oauth_clients WHERE client_id=?').get(ok.body.client_id) as any;
  expect(row.client_name).toBe('Test MCP Client');

  const bad = await registerClient(['http://evil.example/cb']);
  expect(bad.status).toBe(400);
  expect(bad.body.error).toBe('invalid_redirect_uri');

  const noName = await api('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect_uris: ['https://ok.example/cb'] }) });
  expect(noName.status).toBe(400);
});

// --- Task 4: authorize validation, session, consent, code ---
test('authorize without a session redirects to the site login with next=', async () => {
  const client = (await registerClient()).body;
  const { challenge } = pkce();
  const url = ORIGIN + '/api/oauth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: 'http://127.0.0.1:6274/callback', scope: 'library:read', state: 's', code_challenge: challenge, code_challenge_method: 'S256' });
  const r = await app.request(url, { redirect: 'manual' });
  expect(r.status).toBe(302);
  const loc = r.headers.get('location') || '';
  expect(loc.startsWith(ORIGIN + '/login?next=')).toBe(true);
  expect(decodeURIComponent(loc.split('next=')[1]!)).toContain('/api/oauth/authorize');
});

test('authorize renders consent with the client name, scope labels and a CSRF field', async () => {
  const { cookie } = await register();
  const client = (await registerClient(['http://127.0.0.1:6274/callback'], 'Claude Code')).body;
  const { challenge } = pkce();
  const g = await consent(cookie, client.client_id, 'http://127.0.0.1:6274/callback', challenge, 'library:read library:write');
  expect(g.status).toBe(200);
  expect(g.html).toContain('Claude Code');
  expect(g.html).toContain('See your saved items, folders, and tags');
  expect(g.html).toContain('Create and organize saves, folders, and tags');
  expect(g.csrf).toBeTruthy();
});

test('authorize rejects an unknown client with an error page, not a redirect', async () => {
  const { cookie } = await register();
  const { challenge } = pkce();
  const r = await app.request(ORIGIN + '/api/oauth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: 'fkc_nope', redirect_uri: 'http://127.0.0.1:6274/callback', code_challenge: challenge, code_challenge_method: 'S256', scope: 'library:read' }), { headers: { Cookie: cookie } });
  expect(r.status).toBe(400);
  expect(r.headers.get('location')).toBeNull();
  expect(await r.text()).toContain("can");
});

test('consent Allow returns a code; Deny returns access_denied; both preserve state', async () => {
  const { cookie } = await register();
  const client = (await registerClient()).body;
  const { challenge } = pkce();
  const uri = 'http://127.0.0.1:6274/callback';

  const g = await consent(cookie, client.client_id, uri, challenge);
  const allowed = await submitConsent(cookie, { csrf: g.csrf!, client_id: client.client_id, redirect_uri: uri, scope: 'library:read library:write', state: 'st-123', code_challenge: challenge, code_challenge_method: 'S256', allow: '1' });
  expect(allowed.status).toBe(302);
  const allowUrl = new URL(allowed.location);
  expect(allowUrl.searchParams.get('code')).toMatch(/^fka_/);
  expect(allowUrl.searchParams.get('state')).toBe('st-123');

  const g2 = await consent(cookie, client.client_id, uri, challenge);
  const denied = await submitConsent(cookie, { csrf: g2.csrf!, client_id: client.client_id, redirect_uri: uri, scope: 'library:read library:write', state: 'st-123', code_challenge: challenge, code_challenge_method: 'S256', allow: '0' });
  const denyUrl = new URL(denied.location);
  expect(denyUrl.searchParams.get('error')).toBe('access_denied');
  expect(denyUrl.searchParams.get('state')).toBe('st-123');
});

test('consent with a bad CSRF token is rejected', async () => {
  const { cookie } = await register();
  const client = (await registerClient()).body;
  const { challenge } = pkce();
  const uri = 'http://127.0.0.1:6274/callback';
  await consent(cookie, client.client_id, uri, challenge);
  const bad = await app.request(ORIGIN + '/api/oauth/authorize', {
    method: 'POST', headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrf: 'wrong', client_id: client.client_id, redirect_uri: uri, scope: 'library:read', code_challenge: challenge, code_challenge_method: 'S256', allow: '1' }).toString(),
  });
  expect(bad.status).toBe(403);
});

// --- Task 5: token endpoint (code -> tokens, refresh rotation, reuse) ---
const uri = 'http://127.0.0.1:6274/callback';

test('authorization_code exchange issues an access + refresh pair', async () => {
  const { cookie } = await register();
  const client = (await registerClient()).body;
  const { verifier, challenge } = pkce();
  const code = await mintCode(cookie, client.client_id, uri, challenge, 'library:read library:write');
  const r = await token({ grant_type: 'authorization_code', code, redirect_uri: uri, client_id: client.client_id, code_verifier: verifier });
  expect(r.status).toBe(200);
  expect(r.headers.get('cache-control')).toContain('no-store');
  expect(r.body.access_token).toMatch(/^fk_mcp_/);
  expect(r.body.token_type).toBe('Bearer');
  expect(r.body.expires_in).toBe(3600);
  expect(r.body.refresh_token).toMatch(/^fk_ref_/);
  expect(r.body.scope).toBe('library:read library:write');
});

test('a wrong code_verifier is rejected as invalid_grant', async () => {
  const { cookie } = await register();
  const client = (await registerClient()).body;
  const { challenge } = pkce();
  const code = await mintCode(cookie, client.client_id, uri, challenge);
  const r = await token({ grant_type: 'authorization_code', code, redirect_uri: uri, client_id: client.client_id, code_verifier: 'x'.repeat(43) });
  expect(r.status).toBe(400);
  expect(r.body.error).toBe('invalid_grant');
});

test('replaying an authorization code is rejected', async () => {
  const { cookie } = await register();
  const client = (await registerClient()).body;
  const { verifier, challenge } = pkce();
  const code = await mintCode(cookie, client.client_id, uri, challenge);
  const first = await token({ grant_type: 'authorization_code', code, redirect_uri: uri, client_id: client.client_id, code_verifier: verifier });
  expect(first.status).toBe(200);
  const replay = await token({ grant_type: 'authorization_code', code, redirect_uri: uri, client_id: client.client_id, code_verifier: verifier });
  expect(replay.status).toBe(400);
  expect(replay.body.error).toBe('invalid_grant');
});

test('refresh rotates the pair, and reusing a consumed refresh revokes the family', async () => {
  const { cookie } = await register();
  const client = (await registerClient()).body;
  const { verifier, challenge } = pkce();
  const code = await mintCode(cookie, client.client_id, uri, challenge);
  const first = await token({ grant_type: 'authorization_code', code, redirect_uri: uri, client_id: client.client_id, code_verifier: verifier });
  const refresh1 = first.body.refresh_token as string;

  const rotated = await token({ grant_type: 'refresh_token', refresh_token: refresh1, client_id: client.client_id });
  expect(rotated.status).toBe(200);
  expect(rotated.body.access_token).toMatch(/^fk_mcp_/);
  expect(rotated.body.refresh_token).toMatch(/^fk_ref_/);
  expect(rotated.body.refresh_token).not.toBe(refresh1);
  const refresh2 = rotated.body.refresh_token as string;

  // Reuse of the now-consumed refresh1 -> reuse detection -> family revoked.
  const reuse = await token({ grant_type: 'refresh_token', refresh_token: refresh1, client_id: client.client_id });
  expect(reuse.status).toBe(400);
  expect(reuse.body.error).toBe('invalid_grant');
  // ...and the rotated refresh2 (same family) is now dead too.
  const after = await token({ grant_type: 'refresh_token', refresh_token: refresh2, client_id: client.client_id });
  expect(after.status).toBe(400);
  expect(db.query('SELECT COUNT(*) n FROM customer_oauth_refresh').get() as any).toMatchObject({ n: 0 });
});
