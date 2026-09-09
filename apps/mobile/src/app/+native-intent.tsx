import { parseOAuthReturn, pendingOAuth } from '../auth-oauth.ts';

// Expo invokes this before it changes screens for an incoming system URL.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const returned = parseOAuthReturn(path);
  if (returned) pendingOAuth.markReturn(returned.flow);
  return path;
}
