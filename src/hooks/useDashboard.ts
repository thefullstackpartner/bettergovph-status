import { useEffect, useState } from 'react';
import { getDashboard } from '../lib/api';
import type {
  DashboardRange,
  DashboardResponse,
  DashboardTierFilter,
} from '../types';

export interface UseDashboardResult {
  data: DashboardResponse | null;
  loading: boolean;
  error: string | null;
}

export function useDashboard(
  range: DashboardRange,
  tier: DashboardTierFilter
): UseDashboardResult {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDashboard(range, tier)
      .then(res => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load dashboard'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, tier]);

  return { data, loading, error };
}
