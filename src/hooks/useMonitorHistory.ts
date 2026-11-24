import { useEffect, useState } from 'react';
import { getMonitorHistory } from '../lib/api';
import type { MonitorHistoryResponse } from '../types';

export function useMonitorHistory(
  slug: string | undefined,
  range: '24h' | '7d' | '30d' | '90d'
) {
  const [data, setData] = useState<MonitorHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    getMonitorHistory(slug, range)
      .then(res => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load history'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, range]);

  return { data, loading, error };
}
