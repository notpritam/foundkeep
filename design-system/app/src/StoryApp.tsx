// Sample sessions for stories. The API client makes real requests, which the
// mock service worker answers from the sample world. Each session is built
// once: a new client on every render would make screens refetch forever.
import type { ReactNode } from 'react';
import { createFoundkeepClient } from '../../../apps/mobile/src/api/client.ts';
import * as world from '../../fixtures/world.ts';
import { DEFAULT_MOBILE_POLICY } from '../../../apps/mobile/src/policy/mobilePolicy.ts';
import { SessionContext, type SessionValue } from '../../../apps/mobile/src/session/SessionProvider.tsx';

export type SessionMode = 'signed-in' | 'signed-out' | 'just-registered';

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
const sessions: Partial<Record<SessionMode, SessionValue>> = {};
export function sessionFor(mode: SessionMode = 'signed-in'): SessionValue {
  return sessions[mode] ??= mode === 'signed-out' ? storySession({ account: null, token: null, usage: null })
    : mode === 'just-registered' ? storySession({ recoveryCode: 'FK7Q-2M9D-XR4T-8NWB-J3PA' }) : storySession();
}

export function StorySession({ children, mode }: { children: ReactNode; mode?: SessionMode }) {
  return <SessionContext.Provider value={sessionFor(mode)}>{children}</SessionContext.Provider>;
}
