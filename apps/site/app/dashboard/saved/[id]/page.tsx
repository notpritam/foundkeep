import { notFound, redirect } from 'next/navigation';
import { ApiError } from '../../../../lib/api';
import { getSession, serverApi } from '../../../../lib/server';
import { parseDashboardState, type Capture } from '../../../../lib/dashboard';
import Dashboard from '../../../../components/dashboard/dashboard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saved capture', robots: { index: false, follow: false } };
export default async function SavedCapturePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await getSession();
  if (!me) redirect('/login');
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) notFound();
  const state = { ...parseDashboardState(await searchParams), item: id };
  let capture: Capture | undefined;
  let error = '';
  try { capture = (await serverApi<{ capture: Capture }>(`/captures/${encodeURIComponent(id)}`, me.account.id)).capture; }
  catch (cause) {
    if (cause instanceof ApiError && (cause.status === 401 || cause.code === 'account_changed')) redirect('/login');
    error = cause instanceof Error ? cause.message : 'This capture could not load. Please try again.';
  }
  return <Dashboard key={me.account.id} me={me} initialState={state} readingPage initialCapture={capture} captureError={error} />;
}
