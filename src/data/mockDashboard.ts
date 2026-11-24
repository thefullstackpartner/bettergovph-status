import categoriesData from './categories.json';
import curatedMonitors from './monitors/curated.json';
import constitutionalSucs from './monitors/imported/constitutional-sucs.json';
import diplomatic from './monitors/imported/diplomatic.json';
import executive from './monitors/imported/executive.json';
import legislative from './monitors/imported/legislative.json';
import type {
  Category,
  CategoryPerformance,
  DashboardDailyPoint,
  DashboardRange,
  DashboardResponse,
  DashboardTierFilter,
  IncidentCauseSummary,
  MonitorPerformanceRow,
  MonitorTier,
} from '../types';

interface RawMonitor {
  slug: string;
  name: string;
  agency: string;
  category: string;
  tier: MonitorTier;
  enabled?: boolean;
}

const CATEGORIES = categoriesData as Category[];
const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.slug, c]));

const ALL_MONITORS: RawMonitor[] = [
  ...(curatedMonitors as RawMonitor[]),
  ...(constitutionalSucs as RawMonitor[]),
  ...(diplomatic as RawMonitor[]),
  ...(executive as RawMonitor[]),
  ...(legislative as RawMonitor[]),
].filter(m => m.enabled !== false);

const RANGE_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

/** Category-level baseline failure/latency bias so category comparisons are meaningful. */
const CATEGORY_BIAS: Record<string, { downBias: number; wafBias: number; msBias: number }> = {
  'constitutional-sucs': { downBias: 0.032, wafBias: 0.025, msBias: 420 },
  diplomatic: { downBias: 0.024, wafBias: 0.04, msBias: 510 },
  executive: { downBias: 0.014, wafBias: 0.035, msBias: 310 },
  'tax-revenue': { downBias: 0.008, wafBias: 0.06, msBias: 240 },
  'business-trade': { downBias: 0.011, wafBias: 0.03, msBias: 280 },
  transport: { downBias: 0.015, wafBias: 0.02, msBias: 340 },
  'travel-immigration': { downBias: 0.009, wafBias: 0.045, msBias: 260 },
  'social-security': { downBias: 0.007, wafBias: 0.025, msBias: 220 },
  'identity-civil-registry': { downBias: 0.006, wafBias: 0.03, msBias: 230 },
  health: { downBias: 0.005, wafBias: 0.015, msBias: 195 },
  education: { downBias: 0.012, wafBias: 0.018, msBias: 290 },
  legislative: { downBias: 0.004, wafBias: 0.01, msBias: 170 },
  'disaster-weather': { downBias: 0.003, wafBias: 0.008, msBias: 155 },
  'government-portals': { downBias: 0.002, wafBias: 0.01, msBias: 140 },
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unitRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getMockDashboardData(
  range: DashboardRange,
  tier: DashboardTierFilter
): DashboardResponse {
  const days = RANGE_DAYS[range];
  const filteredMonitors = ALL_MONITORS.filter(
    m => tier === 'all' || m.tier === tier
  );

  // 288 checks/day (every 5 minutes)
  const checksPerMonitor = days * 288;

  const monitorRows: MonitorPerformanceRow[] = filteredMonitors.map(m => {
    const seed = hashString(`${m.slug}:${range}`);
    const r1 = unitRandom(seed);
    const r2 = unitRandom(seed + 17);
    const r3 = unitRandom(seed + 43);
    const r4 = unitRandom(seed + 89);

    const bias = CATEGORY_BIAS[m.category] ?? {
      downBias: 0.01,
      wafBias: 0.02,
      msBias: 250,
    };

    // Create a realistic long-tail: most portals are >98% up, a handful struggle
    const isOutlier = r1 > 0.92;
    const isTopPerformer = r1 < 0.18;

    const downRate = isTopPerformer
      ? r2 * 0.0008
      : isOutlier
        ? bias.downBias * (2.2 + r2 * 3.5)
        : bias.downBias * (0.25 + r2 * 1.1);

    const wafRate = isTopPerformer
      ? r3 * 0.002
      : bias.wafBias * (0.3 + r3 * 1.8);

    const degradedRate = isTopPerformer
      ? r4 * 0.003
      : 0.004 + r4 * 0.025;

    const down = Math.min(checksPerMonitor, Math.round(checksPerMonitor * downRate));
    const waf = Math.min(
      checksPerMonitor - down,
      Math.round(checksPerMonitor * wafRate)
    );
    const degraded = Math.min(
      checksPerMonitor - down - waf,
      Math.round(checksPerMonitor * degradedRate)
    );
    const up = Math.max(0, checksPerMonitor - down - waf - degraded);

    const avgMs = Math.round(
      (isTopPerformer ? 95 : bias.msBias) * (0.65 + r2 * 0.9) +
        (isOutlier ? 650 : 0)
    );
    const maxMs = Math.round(avgMs * (2.4 + r4 * 3.8));
    const incidentCount =
      down === 0
        ? 0
        : Math.max(1, Math.round((down / 288) * (1.2 + r3 * 1.6) * (days / 30 + 0.5)));

    return {
      slug: m.slug,
      name: m.name,
      agency: m.agency,
      category: m.category,
      categoryName: CATEGORY_MAP.get(m.category)?.name ?? m.category,
      tier: m.tier,
      checksTotal: checksPerMonitor,
      availabilityPct: roundPct(((checksPerMonitor - down) / checksPerMonitor) * 100),
      cleanUptimePct: roundPct((up / checksPerMonitor) * 100),
      wafPct: roundPct((waf / checksPerMonitor) * 100),
      degradedPct: roundPct((degraded / checksPerMonitor) * 100),
      downPct: roundPct((down / checksPerMonitor) * 100),
      avgMs,
      maxMs,
      incidentCount,
    };
  });

  // Aggregate categories
  const categoryStats = new Map<
    string,
    {
      monitorCount: number;
      checksTotal: number;
      availWeighted: number;
      cleanWeighted: number;
      wafWeighted: number;
      degradedWeighted: number;
      downWeighted: number;
      msWeighted: number;
      maxMs: number;
      incidentCount: number;
    }
  >();

  for (const row of monitorRows) {
    const acc = categoryStats.get(row.category) ?? {
      monitorCount: 0,
      checksTotal: 0,
      availWeighted: 0,
      cleanWeighted: 0,
      wafWeighted: 0,
      degradedWeighted: 0,
      downWeighted: 0,
      msWeighted: 0,
      maxMs: 0,
      incidentCount: 0,
    };
    acc.monitorCount += 1;
    acc.checksTotal += row.checksTotal;
    acc.availWeighted += row.availabilityPct * row.checksTotal;
    acc.cleanWeighted += row.cleanUptimePct * row.checksTotal;
    acc.wafWeighted += row.wafPct * row.checksTotal;
    acc.degradedWeighted += row.degradedPct * row.checksTotal;
    acc.downWeighted += row.downPct * row.checksTotal;
    acc.msWeighted += row.avgMs * row.checksTotal;
    acc.maxMs = Math.max(acc.maxMs, row.maxMs);
    acc.incidentCount += row.incidentCount;
    categoryStats.set(row.category, acc);
  }

  const categories: CategoryPerformance[] = Array.from(categoryStats.entries())
    .map(([slug, acc]) => {
      const cat = CATEGORY_MAP.get(slug);
      const denom = acc.checksTotal || 1;
      return {
        slug,
        name: cat?.name ?? slug,
        description: cat?.description ?? '',
        monitorCount: acc.monitorCount,
        checksTotal: acc.checksTotal,
        availabilityPct: roundPct(acc.availWeighted / denom),
        cleanUptimePct: roundPct(acc.cleanWeighted / denom),
        wafPct: roundPct(acc.wafWeighted / denom),
        degradedPct: roundPct(acc.degradedWeighted / denom),
        downPct: roundPct(acc.downWeighted / denom),
        avgMs: Math.round(acc.msWeighted / denom),
        maxMs: acc.maxMs,
        incidentCount: acc.incidentCount,
      };
    })
    .sort((a, b) => a.availabilityPct - b.availabilityPct);

  // Network-wide KPIs
  const totalChecks = monitorRows.reduce((s, r) => s + r.checksTotal, 0);
  const denom = totalChecks || 1;
  const availabilityPct = roundPct(
    monitorRows.reduce((s, r) => s + r.availabilityPct * r.checksTotal, 0) / denom
  );
  const cleanUptimePct = roundPct(
    monitorRows.reduce((s, r) => s + r.cleanUptimePct * r.checksTotal, 0) / denom
  );
  const wafPct = roundPct(
    monitorRows.reduce((s, r) => s + r.wafPct * r.checksTotal, 0) / denom
  );
  const degradedPct = roundPct(
    monitorRows.reduce((s, r) => s + r.degradedPct * r.checksTotal, 0) / denom
  );
  const downPct = roundPct(
    monitorRows.reduce((s, r) => s + r.downPct * r.checksTotal, 0) / denom
  );
  const avgMs = Math.round(
    monitorRows.reduce((s, r) => s + r.avgMs * r.checksTotal, 0) / denom
  );
  const maxMs = monitorRows.reduce((m, r) => Math.max(m, r.maxMs), 0);
  const totalIncidents = monitorRows.reduce((s, r) => s + r.incidentCount, 0);
  const openIncidents = Math.max(
    0,
    Math.min(12, Math.round(monitorRows.filter(r => r.availabilityPct < 95).length * 0.15))
  );

  const worstCat = categories[0] ?? null;

  // Daily trend across `days`
  const now = new Date();
  const dailyTrend: DashboardDailyPoint[] = [];
  const dailyCheckVolume = Math.max(1, monitorRows.length * 288);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const dayStr = d.toISOString().slice(0, 10);
    const wave = Math.sin(i * 0.45) * 0.35 + Math.cos(i * 0.19) * 0.25;
    const spike = unitRandom(hashString(`${dayStr}:${tier}`)) > 0.9 ? 1.8 : 1;

    const dayDownPct = Math.max(0.15, downPct * (1 + wave * 0.4) * spike);
    const dayWafPct = Math.max(0.2, wafPct * (1 + wave * 0.2));
    const dayDegradedPct = Math.max(0.2, degradedPct * (1 - wave * 0.15));

    const down = Math.round((dailyCheckVolume * dayDownPct) / 100);
    const waf = Math.round((dailyCheckVolume * dayWafPct) / 100);
    const degraded = Math.round((dailyCheckVolume * dayDegradedPct) / 100);
    const up = Math.max(0, dailyCheckVolume - down - waf - degraded);

    dailyTrend.push({
      day: dayStr,
      total: dailyCheckVolume,
      up,
      degraded,
      waf,
      down,
      availabilityPct: roundPct(((dailyCheckVolume - down) / dailyCheckVolume) * 100),
      avgMs: Math.max(80, Math.round(avgMs * (1 + wave * 0.18) * (spike > 1 ? 1.25 : 1))),
    });
  }

  // Spotlights
  const worstPerformers = [...monitorRows]
    .sort((a, b) => a.availabilityPct - b.availabilityPct || b.avgMs - a.avgMs)
    .slice(0, 10);

  const bestPerformers = [...monitorRows]
    .sort((a, b) => b.availabilityPct - a.availabilityPct || a.avgMs - b.avgMs)
    .slice(0, 10);

  const slowestMonitors = [...monitorRows]
    .sort((a, b) => b.avgMs - a.avgMs || a.availabilityPct - b.availabilityPct)
    .slice(0, 10);

  const mostIncidents = [...monitorRows]
    .sort((a, b) => b.incidentCount - a.incidentCount || a.availabilityPct - b.availabilityPct)
    .slice(0, 10);

  // Incident causes breakdown
  const rawCauses = [
    { cause: 'timeout', weight: 0.36 },
    { cause: 'http_502', weight: 0.21 },
    { cause: 'http_503', weight: 0.16 },
    { cause: 'fetch_error', weight: 0.14 },
    { cause: 'http_500', weight: 0.08 },
    { cause: 'tls_error', weight: 0.05 },
  ];
  const causeTotal = Math.max(1, totalIncidents);
  const incidentCauses: IncidentCauseSummary[] = rawCauses.map(c => {
    const count = Math.round(causeTotal * c.weight);
    return {
      cause: c.cause,
      count,
      pct: roundPct((count / causeTotal) * 100),
    };
  });

  return {
    generatedAt: now.toISOString(),
    range,
    days,
    tier,
    isMock: true,
    kpis: {
      totalMonitors: monitorRows.length,
      totalChecks,
      availabilityPct,
      cleanUptimePct,
      wafPct,
      degradedPct,
      downPct,
      avgMs,
      maxMs,
      totalIncidents,
      openIncidents,
      mttrMinutes: tier === 'critical' ? 34 : 52,
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
    dailyTrend,
    categories,
    monitors: monitorRows,
    worstPerformers,
    bestPerformers,
    slowestMonitors,
    mostIncidents,
    incidentCauses,
  };
}
