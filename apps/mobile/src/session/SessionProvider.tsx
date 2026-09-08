import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createFoundkeepClient, FoundkeepApiError } from '../api/client.ts';
import type { Account, NativeSession, Usage } from '../api/types.ts';

const TOKEN_KEY = 'foundkeep-device-token';
const secureOptions: SecureStore.SecureStoreOptions = { keychainService: 'app.foundkeep.shared', keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
type Credentials = { email: string; password: string };
type SessionValue = {
  ready: boolean; account: Account | null; usage: Usage | null; token: string | null; recoveryCode: string | null;
  client: ReturnType<typeof createFoundkeepClient>;
  register(value: Credentials & { name: string }): Promise<void>;
  login(value: Credentials): Promise<void>;
  recover(value: Credentials & { recoveryCode: string }): Promise<void>;
  acknowledgeRecovery(): void;
  refresh(): Promise<void>;
  logout(): Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const getToken = useCallback(async () => token ?? SecureStore.getItemAsync(TOKEN_KEY, secureOptions), [token]);
  const client = useMemo(() => createFoundkeepClient({ getToken }), [getToken]);

  const accept = useCallback(async (session: NativeSession) => {
    await SecureStore.setItemAsync(TOKEN_KEY, session.token, secureOptions);
    setToken(session.token); setAccount(session.account); setRecoveryCode(session.recoveryCode || null);
  }, []);
  const refresh = useCallback(async () => {
    try { const me = await client.me(); setAccount(me.account); setUsage(me.usage); }
    catch (error) {
      if (error instanceof FoundkeepApiError && error.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY, secureOptions); setToken(null); setAccount(null); setUsage(null);
      } else throw error;
    }
  }, [client]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY, secureOptions);
      if (!live) return;
      setToken(stored);
      if (stored) { try { await refresh(); } catch {} }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, [refresh]);

  const deviceName = Device.deviceName || Device.modelName || 'iPhone';
  const value = useMemo<SessionValue>(() => ({
    ready, account, usage, token, recoveryCode, client,
    register: async input => accept(await client.register({ ...input, deviceName })),
    login: async input => accept(await client.login({ ...input, deviceName })),
    recover: async input => accept(await client.recover({ ...input, deviceName })),
    acknowledgeRecovery: () => setRecoveryCode(null), refresh,
    logout: async () => {
      try { if (token) await client.logout(); } finally {
        await SecureStore.deleteItemAsync(TOKEN_KEY, secureOptions); setToken(null); setAccount(null); setUsage(null); setRecoveryCode(null);
      }
    },
  }), [ready, account, usage, token, recoveryCode, client, deviceName, accept, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
