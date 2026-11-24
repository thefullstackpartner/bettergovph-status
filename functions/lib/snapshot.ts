import type { Env } from '../types';
import { categories, enabledMonitors } from './monitors';
import { fetchSummaryFromDb } from './supabase';

export const SUMMARY_KV_KEY = 'status:summary';

export interface SummarySnapshot {
  generatedAt: string;
  counts: {
    total: number;
    up: number;
    degraded: number;
    down: number;
    unknown: number;
    openIncidents: number;
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
    bars90d: Array<{
      day: string;
      total: number;
      up: number;
      degraded: number;
      down: number;
      avgMs: number;
    }>;
    hourly24h: Array<{
      hour: string;
      total: number;
      up: number;
      degraded: number;
      down: number;
      avgMs: number;
    }>;
  }>;
}

export async function buildSummarySnapshot(env: Env): Promise<SummarySnapshot> {
  const dbData = await fetchSummaryFromDb(env);

  const stateBySlug = new Map(dbData.states.map(s => [s.monitor_slug, s]));
  const u24BySlug = new Map(dbData.u24.map(u => [u.monitor_slug, u]));
  const barsBySlug = new Map(dbData.bars.map(b => [b.monitor_slug, b.bars_90d]));
  const hourlyBySlug = new Map(
    (dbData.hourly ?? []).map(h => [h.monitor_slug, h.hourly_24h])
  );

  let up = 0;
  let degraded = 0;
  let down = 0;
  let unknown = 0;

  const monitors = enabledMonitors.map(m => {
    const st = stateBySlug.get(m.slug);
    const u24 = u24BySlug.get(m.slug);
    const bars = barsBySlug.get(m.slug) ?? [];
    const hourly = hourlyBySlug.get(m.slug) ?? [];
    const status: 'up' | 'degraded' | 'down' | 'unknown' =
      st?.status ?? 'unknown';

    if (status === 'up') up++;
    else if (status === 'degraded') degraded++;
    else if (status === 'down') down++;
    else unknown++;

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
      bars90d: bars,
      hourly24h: hourly,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      total: monitors.length,
      up,
      degraded,
      down,
      unknown,
      openIncidents: dbData.openIncidents,
    },
    categories,
    monitors,
  };
}

export async function refreshSummarySnapshot(
  env: Env
): Promise<SummarySnapshot> {
  const snapshot = await buildSummarySnapshot(env);
  if (env.STATUS_KV) {
    await env.STATUS_KV.put(SUMMARY_KV_KEY, JSON.stringify(snapshot), {
      expirationTtl: 600,
    });
  }
  return snapshot;
}

export async function getSummarySnapshot(env: Env): Promise<SummarySnapshot> {
  if (env.STATUS_KV) {
    const cached = await env.STATUS_KV.get<SummarySnapshot>(
      SUMMARY_KV_KEY,
      'json'
    );
    if (cached) return cached;
  }
  return refreshSummarySnapshot(env);
}
