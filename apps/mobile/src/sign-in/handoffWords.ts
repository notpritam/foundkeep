import { OAUTH_NAMES, type OAuthProvider } from '../auth-oauth.ts';

/** Where the handoff after "Continue with Google" stands: the sign-in buttons
 * (choose), opening the provider, waiting while it's open in the browser,
 * signing in on the way back, didn't finish, or an existing collection to
 * connect with its password (link). */
export type HandoffPhase = 'choose' | 'opening' | 'browser' | 'finishing' | 'failed' | 'link';

/** What each state says — three or four words, so the cards circling them never crowd them
 * (Pritam, 2026-10-02). reason: why it didn't finish, when the app knows. */
export function handoffWords(phase: HandoffPhase, provider: OAuthProvider | null, reason?: string) {
  const name = provider ? OAUTH_NAMES[provider] : null;
  switch (phase) {
    case 'opening': return { title: `Opening ${name ?? 'sign-in'}…`, body: '' };
    case 'browser': return { title: `Waiting for ${name ?? 'sign-in'}`, body: 'You’ll come right back.' };
    case 'finishing': return { title: 'Signing you in…', body: '' };
    case 'failed': return { title: 'Sign-in didn’t finish', body: reason || 'Nothing has changed.' };
    case 'link': return { title: 'Connect your collection', body: `Your email already has a FoundKeep collection. Enter its password once to connect ${name ?? 'this sign-in'}.` };
    default: return { title: '', body: '' };
  }
}
