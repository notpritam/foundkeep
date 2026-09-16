import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database } from 'bun:sqlite';
import type { Hono } from 'hono';
import type { CustomerEnv } from './customer.ts';
import { moduleFail as fail, type CustomerServices } from './customer-modules.ts';
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

  // Further routes (authorize, token) are added in the tasks that follow.
  void auth;
  void deps;
}
