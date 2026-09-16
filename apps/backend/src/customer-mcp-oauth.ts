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
  // Routes are added in the tasks that follow (register, authorize, token).
  void app;
  void db;
  void services;
  void deps;
}
