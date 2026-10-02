import { getEnvironment } from '../../environment.ts';
import { AdaptiveText as Text } from '../../components/AdaptiveText.tsx';
import * as Crypto from 'expo-crypto';
import { router, Stack, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { createFoundkeepClient, FoundkeepApiError } from '../../api/client.ts';
import { isOAuthProvider, OAUTH_NAMES, parseOAuthReturn, pendingOAuth, validAuthorizeUrl, type OAuthIntent, type OAuthProvider, type PendingOAuth } from '../../auth-oauth.ts';
import { Brand, Button, Message, Screen } from '../../components/ui.tsx';
import { useSession } from '../../session/SessionProvider.tsx';
import { HandoffView, type HandoffAction } from '../../sign-in/Handoff.tsx';
import type { HandoffPhase } from '../../sign-in/handoffWords.ts';
import { typography } from '../../theme.ts';

// The handoff to Apple or Google and back. Signing in shows the sign-in sky
// with the cards gathered round the provider's mark (sign-in/Handoff.tsx);
// verifying before deleting an account keeps the plain settings-style page.
type Handoff = { flow: string; code: string; pending: PendingOAuth };
export default function OAuthComplete() {
  const params = useLocalSearchParams();
  const session = useSession();
  const latest = useRef(session); latest.current = session;
  const started = useRef(false), handled = useRef(''), canceled = useRef(false);
  const owner = useRef(Symbol('oauth-screen')).current;
  useFocusEffect(useCallback(() => {
    canceled.current = false;
    return () => {
      canceled.current = true;
      // The URL entry point marks an expected provider return before Router
      // navigates. Ordinary back/blur clears ownership immediately.
      pendingOAuth.release(owner);
    };
  }, [owner]));
  const [busy, setBusy] = useState(false);
  // Signing in: where the handoff stands, and why it didn't finish (when known).
  const [stage, setStage] = useState<HandoffPhase>(typeof params.flow === 'string' ? 'finishing' : 'opening');
  const [reason, setReason] = useState('');
  const [provider, setProvider] = useState<OAuthProvider | null>(isOAuthProvider(params.provider) ? params.provider : null);
  const [linkError, setLinkError] = useState('');
  // Verifying before deleting: the page's own words.
  const [message, setMessage] = useState('Opening secure sign-in…');
  const [error, setError] = useState('');
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [password, setPassword] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [deletingIntent, setDeletingIntent] = useState(params.intent === 'delete');

  const fail = (why = '') => {
    setStage('failed'); setReason(why); setMessage('');
    setError(why || 'Sign-in was canceled or could not be verified. Please start again.');
  };

  /** Opens the provider in the browser, from the start (also for Try again and Open again). */
  async function begin(chosen: OAuthProvider, intent: OAuthIntent) {
    setBusy(true); setStage('opening'); setReason(''); setLinkError(''); setPassword(''); setError(''); setMessage('Opening secure sign-in…');
    handled.current = '';
    try {
      pendingOAuth.clear();
      const verifier = Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
      const codeChallenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const result = await latest.current.client.startOAuth({ provider: chosen, intent, codeChallenge });
      if (!validAuthorizeUrl(result.authorizeUrl, result.flow)) throw new Error('Sign-in could not be started. Try again.');
      if (canceled.current) return;
      pendingOAuth.set({ flow: result.flow, verifier, provider: chosen, intent }, owner);
      setStage('browser'); setMessage(`Continue with ${OAUTH_NAMES[chosen]} in your browser. You’ll return here automatically.`);
      await Linking.openURL(result.authorizeUrl);
    } catch (value) { pendingOAuth.clear(owner); if (!canceled.current) fail((value as Error).message); }
    finally { setBusy(false); }
  }

  async function exchange(value: Handoff, existingPassword?: string) {
    setBusy(true); setError(''); setLinkError(''); setMessage('Finishing your sign-in…');
    // With a password, the card stays (its button says Connecting…) until it works.
    if (!existingPassword) setStage('finishing');
    try {
      if (!pendingOAuth.get(value.flow, owner)) throw new Error('Sign-in expired. Please start again.');
      const result = await latest.current.client.exchangeOAuth({ flow: value.flow, code: value.code, verifier: value.pending.verifier, ...(existingPassword ? { password: existingPassword } : {}) }, value.pending.intent);
      if (canceled.current || !pendingOAuth.get(value.flow, owner)) {
        // An abandoned handoff must not leave an unused live device connection.
        if ('token' in result) await createFoundkeepClient({ getToken: async () => result.token }).logout().catch(() => {});
        return;
      }
      setPassword('');
      if (value.pending.intent === 'delete' && 'reauthToken' in result) {
        pendingOAuth.clear(owner); setProof(result.reauthToken);
        setMessage('Identity verified. Deleting your account will permanently remove your cloud collection and connections. This cannot be undone.');
      } else if (value.pending.intent === 'sign-in' && 'token' in result) {
        setStage('finishing');
        await latest.current.acceptOAuthSession(result);
        router.replace((latest.current.consumePendingRoute() || '/(app)/(tabs)/collection') as Href);
      } else throw new Error('Sign-in could not be completed. Please start again.');
    } catch (value) {
      if (canceled.current) return;
      const why = (value as Error).message;
      if (value instanceof FoundkeepApiError && ['account_link_required', 'invalid_credentials'].includes(value.code)) {
        setStage('link'); setMessage(''); setError(why);
        if (value.code === 'invalid_credentials') setLinkError('That password didn’t match. Try again.');
      } else { pendingOAuth.clear(owner); fail(why); }
    } finally { setBusy(false); }
  }

  const serialized = JSON.stringify(params);
  useEffect(() => {
    if (!session.ready) return;
    const values = JSON.parse(serialized) as Record<string, string | string[]>;
    if (typeof values.flow === 'string') {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(values)) for (const part of Array.isArray(value) ? value : [value]) query.append(key, part);
      const returned = parseOAuthReturn(`${getEnvironment().scheme}://oauth/complete?` + query);
      if (!returned || returned.error) { pendingOAuth.clear(); fail(); return; }
      if (handled.current === returned.flow) return;
      handled.current = returned.flow;
      const pending = pendingOAuth.claim(returned.flow, owner);
      if (!pending) { fail('This sign-in expired or the app restarted. Start again.'); return; }
      const value = { flow: returned.flow, code: returned.code!, pending };
      setProvider(pending.provider); setDeletingIntent(pending.intent === 'delete'); setHandoff(value);
      void exchange(value); return;
    }
    if (started.current) return;
    started.current = true;
    const chosen = values.provider;
    if (!isOAuthProvider(chosen) || !['sign-in', 'delete'].includes(String(values.intent))) { fail('Choose Apple or Google to continue.'); return; }
    setProvider(chosen);
    void begin(chosen, values.intent === 'delete' ? 'delete' : 'sign-in');
  }, [serialized, session.ready]);

  const cancel = () => {
    canceled.current = true; pendingOAuth.clear(owner); setPassword(''); setProof(null);
    router.replace(deletingIntent && session.account ? '/(app)/(tabs)/settings' : '/(auth)/sign-in');
  };
  const remove = async () => {
    if (!proof || busy) return;
    setBusy(true); setError('');
    try { await session.deleteAccount({ reauthToken: proof }); setProof(null); router.replace('/(auth)/sign-in'); }
    catch (value) { setError((value as Error).message); }
    finally { setBusy(false); }
  };
  const act = (action: HandoffAction) => {
    if (action === 'back') { if (!busy) cancel(); }
    else if (action === 'connect') { if (handoff && password && !busy) void exchange(handoff, password); }
    else if ((action === 'retry' || action === 'reopen') && provider && !busy) void begin(provider, 'sign-in');
  };

  if (!deletingIntent) return <>
    <Stack.Screen options={{ gestureEnabled: !busy }} />
    <HandoffView enter phase={stage} provider={provider} reason={reason} password={password} onPassword={setPassword} passwordError={linkError} busy={busy} on={act} />
  </>;
  return <Screen><Stack.Screen options={{ gestureEnabled: !busy }} /><ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 24 }}><Brand compact /><Text style={typography.title}>Verify your account.</Text><Message>{message}</Message><Message error>{error}</Message>{proof ? <Button label="Delete account permanently" danger loading={busy} onPress={() => void remove()} /> : null}<Button label="Keep my account" secondary disabled={busy} onPress={cancel} /></ScrollView></Screen>;
}
