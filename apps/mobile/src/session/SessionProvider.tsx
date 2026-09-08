import * as Device from 'expo-device';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import FoundkeepShared from '../../modules/foundkeep-shared/src';
import { createFoundkeepClient, FoundkeepApiError } from '../api/client.ts';
import type { Account, NativeSession, Usage } from '../api/types.ts';
import { DEFAULT_MOBILE_POLICY, fetchMobilePolicy, normalizeMobilePolicy, requiresBinaryUpdate, type MobilePolicy } from '../policy/mobilePolicy.ts';

type Credentials = { email: string; password: string };
type SessionValue = {
  ready: boolean; account: Account | null; usage: Usage | null; token: string | null; recoveryCode: string | null;
  policy: MobilePolicy; updateRequired: boolean;
  client: ReturnType<typeof createFoundkeepClient>;
  register(value: Credentials & { name: string }): Promise<void>;
  login(value: Credentials): Promise<void>;
  recover(value: Credentials & { recoveryCode: string }): Promise<void>;
  acknowledgeRecovery(): void;
  refresh(): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(password: string): Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [policy, setPolicy] = useState<MobilePolicy>(DEFAULT_MOBILE_POLICY);
  const getToken = useCallback(async () => token ?? FoundkeepShared.getToken(), [token]);
  const client = useMemo(() => createFoundkeepClient({ getToken }), [getToken]);

  const accept = useCallback(async (session: NativeSession) => {
    await FoundkeepShared.setSession(session.token, JSON.stringify(session.account));
    setToken(session.token); setAccount(session.account); setRecoveryCode(session.recoveryCode || null);
    void FoundkeepShared.retryPending();
  }, []);
  const refresh = useCallback(async () => {
    try { const me = await client.me(); setAccount(me.account); setUsage(me.usage); }
    catch (error) {
      if (error instanceof FoundkeepApiError && error.status === 401) {
        await FoundkeepShared.clearSession(); setToken(null); setAccount(null); setUsage(null);
      } else throw error;
    }
  }, [client]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const stored = await FoundkeepShared.getToken();
      if (!live) return;
      setToken(stored);
      if (stored) { try { await refresh(); } catch {} }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, [refresh]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const cachedRaw = await FoundkeepShared.getPolicy();
      let cached: MobilePolicy | null = null;
      try { cached = cachedRaw ? normalizeMobilePolicy(JSON.parse(cachedRaw)) : null; } catch {}
      if (cached && live) setPolicy(cached);
      const remote = await fetchMobilePolicy();
      if (remote && (!cached || remote.revision >= cached.revision)) {
        await FoundkeepShared.setPolicy(JSON.stringify(remote));
        if (live) setPolicy(remote);
      }
    })().catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
    if (state === 'active' && token) {
      void FoundkeepShared.retryPending().then(() => refresh()).catch(() => {});
    }
    });
    return () => subscription.remove();
  }, [refresh, token]);

  const deviceName = Device.deviceName || Device.modelName || 'iPhone';
  const value = useMemo<SessionValue>(() => ({
    ready, account, usage, token, recoveryCode, policy, updateRequired: requiresBinaryUpdate('1.0.0', policy.minimumVersion), client,
    register: async input => accept(await client.register({ ...input, deviceName })),
    login: async input => accept(await client.login({ ...input, deviceName })),
    recover: async input => accept(await client.recover({ ...input, deviceName })),
    acknowledgeRecovery: () => setRecoveryCode(null), refresh,
    logout: async () => {
      try { if (token) await client.logout(); } finally {
        await FoundkeepShared.clearSession(); setToken(null); setAccount(null); setUsage(null); setRecoveryCode(null);
      }
    },
    deleteAccount: async password => {
      await client.deleteAccount(password);
      await FoundkeepShared.clearSession(); setToken(null); setAccount(null); setUsage(null); setRecoveryCode(null);
    },
  }), [ready, account, usage, token, recoveryCode, policy, client, deviceName, accept, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
