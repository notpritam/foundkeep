// Which sign-in providers the first screen offers: Google first, then Apple,
// as in the design; anything else the server adds follows. Sign-in is Apple or
// Google only (no email), so when none can be loaded the screen must say so
// and offer to try again rather than show no way in at all.
import { isOAuthProvider, type OAuthProvider } from '../auth-oauth.ts';

const ORDER: OAuthProvider[] = ['google', 'apple'];
export type SignInProviders = { providers: OAuthProvider[]; failed: boolean };

export async function loadSignInProviders(client: { oauthProviders(): Promise<{ providers: unknown }> }): Promise<SignInProviders> {
  try {
    const { providers } = await client.oauthProviders();
    const usable = Array.isArray(providers) ? providers.filter(isOAuthProvider) : [];
    const rank = (p: OAuthProvider) => (ORDER.includes(p) ? ORDER.indexOf(p) : ORDER.length);
    const sorted = [...usable].sort((a, b) => rank(a) - rank(b));
    return { providers: sorted, failed: sorted.length === 0 };
  } catch {
    return { providers: [], failed: true };
  }
}
