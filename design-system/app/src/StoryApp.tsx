// A sample session for stories: a signed-in account whose API client answers
// from the sample world instead of the network.
import type { ReactNode } from 'react';
import { createFoundkeepClient } from '../../../apps/mobile/src/api/client.ts';
import type { Account } from '../../../apps/mobile/src/api/types.ts';
import { DEFAULT_MOBILE_POLICY } from '../../../apps/mobile/src/policy/mobilePolicy.ts';
import { SessionContext, type SessionValue } from '../../../apps/mobile/src/session/SessionProvider.tsx';

export const storyAccount: Account = { id: 'acc-story', email: 'lena@foundkeep.example', name: 'Lena Kovacs', createdAt: Date.parse('2026-06-01T09:00:00Z'), hasPassword: true };
const notFound = async () => Response.json({ error: 'not_found' }, { status: 404 });

export function storySession(fetcher: typeof fetch = notFound, overrides: Partial<SessionValue> = {}): SessionValue {
  const idle = async () => {};
  return {
    ready: true, account: storyAccount, usage: { captures: 128, bytes: 412_000_000, maxCaptures: 1000, maxBytes: 1_000_000_000 },
    token: 'story', recoveryCode: null, policy: DEFAULT_MOBILE_POLICY, updateRequired: false, pendingRoute: null,
    setPendingRoute() {}, consumePendingRoute: () => null,
    client: createFoundkeepClient({ getToken: async () => 'story', fetcher }),
    register: idle, login: idle, recover: idle, acceptOAuthSession: idle, acknowledgeRecovery() {}, refresh: idle, logout: idle, deleteAccount: idle,
    ...overrides,
  };
}

export function StorySession({ children, value = storySession() }: { children: ReactNode; value?: SessionValue }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
