import { afterEach, beforeEach, expect, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { openDb } from '../src/db.ts';
import { createApp } from '../src/app.ts';
import { config } from '../src/config.ts';
import { SCOPES, oauthMetadata } from '../src/customer-mcp-oauth.ts';

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
