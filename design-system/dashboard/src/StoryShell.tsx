// The signed-in dashboard around a page: the real DashboardShell (sidebar,
// query cache, dialogs) for the sample world's account.
import type { ReactNode } from 'react';
import DashboardShell from '../../../apps/site/components/dashboard/shell';
import { AccountBoundary } from '../../../apps/site/components/dashboard/account-boundary';
import { me } from './handlers.ts';

export function InShell({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <DashboardShell me={me as any}>{children}</DashboardShell>;
}
export function AccountSection({ children }: { children: ReactNode }) {
  return <InShell><AccountBoundary accountId={me.account.id}><div className="account-page">{children}</div></AccountBoundary></InShell>;
}
