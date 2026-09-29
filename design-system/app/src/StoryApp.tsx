// A sample session for stories: the sample world's signed-in account. Its API
// client makes real requests, which the mock service worker answers.
import type { ReactNode } from 'react';
import { createFoundkeepClient } from '../../../apps/mobile/src/api/client.ts';
import * as world from '../../fixtures/world.ts';
import { DEFAULT_MOBILE_POLICY } from '../../../apps/mobile/src/policy/mobilePolicy.ts';
import { SessionContext, type SessionValue } from '../../../apps/mobile/src/session/SessionProvider.tsx';


// Requests go to the real fetch; the mock service worker answers them.
export function storySession(overrides: Partial<SessionValue> = {}): SessionValue {
  const idle = async () => {};
  return {
    ready: true, account: world.account, usage: world.usage,
    token: 'story', recoveryCode: null, policy: DEFAULT_MOBILE_POLICY, updateRequired: false, pendingRoute: null,
    setPendingRoute() {}, consumePendingRoute: () => null,
    client: createFoundkeepClient({ getToken: async () => 'story' }),
    register: idle, login: idle, recover: idle, acceptOAuthSession: idle, acknowledgeRecovery() {}, refresh: idle, logout: idle, deleteAccount: idle,
    ...overrides,
  };
}

export function StorySession({ children, value = storySession() }: { children: ReactNode; value?: SessionValue }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
