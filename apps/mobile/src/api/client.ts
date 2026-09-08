import type { Account, Capture, CaptureList, NativeSession, Usage } from './types.ts';

const API_ORIGIN = 'https://foundkeep.app';
const REQUEST_TIMEOUT = 15_000;

export class FoundkeepApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message.slice(0, 300));
    this.status = status;
    this.code = code;
  }
}

type ClientOptions = { getToken: () => Promise<string | null>; fetcher?: typeof fetch };
type JsonOptions = { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; authenticated?: boolean };

export function createFoundkeepClient({ getToken, fetcher = fetch }: ClientOptions) {
  async function json<T>(path: string, options: JsonOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const headers = new Headers({ accept: 'application/json' });
      if (options.body !== undefined) headers.set('content-type', 'application/json');
      if (options.authenticated !== false) {
        const token = await getToken();
        if (!token) throw new FoundkeepApiError(401, 'signed_out', 'Sign in to open your Foundkeep collection.');
        headers.set('authorization', `Bearer ${token}`);
      }
      const response = await fetcher(`${API_ORIGIN}${path}`, {
        method: options.method || 'GET', headers, signal: controller.signal,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const raw = (await response.text()).slice(0, 64 * 1024);
      let value: any = null;
      try { value = raw ? JSON.parse(raw) : null; } catch {}
      if (!response.ok) throw new FoundkeepApiError(response.status, String(value?.error || 'request_failed').slice(0, 80), String(value?.message || 'Foundkeep could not complete the request.'));
      return value as T;
    } catch (error) {
      if (error instanceof FoundkeepApiError) throw error;
      if ((error as Error)?.name === 'AbortError') throw new FoundkeepApiError(0, 'timeout', 'Foundkeep took too long to respond. Try again.');
      throw new FoundkeepApiError(0, 'offline', 'Foundkeep could not connect. Check your internet connection and try again.');
    } finally { clearTimeout(timer); }
  }

  const devicePayload = <T extends { deviceName?: string }>(value: T) => ({ ...value, deviceName: value.deviceName?.trim() || 'iPhone' });
  return {
    register(value: { email: string; name: string; password: string; deviceName?: string }) {
      return json<NativeSession>('/api/mobile/register', { method: 'POST', body: devicePayload(value), authenticated: false });
    },
    login(value: { email: string; password: string; deviceName?: string }) {
      return json<NativeSession>('/api/mobile/login', { method: 'POST', body: devicePayload(value), authenticated: false });
    },
    recover(value: { email: string; recoveryCode: string; password: string; deviceName?: string }) {
      return json<NativeSession>('/api/mobile/recover', { method: 'POST', body: devicePayload(value), authenticated: false });
    },
    me: () => json<{ account: Account; connectionId: string; usage: Usage }>('/api/mobile/me'),
    notificationStatus: () => json<{ enabled: boolean }>('/api/mobile/notifications'),
    registerNotifications: (expoPushToken: string) => json<{ ok: true }>('/api/mobile/notifications', { method: 'POST', body: { expoPushToken } }),
    unregisterNotifications: () => json<{ ok: true }>('/api/mobile/notifications', { method: 'DELETE' }),
    logout: () => json<{ ok: true }>('/api/mobile/logout', { method: 'POST' }),
    deleteAccount: (password: string) => json<{ ok: true }>('/api/mobile/account', { method: 'DELETE', body: { password } }),
    listCaptures(filters: { q?: string; type?: string; cursor?: string }) {
      const query = new URLSearchParams();
      if (filters.q) query.set('q', filters.q);
      if (filters.type) query.set('type', filters.type);
      if (filters.cursor) query.set('cursor', filters.cursor);
      return json<CaptureList>(`/api/mobile/captures${query.size ? `?${query}` : ''}`);
    },
    createNote(value: { clientId: string; noteText: string; capturedAt: number }) {
      return json<{ capture: Capture; duplicate: boolean }>('/api/captures', { method: 'POST', body: { ...value, type: 'note' } });
    },
    getCapture: (id: string) => json<{ capture: Capture }>(`/api/mobile/captures/${encodeURIComponent(id)}`),
    deleteCapture: (id: string) => json<{ ok: true }>(`/api/mobile/captures/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    fileUrl: (id: string) => `${API_ORIGIN}/api/mobile/captures/${encodeURIComponent(id)}/file`,
  };
}

export type FoundkeepClient = ReturnType<typeof createFoundkeepClient>;
