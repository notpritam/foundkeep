'use client';

import {useEffect, useRef, useState} from 'react';
import {getOAuthProviders, oauthProviderNames, startOAuth, type OAuthIntent, type OAuthProvider} from '@/lib/oauth';

interface Props {
  intent?: OAuthIntent;
  accountId?: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  onProviders?: (providers: OAuthProvider[]) => void;
}

export function OAuthButtons({intent = 'sign-in', accountId, disabled = false, onError, onProviders}: Props) {
  const [providers, setProviders] = useState<OAuthProvider[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [startError, setStartError] = useState('');
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const providersCallback = useRef(onProviders);

  useEffect(() => { providersCallback.current = onProviders; }, [onProviders]);
  useEffect(() => {
    const controller = new AbortController();
    setProviders(null);
    setLoadError('');
    void getOAuthProviders(controller.signal).then(available => {
      if (controller.signal.aborted) return;
      setProviders(available);
      providersCallback.current?.(available);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setProviders([]);
      providersCallback.current?.([]);
      setLoadError(intent === 'delete'
        ? 'Identity verification is temporarily unavailable. Try again shortly.'
        : 'Social sign-in is temporarily unavailable. You can retry or continue with email.');
    });
    return () => controller.abort();
  }, [attempt, intent]);

  async function begin(provider: OAuthProvider) {
    if (busy.current || disabled) return;
    busy.current = true;
    setBusyProvider(provider);
    setStartError('');
    onError?.('');
    try { await startOAuth(provider, intent, accountId); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-in could not be started. Please try again.';
      if (onError) onError(message); else setStartError(message);
      busy.current = false;
      setBusyProvider(null);
    }
  }

  const unavailable = intent === 'delete' && providers?.length === 0 && !loadError;
  return <>
    <div id="oauth-loading" className="oauth-loading" role="status" hidden={providers !== null}>
      <span className="sr-only">Loading sign-in options…</span><span aria-hidden="true"/><span aria-hidden="true"/>
    </div>
    <div id="oauth-buttons" className="oauth-buttons" hidden={!providers?.length} aria-busy={busyProvider !== null}>
      {providers?.map(provider => <button key={provider} type="button" className="button secondary wide oauth-provider" data-provider={provider} disabled={disabled || busyProvider !== null} onClick={() => void begin(provider)}>
        <img src={`/assets/provider-${provider}.svg`} width={20} height={20} alt=""/>
        {busyProvider === provider ? 'Opening sign-in…' : `${intent === 'delete' ? 'Verify with' : 'Continue with'} ${oauthProviderNames[provider]}`}
      </button>)}
    </div>
    {loadError || unavailable ? <div className="oauth-discovery-error" role="status">
      <p>{loadError || 'Identity verification is temporarily unavailable. Try again shortly, or contact support.'}</p>
      <button type="button" className="subtle-button" onClick={() => setAttempt(value => value + 1)} disabled={providers === null}>Retry sign-in options</button>
    </div> : null}
    {startError ? <p className="form-message is-error" role="alert">{startError}</p> : null}
  </>;
}
