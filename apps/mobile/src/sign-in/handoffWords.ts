import { OAUTH_NAMES, type OAuthProvider } from '../auth-oauth.ts';

/** Where the handoff after "Continue with Google" stands: the sign-in buttons
 * (choose), opening the provider, waiting while it's open in the browser,
 * signing in on the way back, didn't finish, or an existing collection to
 * connect with its password (link). */
export type HandoffPhase = 'choose' | 'opening' | 'browser' | 'finishing' | 'failed' | 'link';

/** What each state says. reason: why it didn't finish, when the app knows. */
export function handoffWords(phase: HandoffPhase, provider: OAuthProvider | null, reason?: string) {
  const name = provider ? OAUTH_NAMES[provider] : null;
  switch (phase) {
    case 'opening': return { title: `Opening ${name ?? 'sign-in'}…`, body: '' };
    case 'browser': return { title: `Waiting for ${name ?? 'sign-in'}`, body: 'Finish signing in there and you’ll come straight back.' };
    case 'finishing': return { title: 'Signing you in…', body: '' };
    case 'failed': return { title: 'Sign-in didn’t finish', body: reason || `It was canceled, or ${name ?? 'Apple or Google'} couldn’t confirm it was you. Nothing has changed.` };
    case 'link': return { title: 'You already have a collection', body: `Your email already has a FoundKeep account. Enter its password once to connect ${name ?? 'this sign-in'} to it.` };
    default: return { title: '', body: '' };
  }
}
