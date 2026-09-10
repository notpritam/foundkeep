import {redirect} from 'next/navigation';
import {getSession} from '@/lib/server';
import {AuthForm, type AuthMode} from './auth-form';
import {OAuthCompletion} from './auth-oauth-completion';
import {AuthSessionRetry} from './auth-session-retry';
import {AuthShell} from './auth-shell';
import '../auth.css';

export type AuthSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function AuthPage({searchParams, mode = 'signup', legacyMode = false}: {searchParams: AuthSearchParams; mode?: AuthMode; legacyMode?: boolean}) {
  const params = await searchParams;
  const requestedMode = params.mode;
  const selectedMode: AuthMode = legacyMode && (requestedMode === 'login' || requestedMode === 'signup' || requestedMode === 'recover') ? requestedMode : mode;
  const hasHandoff = ['flow', 'code', 'error'].some(key => params[key] !== undefined);
  // A signed-in browser still needs its provider return to finish deletion or linking.
  if (hasHandoff) return <AuthShell headingId="oauth-title"><OAuthCompletion/></AuthShell>;
  let session;
  try { session = await getSession(); }
  catch { return <AuthShell><AuthSessionRetry/></AuthShell>; }
  if (session) redirect('/dashboard');
  return <AuthShell><AuthForm key={selectedMode} mode={selectedMode} deleted={params.deleted === '1'}/></AuthShell>;
}
