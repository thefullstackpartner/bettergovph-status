import type { Env, FreshnessSignalSource, FreshnessStatus } from '../types';
import { computeFreshnessStatus, getFreshnessStaleDays } from './freshness';
import { categories, enabledMonitors } from './monitors';
import { fetchSummaryFromDb } from './supabase';

export interface MonitorFreshnessSummary {
  enabled: boolean;
  status: FreshnessStatus;
  signalSource: FreshnessSignalSource | null;
  contentUpdatedAt: string | null;
  lastChangedAt: string | null;
  lastCheckedAt: string | null;
  changeCount30d: number;
  changeCount90d: number;
  probeError: string | null;
}

export interface SummarySnapshot {
  generatedAt: string;
  freshnessStaleDays: number;
  counts: {
    total: number;
    up: number;
    degraded: number;
    down: number;
    unknown: number;
    openIncidents: number;
    freshnessMonitored: number;
    fresh: number;
    stale: number;
  };
  categories: typeof categories;
  monitors: Array<{
    slug: string;
    name: string;
    agency: string;
    department: string | null;
    category: string;
    url: string;
    tier: 'critical' | 'standard';
    source: 'curated' | 'bettergov-websites';
    status: 'up' | 'degraded' | 'down' | 'unknown';
    lastCheckedAt: string | null;
    lastHttpStatus: number | null;
    lastResponseMs: number | null;
    lastError: string | null;
    lastColo: string | null;
    uptime24h: number | null;
    avgMs24h: number | null;
    freshness: MonitorFreshnessSummary;
    bars90d: Array<{
      day: string;
      total: number;
      up: number;
      degraded: number;
      waf?: number;
      down: number;
      avgMs: number;
    }>;
    hourly24h: Array<{
      hour: string;
      total: number;
      up: number;
      degraded: number;
      waf?: number;
      down: number;
      avgMs: number;
    }>;
  }>;
}

export async function buildSummarySnapshot(env: Env): Promise<SummarySnapshot> {
  const dbData = await fetchSummaryFromDb(env);
  const staleAfterDays = getFreshnessStaleDays(env);
  const now = new Date();

  const stateBySlug = new Map(dbData.states.map(s => [s.monitor_slug, s]));
  const u24BySlug = new Map(dbData.u24.map(u => [u.monitor_slug, u]));
  const barsBySlug = new Map(dbData.bars.map(b => [b.monitor_slug, b.bars_90d]));
  const hourlyBySlug = new Map(
    (dbData.hourly ?? []).map(h => [h.monitor_slug, h.hourly_24h])
  );
  const freshnessBySlug = new Map(
    (dbData.freshness ?? []).map(f => [f.monitor_slug, f])
  );

  let up = 0;
  let degraded = 0;
  let down = 0;
  let unknown = 0;
  let freshnessMonitored = 0;
  let fresh = 0;
  let stale = 0;

  const monitors = enabledMonitors.map(m => {
    const st = stateBySlug.get(m.slug);
    const u24 = u24BySlug.get(m.slug);
    const bars = barsBySlug.get(m.slug) ?? [];
    const hourly = hourlyBySlug.get(m.slug) ?? [];
    const fr = freshnessBySlug.get(m.slug);
    const status: 'up' | 'degraded' | 'down' | 'unknown' =
      st?.status ?? 'unknown';

    if (status === 'up') up++;
    else if (status === 'degraded') degraded++;
    else if (status === 'down') down++;
    else unknown++;

    const freshnessEnabled = Boolean(m.freshnessEnabled);
    const referenceDate = fr?.content_updated_at ?? fr?.last_changed_at ?? null;
    const freshnessStatus: FreshnessStatus = freshnessEnabled
      ? computeFreshnessStatus(referenceDate, staleAfterDays, now)
      : 'unknown';

    if (freshnessEnabled) {
      freshnessMonitored++;
      if (freshnessStatus === 'fresh') fresh++;
      else if (freshnessStatus === 'stale') stale++;
    }

    const uptime24h =
      u24 && u24.total_24h > 0
        ? Math.round((u24.ok_24h / u24.total_24h) * 10000) / 100
        : null;

    return {
      slug: m.slug,
      name: m.name,
      agency: m.agency,
      department: m.department ?? null,
      category: m.category,
      url: m.url,
      tier: m.tier,
      source: m.source ?? 'curated',
      status,
      lastCheckedAt: st?.last_checked_at ?? null,
      lastHttpStatus: st?.last_http_status ?? null,
      lastResponseMs: st?.last_response_ms ?? null,
      lastError: st?.last_error ?? null,
      lastColo: st?.last_colo ?? null,
      uptime24h,
      avgMs24h: u24?.avg_ms_24h ?? null,
      freshness: {
        enabled: freshnessEnabled,
        status: freshnessStatus,
        signalSource: (fr?.signal_source as FreshnessSignalSource | null) ?? null,
        contentUpdatedAt: fr?.content_updated_at ?? null,
        lastChangedAt: fr?.last_changed_at ?? null,
        lastCheckedAt: fr?.last_checked_at ?? null,
        changeCount30d: fr?.change_count_30d ?? 0,
        changeCount90d: fr?.change_count_90d ?? 0,
        probeError: fr?.probe_error ?? null,
      },
      bars90d: bars,
      hourly24h: hourly,
    };
  });

  return {
    generatedAt: now.toISOString(),
    freshnessStaleDays: staleAfterDays,
    counts: {
      total: monitors.length,
      up,
      degraded,
      down,
      unknown,
      openIncidents: dbData.openIncidents,
      freshnessMonitored,
      fresh,
      stale,
    },
    categories,
    monitors,
  };
}

export async function getSummarySnapshot(env: Env): Promise<SummarySnapshot> {
  return buildSummarySnapshot(env);
}
