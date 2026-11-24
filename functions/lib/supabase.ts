import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CheckResult, Env } from '../types';

export interface SummaryDbPayload {
  states: Array<{
    monitor_slug: string;
    status: 'up' | 'degraded' | 'down';
    consecutive_fail: number;
    consecutive_ok: number;
    last_checked_at: string | null;
    last_http_status: number | null;
    last_response_ms: number | null;
    last_error: string | null;
    last_colo: string | null;
    open_incident_id: number | null;
  }>;
  u24: Array<{
    monitor_slug: string;
    total_24h: number;
    ok_24h: number;
    avg_ms_24h: number | null;
  }>;
  bars: Array<{
    monitor_slug: string;
    bars_90d: Array<{
      day: string;
      total: number;
      up: number;
      degraded: number;
      waf?: number;
      down: number;
      avgMs: number;
    }>;
  }>;
  hourly?: Array<{
    monitor_slug: string;
    hourly_24h: Array<{
      hour: string;
      total: number;
      up: number;
      degraded: number;
      waf?: number;
      down: number;
      avgMs: number;
    }>;
  }>;
  openIncidents: number;
}

export function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function recordChecks(
  env: Env,
  results: CheckResult[]
): Promise<void> {
  if (results.length === 0) return;
  const supabase = getSupabase(env);
  const { error } = await supabase.rpc('bgovph_record_checks', {
    p_results: results,
  });
  if (error) {
    throw new Error(`bgovph_record_checks failed: ${error.message}`);
  }
}

export async function pruneOldChecks(env: Env, days = 30): Promise<number> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase.rpc('bgovph_prune_checks', {
    p_days: days,
  });
  if (error) {
    throw new Error(`bgovph_prune_checks failed: ${error.message}`);
  }
  return Number(data ?? 0);
}

export interface DashboardDbPayload {
  days: number;
  monitors: Array<{
    monitor_slug: string;
    total: number;
    up: number;
    degraded: number;
    waf: number;
    down: number;
    sum_ms: number;
    max_ms: number;
  }>;
  daily: Array<{
    day: string;
    total: number;
    up: number;
    degraded: number;
    waf: number;
    down: number;
    avg_ms: number;
  }>;
  incidents: {
    totalIncidents: number;
    openIncidents: number;
    avgResolutionSec: number | null;
    byMonitor: Array<{ monitor_slug: string; count: number }>;
    topCauses: Array<{ cause: string; count: number }>;
  };
}

export async function pruneOldDailyStats(
  env: Env,
  days = 365
): Promise<number> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase.rpc('bgovph_prune_daily_stats', {
    p_days: days,
  });
  if (error) {
    throw new Error(`bgovph_prune_daily_stats failed: ${error.message}`);
  }
  return Number(data ?? 0);
}

export async function fetchDashboardFromDb(
  env: Env,
  days: number
): Promise<DashboardDbPayload> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase.rpc('bgovph_get_dashboard', {
    p_days: days,
  });
  if (error) {
    throw new Error(`bgovph_get_dashboard failed: ${error.message}`);
  }
  return (data ?? {
    days,
    monitors: [],
    daily: [],
    incidents: {
      totalIncidents: 0,
      openIncidents: 0,
      avgResolutionSec: null,
      byMonitor: [],
      topCauses: [],
    },
  }) as DashboardDbPayload;
}

export async function fetchSummaryFromDb(env: Env): Promise<SummaryDbPayload> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase.rpc('bgovph_get_summary');
  if (error) {
    throw new Error(`bgovph_get_summary failed: ${error.message}`);
  }
  return (data ?? {
    states: [],
    u24: [],
    bars: [],
    openIncidents: 0,
  }) as SummaryDbPayload;
}

export async function fetchMonitorIncidents(
  env: Env,
  slug: string,
  limit = 20
) {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('bgovph_incidents')
    .select('id, monitor_slug, started_at, resolved_at, cause')
    .eq('monitor_slug', slug)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAllIncidents(
  env: Env,
  status: 'open' | 'all',
  page = 1,
  pageSize = 25
) {
  const supabase = getSupabase(env);
  const from = (Math.max(1, page) - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('bgovph_incidents')
    .select('id, monitor_slug, started_at, resolved_at, cause', {
      count: 'exact',
    })
    .order('started_at', { ascending: false })
    .range(from, to);

  if (status === 'open') {
    query = query.is('resolved_at', null);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { items: data ?? [], total: count ?? 0 };
}

export async function fetchMonitorHistory(
  env: Env,
  slug: string,
  range: '24h' | '7d' | '30d' | '90d'
) {
  const supabase = getSupabase(env);
  const now = Date.now();

  if (range === '90d') {
    const since = new Date(now - 90 * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('bgovph_daily_stats')
      .select('day, total, up, degraded, down, sum_ms')
      .eq('monitor_slug', slug)
      .gte('day', since)
      .order('day', { ascending: true });
    if (error) throw new Error(error.message);
    return {
      points: [],
      daily: (data ?? []).map(d => ({
        day: d.day,
        total: d.total,
        up: d.up,
        degraded: d.degraded,
        down: d.down,
        avgMs: d.total > 0 ? Math.round(Number(d.sum_ms) / d.total) : 0,
      })),
    };
  }

  const hours = range === '24h' ? 24 : range === '7d' ? 168 : 720;
  const sinceIso = new Date(now - hours * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from('bgovph_checks')
    .select('checked_at, status, http_status, response_ms, error, colo')
    .eq('monitor_slug', slug)
    .gte('checked_at', sinceIso)
    .order('checked_at', { ascending: true })
    .limit(1000);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  // Downsample to at most 200 points for chart readability.
  const step = Math.max(1, Math.ceil(rows.length / 200));
  const points = rows.filter((_, i) => i % step === 0 || i === rows.length - 1);

  return { points, daily: [] };
}
