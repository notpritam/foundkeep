import { createHash } from 'node:crypto';

export const OAUTH_PROVIDERS = ['apple', 'google', 'github', 'twitter'] as const;
export type OAuthProvider = typeof OAUTH_PROVIDERS[number];
export type OAuthIdentity = { subject: string; email: string; name: string };
export interface OAuthGateway {
  issuer: string;
  providers: readonly OAuthProvider[];
  authorize(provider: OAuthProvider, callback: string, verifier: string): Promise<string>;
  identity(code: string, verifier: string, provider: OAuthProvider): Promise<OAuthIdentity>;
  deleteUser(subject: string): Promise<void>;
}
export class OAuthError extends Error {
  constructor(readonly code: string, message: string, readonly status: 400 | 401 | 403 | 409 | 429 | 503 = 400) { super(message); }
}
export const challenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');
export const isProvider = (value: unknown): value is OAuthProvider => typeof value === 'string' && (OAUTH_PROVIDERS as readonly string[]).includes(value);
const hosts: Record<OAuthProvider, string[]> = { apple: ['appleid.apple.com'], google: ['accounts.google.com'], github: ['github.com'], twitter: ['x.com', 'twitter.com', 'api.twitter.com', 'api.x.com'] };
const unavailable = () => new OAuthError('provider_unavailable', 'This sign-in method is unavailable. Try again shortly or use your password.', 503);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createSupabaseGateway(env: Record<string, string | undefined> = process.env, fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch): OAuthGateway {
  let issuer = '';
  try {
    const url = new URL(env.SUPABASE_URL || '');
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && url.pathname === '/' && !url.search && !url.hash && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) issuer = url.origin;
  } catch {}
  const key = env.SUPABASE_SECRET_KEY?.trim() || '';
  const enabled = new Set((env.FOUNDKEEP_OAUTH_PROVIDERS || '').split(',').map(x => x.trim()));
  const providers = issuer && key ? OAUTH_PROVIDERS.filter(x => enabled.has(x)) : [];
  const requireConfig = () => { if (!issuer || !key) throw unavailable(); };
  async function send(path: string, options: RequestInit = {}) {
    requireConfig();
    try {
      return await fetcher(issuer + '/auth/v1' + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { apikey: key, 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(options.headers)) } });
    } catch { throw unavailable(); }
  }
  async function json(response: Response): Promise<Record<string, any>> {
    if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) { void response.body?.cancel(); throw unavailable(); }
    // Bound upstream responses; never include their contents in client errors.
    const reader = response.body?.getReader(); if (!reader) throw unavailable();
    let bytes = 0; const parts: Uint8Array[] = [];
    try {
      while (true) { const {done,value} = await reader.read(); if (done) break; bytes += value.length; if (bytes > 128 * 1024) throw unavailable(); parts.push(value); }
      const result = JSON.parse(Buffer.concat(parts).toString('utf8'));
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw unavailable();
      return result;
    } catch { throw unavailable(); } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  return {
    issuer, providers,
    async authorize(provider, callback, verifier) {
      if (!providers.includes(provider)) throw unavailable();
      const query = new URLSearchParams({provider, redirect_to: callback, code_challenge: challenge(verifier), code_challenge_method: 's256'});
      if (provider === 'github') query.set('scopes', 'read:user user:email');
      // The browser receives only the provider redirect. Even Supabase's
      // authorize call is made with a server-only apikey header.
      const response = await send('/authorize?' + query);
      const location = response.headers.get('location'); void response.body?.cancel();
      if (![302,303,307].includes(response.status) || !location) throw unavailable();
      let url: URL; try { url = new URL(location); } catch { throw unavailable(); }
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts[provider].includes(url.hostname) || location.includes(key)) throw unavailable();
      return url.href;
    },
    async identity(code, verifier, provider) {
      const result = await json(await send('/token?grant_type=pkce', {method:'POST',body:JSON.stringify({auth_code:code,code_verifier:verifier})}));
      if (typeof result.access_token !== 'string' || result.access_token.length > 16_384) throw unavailable();
      const user = await json(await send('/user', {headers:{Authorization:'Bearer '+result.access_token}}));
      const selected = Array.isArray(user.identities) ? user.identities.find((x: any) => x.provider === provider)?.identity_data : null;
      // Supabase's email_confirmed_at can be populated by auto-confirm. Only
      // the selected provider's verified email may establish local ownership.
      if (!UUID.test(user.id || '') || user.role !== 'authenticated' || !user.email_confirmed_at || typeof user.email !== 'string' || user.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || selected?.email_verified !== true || typeof selected.email !== 'string' || selected.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
        throw new OAuthError('identity_unverified', 'Your provider must supply a verified email address. Use another sign-in method.', 403);
      }
      const name = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : user.email.split('@')[0];
      return {subject:user.id,email:user.email.trim().toLowerCase(),name:name.trim().slice(0,100) || 'Foundkeep member'};
    },
    async deleteUser(subject) {
      if (!UUID.test(subject)) throw unavailable();
      // Modern secret keys authorize through apikey. Legacy service_role JWTs
      // additionally serve as the bearer for the admin API.
      const headers: Record<string,string> = key.startsWith('eyJ') ? {Authorization:'Bearer '+key} : {};
      const response = await send('/admin/users/' + subject, {method:'DELETE',headers});
      void response.body?.cancel(); if (!response.ok && response.status !== 404) throw unavailable();
    },
  };
}
