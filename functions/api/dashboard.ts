import type { Context } from 'hono';
import type { Env } from '../types';
import { categories, enabledMonitors } from '../lib/monitors';
import {
  fetchDashboardFromDb,
  type DashboardDbPayload,
} from '../lib/supabase';

export type DashboardRange = '7d' | '30d' | '90d' | '1y';
export type DashboardTierFilter = 'all' | 'critical' | 'standard';

const RANGE_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const CACHE_CONTROL_HEADER =
  'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseDashboardRange(raw: string | undefined): DashboardRange {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === '1y') {
    return raw;
  }
  return '30d';
}

export function parseDashboardTier(
  raw: string | undefined
): DashboardTierFilter {
  if (raw === 'critical' || raw === 'standard') return raw;
  return 'all';
}

export function buildDashboardPayload(
  dbData: DashboardDbPayload,
  range: DashboardRange,
  tier: DashboardTierFilter
) {
  const categoryMap = new Map(categories.map(c => [c.slug, c]));
  const dbMonitorMap = new Map(
    dbData.monitors.map(m => [m.monitor_slug, m])
  );
  const incidentByMonitorMap = new Map(
    (dbData.incidents?.byMonitor ?? []).map(i => [i.monitor_slug, i.count])
  );

  const scopedMonitors = enabledMonitors.filter(
    m => tier === 'all' || m.tier === tier
  );

  let networkTotalChecks = 0;
  let networkUp = 0;
  let networkWaf = 0;
  let networkDegraded = 0;
  let networkDown = 0;
  let networkSumMs = 0;
  let networkMaxMs = 0;

  const monitorRows = scopedMonitors.map(m => {
    const agg = dbMonitorMap.get(m.slug);
    const total = Number(agg?.total ?? 0);
    const up = Number(agg?.up ?? 0);
    const degraded = Number(agg?.degraded ?? 0);
    const waf = Number(agg?.waf ?? 0);
    const down = Number(agg?.down ?? 0);
    const sumMs = Number(agg?.sum_ms ?? 0);
    const maxMs = Number(agg?.max_ms ?? 0);
    const incidentCount = Number(incidentByMonitorMap.get(m.slug) ?? 0);

    networkTotalChecks += total;
    networkUp += up;
    networkWaf += waf;
    networkDegraded += degraded;
    networkDown += down;
    networkSumMs += sumMs;
    networkMaxMs = Math.max(networkMaxMs, maxMs);

    const denom = total || 1;
    return {
      slug: m.slug,
      name: m.name,
      agency: m.agency,
      category: m.category,
      categoryName: categoryMap.get(m.category)?.name ?? m.category,
      tier: m.tier,
      checksTotal: total,
      availabilityPct: total > 0 ? roundPct(((total - down) / denom) * 100) : 0,
      cleanUptimePct: total > 0 ? roundPct((up / denom) * 100) : 0,
      wafPct: total > 0 ? roundPct((waf / denom) * 100) : 0,
      degradedPct: total > 0 ? roundPct((degraded / denom) * 100) : 0,
      downPct: total > 0 ? roundPct((down / denom) * 100) : 0,
      avgMs: total > 0 ? Math.round(sumMs / denom) : 0,
      maxMs,
      incidentCount,
    };
  });

  // Aggregate categories
  const categoryAcc = new Map<
    string,
    {
      monitorCount: number;
      checksTotal: number;
      up: number;
      degraded: number;
      waf: number;
      down: number;
      sumMs: number;
      maxMs: number;
      incidentCount: number;
    }
  >();

  for (const m of scopedMonitors) {
    const agg = dbMonitorMap.get(m.slug);
    const acc = categoryAcc.get(m.category) ?? {
      monitorCount: 0,
      checksTotal: 0,
      up: 0,
      degraded: 0,
      waf: 0,
      down: 0,
      sumMs: 0,
      maxMs: 0,
      incidentCount: 0,
    };
    acc.monitorCount += 1;
    acc.checksTotal += Number(agg?.total ?? 0);
    acc.up += Number(agg?.up ?? 0);
    acc.degraded += Number(agg?.degraded ?? 0);
    acc.waf += Number(agg?.waf ?? 0);
    acc.down += Number(agg?.down ?? 0);
    acc.sumMs += Number(agg?.sum_ms ?? 0);
    acc.maxMs = Math.max(acc.maxMs, Number(agg?.max_ms ?? 0));
    acc.incidentCount += Number(incidentByMonitorMap.get(m.slug) ?? 0);
    categoryAcc.set(m.category, acc);
  }

  const categoryRows = Array.from(categoryAcc.entries())
    .map(([slug, acc]) => {
      const cat = categoryMap.get(slug);
      const total = acc.checksTotal;
      const denom = total || 1;
      return {
        slug,
        name: cat?.name ?? slug,
        description: cat?.description ?? '',
        monitorCount: acc.monitorCount,
        checksTotal: total,
        availabilityPct: total > 0 ? roundPct(((total - acc.down) / denom) * 100) : 0,
        cleanUptimePct: total > 0 ? roundPct((acc.up / denom) * 100) : 0,
        wafPct: total > 0 ? roundPct((acc.waf / denom) * 100) : 0,
        degradedPct: total > 0 ? roundPct((acc.degraded / denom) * 100) : 0,
        downPct: total > 0 ? roundPct((acc.down / denom) * 100) : 0,
        avgMs: total > 0 ? Math.round(acc.sumMs / denom) : 0,
        maxMs: acc.maxMs,
        incidentCount: acc.incidentCount,
      };
    })
    .sort((a, b) => a.availabilityPct - b.availabilityPct);

  const withChecks = monitorRows.filter(m => m.checksTotal > 0);
  const rankingPool = withChecks.length > 0 ? withChecks : monitorRows;

  const worstPerformers = [...rankingPool]
    .sort((a, b) => a.availabilityPct - b.availabilityPct || b.avgMs - a.avgMs)
    .slice(0, 10);

  const bestPerformers = [...rankingPool]
    .sort((a, b) => b.availabilityPct - a.availabilityPct || a.avgMs - b.avgMs)
    .slice(0, 10);

  const slowestMonitors = [...rankingPool]
    .sort((a, b) => b.avgMs - a.avgMs || a.availabilityPct - b.availabilityPct)
    .slice(0, 10);

  const mostIncidents = [...rankingPool]
    .sort(
      (a, b) =>
        b.incidentCount - a.incidentCount || a.availabilityPct - b.availabilityPct
    )
    .slice(0, 10);

  const totalIncidents =
    tier === 'all'
      ? Number(dbData.incidents?.totalIncidents ?? 0)
      : monitorRows.reduce((s, r) => s + r.incidentCount, 0);

  const rawCauses = dbData.incidents?.topCauses ?? [];
  const causeDenom = rawCauses.reduce((s, c) => s + c.count, 0) || 1;
  const incidentCauses = rawCauses.map(c => ({
    cause: c.cause,
    count: c.count,
    pct: roundPct((c.count / causeDenom) * 100),
  }));

  const worstCat =
    categoryRows.find(c => c.checksTotal > 0) ?? categoryRows[0] ?? null;

  const netDenom = networkTotalChecks || 1;
  const avgResolutionSec = dbData.incidents?.avgResolutionSec ?? null;

  return {
    generatedAt: new Date().toISOString(),
    range,
    days: dbData.days ?? RANGE_DAYS[range],
    tier,
    isMock: false,
    kpis: {
      totalMonitors: monitorRows.length,
      totalChecks: networkTotalChecks,
      availabilityPct:
        networkTotalChecks > 0
          ? roundPct(((networkTotalChecks - networkDown) / netDenom) * 100)
          : 0,
      cleanUptimePct:
        networkTotalChecks > 0 ? roundPct((networkUp / netDenom) * 100) : 0,
      wafPct:
        networkTotalChecks > 0 ? roundPct((networkWaf / netDenom) * 100) : 0,
      degradedPct:
        networkTotalChecks > 0
          ? roundPct((networkDegraded / netDenom) * 100)
          : 0,
      downPct:
        networkTotalChecks > 0 ? roundPct((networkDown / netDenom) * 100) : 0,
      avgMs: networkTotalChecks > 0 ? Math.round(networkSumMs / netDenom) : 0,
      maxMs: networkMaxMs,
      totalIncidents,
      openIncidents: Number(dbData.incidents?.openIncidents ?? 0),
      mttrMinutes:
        avgResolutionSec !== null ? Math.round(avgResolutionSec / 60) : null,
      worstCategory: worstCat
        ? {
            slug: worstCat.slug,
            name: worstCat.name,
            availabilityPct: worstCat.availabilityPct,
            downPct: worstCat.downPct,
            monitorCount: worstCat.monitorCount,
          }
        : null,
    },
    dailyTrend: (dbData.daily ?? []).map(d => {
      const t = Number(d.total ?? 0);
      const dn = Number(d.down ?? 0);
      return {
        day: d.day,
        total: t,
        up: Number(d.up ?? 0),
        degraded: Number(d.degraded ?? 0),
        waf: Number(d.waf ?? 0),
        down: dn,
        availabilityPct: t > 0 ? roundPct(((t - dn) / t) * 100) : 0,
        avgMs: Number(d.avg_ms ?? 0),
      };
    }),
    categories: categoryRows,
    monitors: monitorRows,
    worstPerformers,
    bestPerformers,
    slowestMonitors,
    mostIncidents,
    incidentCauses,
  };
}

export async function onDashboardRequest(c: Context<{ Bindings: Env }>) {
  const range = parseDashboardRange(c.req.query('range'));
  const tier = parseDashboardTier(c.req.query('tier'));
  const days = RANGE_DAYS[range];

  // Check Cloudflare edge cache when available so repeat requests use 0 Supabase egress
  const cacheKey = new Request(
    `https://cache.local/api/dashboard?range=${range}&tier=${tier}`,
    { method: 'GET' }
  );
  let edgeCache: Cache | undefined;
  try {
    edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    if (edgeCache) {
      const cached = await edgeCache.match(cacheKey);
      if (cached) {
        return cached;
      }
    }
  } catch {
    edgeCache = undefined;
  }

  const dbData = await fetchDashboardFromDb(c.env, days);
  const payload = buildDashboardPayload(dbData, range, tier);

  const response = c.json(payload, 200, {
    'Cache-Control': CACHE_CONTROL_HEADER,
  });

  if (edgeCache) {
    try {
      const toCache = response.clone();
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(edgeCache.put(cacheKey, toCache));
      } else {
        await edgeCache.put(cacheKey, toCache);
      }
    } catch {
      // Ignore cache write errors in non-edge environments
    }
  }

  return response;
}
