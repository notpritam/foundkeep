import { afterEach, beforeEach, expect, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { openDb } from '../src/db.ts';
import { createApp } from '../src/app.ts';
import { config } from '../src/config.ts';
import { SCOPES } from '../src/customer-mcp-oauth.ts';

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
