import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database } from 'bun:sqlite';
import type { Hono } from 'hono';
import type { CustomerEnv } from './customer.ts';
import { moduleFail as fail, type CustomerServices, type CustomerContext } from './customer-modules.ts';
import { config } from './config.ts';

// OAuth 2.1 authorization server for the FoundKeep MCP endpoint. Public clients
// only (PKCE S256, no client secret). The access token IS the existing
// `fk_mcp_` agent token (see mintAgentToken); this module only issues, rotates
// and consents. Endpoints mount under /api/oauth/*; discovery lives at the root.

/** The exact scopes the MCP surface understands. Order is the metadata order. */
export const SCOPES = ['library:read', 'library:write', 'files:read'] as const;
export type OAuthScope = (typeof SCOPES)[number];

const DAY = 86_400_000;
const CODE_TTL_MS = 60_000; // single-use auth codes are short-lived by design.
const REFRESH_TTL_MS = 90 * DAY;
const ACCESS_TTL_MS = 60 * 60_000; // OAuth-minted access tokens live 1h.
const CLIENT_CAP = 5000; // bound stored DCR clients; evict the least-recently-used.

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
const rand = (bytes = 32): string => randomBytes(bytes).toString('base64url');
/** Duck-typed 401 from customer.ts `auth()` (its CustomerError is not exported). */
const isUnauthorized = (error: unknown): boolean =>
  !!error && typeof error === 'object' && (error as { status?: unknown }).status === 401;

/** The two discovery documents, derived entirely from the issuer origin.
 *  `protectedResource` → /.well-known/oauth-protected-resource;
 *  `authorizationServer` → /.well-known/oauth-authorization-server. */
export function oauthMetadata(origin: string): {
  protectedResource: Record<string, unknown>;
  authorizationServer: Record<string, unknown>;
} {
  return {
    protectedResource: {
      resource: origin + '/api/mcp',
      authorization_servers: [origin],
      scopes_supported: [...SCOPES],
      bearer_methods_supported: ['header'],
    },
    authorizationServer: {
      issuer: origin,
      authorization_endpoint: origin + '/api/oauth/authorize',
      token_endpoint: origin + '/api/oauth/token',
      registration_endpoint: origin + '/api/oauth/register',
      scopes_supported: [...SCOPES],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    },
  };
}

// --- In-memory single-use authorization codes (mirrors the admin SSO pattern) ---
// A single backend process holds these; 60s TTL makes restart durability moot.
type AuthCodeRecord = {
  clientId: string;
  accountId: string;
  scopes: OAuthScope[];
  codeChallenge: string;
  redirectUri: string;
  exp: number;
};
const authCodes = new Map<string, AuthCodeRecord>();
function sweepAuthCodes(): void {
  const now = Date.now();
  for (const [key, value] of authCodes) if (value.exp <= now) authCodes.delete(key);
}

/** A redirect URI is acceptable when it is an absolute https URL, or an http
 *  loopback URL (127.0.0.1 / ::1 / localhost, any port) per RFC 8252 for native
 *  clients. Credentials and fragments are rejected (RFC 6749 §3.1.2). */
export function validRedirectUri(uri: unknown): boolean {
  if (typeof uri !== 'string' || uri.length > 2048) return false;
  let url: URL;
  try { url = new URL(uri); } catch { return false; }
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === 'https:') return true;
  if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) return true;
  return false;
}

type ClientRow = { client_id: string; client_name: string; redirect_uris_json: string };
const getClient = (db: Database, id: unknown): ClientRow | null =>
  typeof id === 'string' && id
    ? (db.query('SELECT client_id,client_name,redirect_uris_json FROM customer_oauth_clients WHERE client_id=?').get(id) as ClientRow | null)
    : null;

/** PKCE S256 check: base64url(sha256(verifier)) === challenge (constant-time). */
function pkceMatches(verifier: string, challenge: string): boolean {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  if (computed.length !== challenge.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
}

const SCOPE_LABELS: Record<OAuthScope, string> = {
  'library:read': 'See your saved items, folders, and tags',
  'library:write': 'Create and organize saves, folders, and tags',
  'files:read': 'Download your saved files and attachments',
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/** Add/override query params on an already-validated redirect URI. */
function withParams(uri: string, params: Record<string, string | undefined>): string {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') url.searchParams.set(key, value);
  return url.toString();
}

/** A minimal, dependency-free consent page. No inline script (a plain POST form). */
function consentPage(fields: { clientName: string; scopes: OAuthScope[]; csrf: string; params: Record<string, string> }): string {
  const hidden = Object.entries({ ...fields.params, csrf: fields.csrf })
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('');
  const list = fields.scopes.map(scope => `<li>${escapeHtml(SCOPE_LABELS[scope])}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Connect to FoundKeep</title>
<style>:root{color-scheme:light dark}body{font:16px/1.5 system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1.25rem;background:#0f1011;color:#e8e8e8}@media(prefers-color-scheme:light){body{background:#fff;color:#111}}h1{font-size:1.35rem}.card{border:1px solid #2a2c2e;border-radius:14px;padding:1.25rem}@media(prefers-color-scheme:light){.card{border-color:#e2e2e2}}ul{padding-left:1.1rem}li{margin:.35rem 0}.row{display:flex;gap:.75rem;margin-top:1.5rem}button{flex:1;padding:.7rem 1rem;border-radius:10px;border:0;font:inherit;font-weight:600;cursor:pointer}.allow{background:#4cc38a;color:#04130c}.deny{background:transparent;border:1px solid #3a3c3e;color:inherit}.muted{color:#9aa0a6;font-size:.9rem}</style></head>
<body><div class="card"><h1>Connect <strong>${escapeHtml(fields.clientName)}</strong> to FoundKeep</h1>
<p>This app is asking permission to:</p><ul>${list}</ul>
<p class="muted">You can revoke this connection any time in Settings &rarr; Agent connections.</p>
<form method="post" action="/api/oauth/authorize">${hidden}
<div class="row"><button class="deny" type="submit" name="allow" value="0">Deny</button><button class="allow" type="submit" name="allow" value="1">Allow access</button></div></form>
</div></body></html>`;
}

const errorPage = (message: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Connection error</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1.25rem}</style></head>
<body><h1>This connection can&#39;t continue</h1><p>${escapeHtml(message)}</p></body></html>`;

export interface McpOAuthDeps {
  /** Mint an `fk_mcp_` access token (reuses customer_agent_tokens). Returns the raw token. */
  issueAccessToken(accountId: string, name: string, scopes: string[], ttlMs: number): string;
  /** Build the site login URL that returns the browser to `returnTo` after sign-in. */
  loginUrl(returnTo: string): string;
}

export function registerMcpOAuth(
  app: Hono<CustomerEnv>,
  db: Database,
  services: CustomerServices,
  deps: McpOAuthDeps,
): void {
  const { auth, jsonBody, rate } = services;
  const clientIp = (c: { env?: { clientIp?: string } }) => c.env?.clientIp || 'unknown';

  // --- RFC 7591 Dynamic Client Registration (public clients only, no session) ---
  app.post('/oauth/register', async c => {
    rate('oauth-register:' + clientIp(c), 20, 60_000);
    const body = await jsonBody(c);
    const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
    if (!clientName || clientName.length > 200) fail(400, 'invalid_client_metadata', 'Provide a client_name of 1 to 200 characters.');
    const redirectUris = body.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length < 1 || redirectUris.length > 5 || !redirectUris.every(validRedirectUri)) {
      fail(400, 'invalid_redirect_uri', 'Provide 1 to 5 https or loopback (127.0.0.1/localhost) redirect URIs.');
    }
    if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== 'none') {
      fail(400, 'invalid_client_metadata', 'Only public clients (token_endpoint_auth_method "none") are supported.');
    }
    const uris = [...new Set(redirectUris as string[])];
    const now = Date.now();
    const clientId = 'fkc_' + rand(24);
    db.transaction(() => {
      const count = (db.query('SELECT COUNT(*) n FROM customer_oauth_clients').get() as { n: number }).n;
      // Bound the table: evict the least-recently-used clients past the cap.
      if (count >= CLIENT_CAP) db.query('DELETE FROM customer_oauth_clients WHERE client_id IN (SELECT client_id FROM customer_oauth_clients ORDER BY last_used_at ASC LIMIT ?)').run(count - CLIENT_CAP + 1);
      db.query('INSERT INTO customer_oauth_clients(client_id,client_name,redirect_uris_json,created_at,last_used_at) VALUES(?,?,?,?,?)').run(clientId, clientName, JSON.stringify(uris), now, now);
    })();
    c.header('Cache-Control', 'no-store');
    return c.json({
      client_id: clientId,
      client_id_issued_at: Math.floor(now / 1000),
      client_name: clientName,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }, 201);
  });

  // --- Authorization endpoint: validate, reuse the web session, show consent ---
  // The CSRF token binds the consent to this browser session + client + redirect.
  const csrfToken = (credentialId: string, clientId: string, redirectUri: string) =>
    digest(credentialId + '|' + clientId + '|' + redirectUri);
  const errorResponse = (c: CustomerContext, message: string) => {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    return c.html(errorPage(message), 400);
  };

  app.get('/oauth/authorize', c => {
    const q = c.req.query();
    const client = getClient(db, q.client_id);
    const registered = client ? (JSON.parse(client.redirect_uris_json) as string[]) : [];
    // An unverified client or redirect must NEVER become an open redirect.
    if (!client || !q.redirect_uri || !registered.includes(q.redirect_uri)) {
      return errorResponse(c, 'This app could not be verified. It may be misconfigured. Close this page and connect again.');
    }
    const redirectUri = q.redirect_uri;
    const state = q.state;
    const back = (error: string, description?: string) => c.redirect(withParams(redirectUri, { error, error_description: description, state }), 302);
    if (q.response_type !== 'code') return back('unsupported_response_type', 'Only response_type=code is supported.');
    if (!q.code_challenge || q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9._~-]{43}$/.test(q.code_challenge)) return back('invalid_request', 'PKCE with code_challenge_method=S256 is required.');
    const requested = (q.scope || '').split(/\s+/).filter(Boolean);
    if (requested.some(scope => !(SCOPES as readonly string[]).includes(scope))) return back('invalid_scope', 'An unsupported scope was requested.');
    const scopes = (requested.length ? [...new Set(requested)] : ['library:read']) as OAuthScope[];

    let account: { id: string }, credentialId: string;
    try { const session = auth(c, true); account = session.account; credentialId = session.credentialId; }
    catch (error) {
      if (isUnauthorized(error)) return c.redirect(deps.loginUrl(c.req.url), 302);
      throw error;
    }
    void account;
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    return c.html(consentPage({
      clientName: client.client_name,
      scopes,
      csrf: csrfToken(credentialId, client.client_id, redirectUri),
      params: { client_id: client.client_id, redirect_uri: redirectUri, scope: scopes.join(' '), state: state ?? '', code_challenge: q.code_challenge, code_challenge_method: 'S256' },
    }));
  });

  app.post('/oauth/authorize', async c => {
    const form = await c.req.parseBody();
    const str = (key: string) => (typeof form[key] === 'string' ? (form[key] as string) : '');
    const clientId = str('client_id');
    const redirectUri = str('redirect_uri');
    const client = getClient(db, clientId);
    const registered = client ? (JSON.parse(client.redirect_uris_json) as string[]) : [];
    if (!client || !redirectUri || !registered.includes(redirectUri)) {
      return errorResponse(c, 'This app could not be verified. Close this page and connect again.');
    }
    let session;
    try { session = auth(c, true); }
    catch (error) {
      if (isUnauthorized(error)) return c.redirect(deps.loginUrl(config.customerOrigin + '/api/oauth/authorize'), 302);
      throw error;
    }
    if (str('csrf') !== csrfToken(session.credentialId, clientId, redirectUri)) fail(403, 'invalid_csrf', 'Your consent could not be verified. Connect again.');
    rate('oauth-consent:' + session.account.id, 30, 60_000);
    const state = form.state !== undefined ? str('state') : undefined;
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    if (str('allow') !== '1') return c.redirect(withParams(redirectUri, { error: 'access_denied', state }), 302);

    const codeChallenge = str('code_challenge');
    if (str('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9._~-]{43}$/.test(codeChallenge)) return c.redirect(withParams(redirectUri, { error: 'invalid_request', error_description: 'PKCE S256 is required.', state }), 302);
    const requested = str('scope').split(/\s+/).filter(Boolean);
    if (requested.some(scope => !(SCOPES as readonly string[]).includes(scope))) return c.redirect(withParams(redirectUri, { error: 'invalid_scope', state }), 302);
    const scopes = (requested.length ? [...new Set(requested)] : ['library:read']) as OAuthScope[];

    const code = 'fka_' + rand(32);
    sweepAuthCodes();
    authCodes.set(digest(code), { clientId, accountId: session.account.id, scopes, codeChallenge, redirectUri, exp: Date.now() + CODE_TTL_MS });
    db.query('UPDATE customer_oauth_clients SET last_used_at=? WHERE client_id=?').run(Date.now(), clientId);
    return c.redirect(withParams(redirectUri, { code, state }), 302);
  });

  void deps;
}
