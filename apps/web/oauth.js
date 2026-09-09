import { api, setMessage } from './customer.js?v=1.5.0';
const names = { apple: 'Apple', google: 'Google', github: 'GitHub', twitter: 'X' };
const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const key = flow => 'foundkeep-oauth-' + flow;

export async function mountOAuthButtons(container, message, intent = 'sign-in') {
  if (!container) return;
  container.replaceChildren();
  if (location.hostname === 'atlas.notpritam.in') { container.hidden = true; return; }
  try {
    const { providers } = await api('/auth/providers');
    if (!Array.isArray(providers)) return;
    for (const provider of providers.filter(p => Object.hasOwn(names, p))) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'button secondary wide';
      button.textContent = intent === 'delete' ? `Verify with ${names[provider]}` : `Continue with ${names[provider]}`;
      button.addEventListener('click', async () => {
        container.querySelectorAll('button').forEach(b => { b.disabled = true; });
        setMessage(message, '');
        try {
          // The only client-side secret is a temporary proof for this sign-in.
          const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
          const codeChallenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
          const result = await api('/auth/oauth/start', { method: 'POST', body: { provider, client: 'web', intent, codeChallenge } });
          if (!/^[a-f0-9]{32}$/.test(result.flow) || result.authorizeUrl !== `${location.origin}/api/auth/oauth/authorize/${result.flow}`) throw new Error('Sign-in could not be started. Open foundkeep.app and try again.');
          for (const old of Object.keys(sessionStorage)) if (old.startsWith('foundkeep-oauth-')) sessionStorage.removeItem(old);
          sessionStorage.setItem(key(result.flow), JSON.stringify({ verifier, intent, expires: Date.now() + 600000 }));
          location.assign(result.authorizeUrl);
        } catch (error) { setMessage(message, error.message); container.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
      });
      container.append(button);
    }
    container.hidden = !container.children.length;
    if (container.hidden && intent === 'delete') setMessage(message, 'Identity verification is temporarily unavailable. Try again shortly, or visit foundkeep.app/support.html.');
  } catch { container.hidden = true; if (intent === 'delete') setMessage(message, 'Identity verification is temporarily unavailable. Try again shortly.'); }
}

export function completeOAuth() {
  const params = new URLSearchParams(location.search);
  if (!params.has('flow')) return false;
  const flow = params.get('flow'); const code = params.get('code'); const failed = params.has('error');
  history.replaceState(null, '', '/auth.html?mode=login');
  const panel = document.querySelector('#oauth-completion'); panel.hidden = false;
  document.querySelector('#auth-fields').hidden = true;
  const message = document.querySelector('#oauth-message');
  const password = document.querySelector('#oauth-password');
  const link = document.querySelector('#oauth-connect');
  const remove = document.querySelector('#oauth-delete');
  let pending;
  try { pending = JSON.parse(sessionStorage.getItem(key(flow))); } catch {}
  if (failed || !/^[a-f0-9]{32}$/.test(flow || '') || !/^[A-Za-z0-9_-]{43}$/.test(code || '') || !pending || pending.expires < Date.now() || !/^[A-Za-z0-9_-]{43}$/.test(pending.verifier || '')) {
    sessionStorage.removeItem(key(flow)); setMessage(message, 'Sign-in was canceled or expired. Please start again.'); return true;
  }
  let busy = false;
  const exchange = async () => {
    if (busy) return; busy = true; link.disabled = true;
    setMessage(message, 'Finishing your sign-in…', false);
    try {
      const result = await api('/auth/oauth/exchange', {method:'POST',body:{flow,code,verifier:pending.verifier,...(password.value?{password:password.value}:{})}});
      password.value = ''; sessionStorage.removeItem(key(flow));
      document.querySelector('#oauth-link-fields').hidden = true;
      if (pending.intent === 'delete' && result.reauthToken) {
        setMessage(message, 'Identity verified. Permanently delete your account, cloud collection, and connections? This cannot be undone.', false);
        remove.hidden = false;
        remove.onclick = async () => {
          if (busy) return; busy = true; remove.disabled = true;
          try { await api('/account', {method:'DELETE',body:{reauthToken:result.reauthToken}}); location.replace('/auth.html?mode=signup&deleted=1'); }
          catch(error) { setMessage(message,error.message); } finally { busy=false;remove.disabled=false; }
        };
      } else if (result.account) location.replace('/dashboard.html');
      else throw new Error('Sign-in could not be completed. Start again.');
    } catch (error) {
      setMessage(message, error.message);
      if (error.code === 'account_link_required' || error.code === 'invalid_credentials') {
        document.querySelector('#oauth-link-fields').hidden = false; password.focus();
      } else sessionStorage.removeItem(key(flow));
    } finally { busy = false; link.disabled = false; }
  };
  link.onclick = exchange;
  password.addEventListener('keydown', event => { if(event.key==='Enter'){event.preventDefault();void exchange();} });
  void exchange(); return true;
}
