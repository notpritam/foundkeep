import {api} from './api';

export const oauthProviderNames = {google: 'Google', apple: 'Apple', github: 'GitHub', twitter: 'X'} as const;
export type OAuthProvider = keyof typeof oauthProviderNames;
export type OAuthIntent = 'sign-in' | 'delete';
export interface OAuthHandoff {flow: string; code: string; verifier: string; intent: OAuthIntent; accountId?: string}

const flowPattern = /^[a-f0-9]{32}$/;
const proofPattern = /^[A-Za-z0-9_-]{43}$/;
const storageKey = (flow: string) => `foundkeep-oauth-${flow}`;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function getOAuthProviders(signal?: AbortSignal): Promise<OAuthProvider[]> {
  if (window.location.hostname === 'atlas.notpritam.in') return [];
  const result = await api<{providers: unknown}>('/auth/providers', {signal});
  const providers = result.providers;
  if (!Array.isArray(providers)) throw new Error('Sign-in options could not be loaded. Please try again.');
  return (Object.keys(oauthProviderNames) as OAuthProvider[]).filter(provider => providers.includes(provider));
}

export async function startOAuth(provider: OAuthProvider, intent: OAuthIntent = 'sign-in', accountId?: string): Promise<void> {
  const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
  const codeChallenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const result = await api<{flow: string; authorizeUrl: string}>('/auth/oauth/start', {
    method: 'POST', accountId, body: {provider, client: 'web', intent, codeChallenge},
  });
  if (!flowPattern.test(result.flow) || result.authorizeUrl !== `${window.location.origin}/api/auth/oauth/authorize/${result.flow}`) {
    throw new Error('Sign-in could not be started. Open foundkeep.app and try again.');
  }
  // Keep the existing browser proof format so provider handoffs survive migration.
  for (const key of Object.keys(sessionStorage)) if (key.startsWith('foundkeep-oauth-')) sessionStorage.removeItem(key);
  sessionStorage.setItem(storageKey(result.flow), JSON.stringify({verifier, intent, expires: Date.now() + 600000, ...(intent === 'delete' && accountId ? {accountId} : {})}));
  window.location.assign(result.authorizeUrl);
}

export function clearOAuthHandoff(flow: string): void {
  try { sessionStorage.removeItem(storageKey(flow)); } catch { /* Storage can become unavailable after a provider return. */ }
}

export function readOAuthHandoff(params: URLSearchParams): OAuthHandoff | null {
  const flow = params.get('flow') || '';
  const code = params.get('code') || '';
  let pending: {verifier?: unknown; intent?: unknown; expires?: unknown; accountId?: unknown} | null = null;
  try { pending = JSON.parse(sessionStorage.getItem(storageKey(flow)) || 'null'); } catch { /* Invalid or unavailable browser proof. */ }
  if (params.has('error') || !flowPattern.test(flow) || !proofPattern.test(code) || !pending
      || typeof pending.expires !== 'number' || !Number.isFinite(pending.expires) || pending.expires < Date.now()
      || typeof pending.verifier !== 'string' || !proofPattern.test(pending.verifier)
      || !['sign-in', 'delete'].includes(String(pending.intent))) {
    clearOAuthHandoff(flow);
    return null;
  }
  return {flow, code, verifier: pending.verifier, intent: pending.intent as OAuthIntent,
    ...(pending.intent === 'delete' && typeof pending.accountId === 'string' && pending.accountId ? {accountId: pending.accountId} : {})};
}
