import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Capture } from '../api/types.ts';
import { useSession } from '../session/SessionProvider.tsx';

export function useCollection(filters: { q?: string; type?: string; batchId?: string; folderId?: string; tag?: string }) {
  const { client, refresh: refreshAccount } = useSession();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const cursor = useRef<string | null>(null);
  const sequence = useRef(0);
  const focused = useRef(false);
  const busy = useRef(false);
  const expanded = useRef(false);
  const processing = useRef(false);
  const failures = useRef(0);
  const nextPoll = useRef(0);
  const requestKey = JSON.stringify([filters.q || '', filters.type || '', filters.batchId || '', filters.folderId || '', filters.tag || '']);
  const latestKey = useRef(requestKey); latestKey.current = requestKey;
  const displayedKey = useRef<string | null>(null);
  const query = useMemo(() => ({ q: filters.q, type: filters.type, batchId: filters.batchId, folderId: filters.folderId, tag: filters.tag }), [filters.q, filters.type, filters.batchId, filters.folderId, filters.tag]);
  processing.current = captures.some(capture => capture.status === 'pending' || capture.status === 'processing');

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'more' | 'background' = 'initial') => {
    if ((mode === 'more' || mode === 'background') && busy.current) return;
    if (mode === 'more' && !cursor.current) return;
    const current = ++sequence.current;
    const key = requestKey;
    busy.current = true;
    setLoadingMore(mode === 'more');
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'initial') setLoading(true);
    setError('');
    try {
      const result = await client.listCaptures({ ...query, cursor: mode === 'more' ? cursor.current || undefined : undefined }, { reload: mode === 'refresh' || mode === 'background' });
      if (!focused.current || current !== sequence.current || key !== latestKey.current) return;
      setCaptures(previous => {
        if (mode !== 'more') return result.captures;
        const ids = new Set(previous.map(capture => capture.id));
        return [...previous, ...result.captures.filter(capture => !ids.has(capture.id))];
      });
      cursor.current = result.nextCursor;
      expanded.current = mode === 'more';
      failures.current = 0; nextPoll.current = Date.now() + 5_000;
      setTotal(result.total);
      if (mode === 'refresh') void refreshAccount().catch(() => {});
    } catch (value) {
      if (focused.current && current === sequence.current && key === latestKey.current) {
        setError((value as Error).message);
        failures.current++;
        nextPoll.current = Date.now() + Math.min(60_000, 5_000 * 2 ** failures.current);
      }
    } finally {
      if (current === sequence.current) {
        busy.current = false; setLoading(false); setRefreshing(false); setLoadingMore(false);
      }
    }
  }, [client, query, refreshAccount, requestKey]);

  useFocusEffect(useCallback(() => {
    focused.current = true; cursor.current = null; expanded.current = false;
    if (displayedKey.current !== requestKey) { setCaptures([]); setTotal(0); displayedKey.current = requestKey; }
    void load();
    const unsubscribe = client.subscribeInvalidation(() => void load());
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void load('background'); });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && processing.current && !expanded.current && Date.now() >= nextPoll.current) void load('background');
    }, 5_000);
    return () => { focused.current = false; sequence.current++; busy.current = false; unsubscribe(); foreground.remove(); clearInterval(timer); };
  }, [client, load, requestKey]));
  return { captures, loading, refreshing, loadingMore, total, error, refresh: () => load('refresh'), loadMore: () => load('more') };
}
