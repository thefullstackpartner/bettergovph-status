import type { Context } from 'hono';
import type { Env } from '../types';
import { categories, enabledMonitors } from '../lib/monitors';
import {
  fetchScorecardsFromDb,
  type ScorecardsDbPayload,
} from '../lib/supabase';

export type ScorecardPeriod = '7d' | '30d' | '90d' | '1y';
export type ScorecardTier = 'all' | 'critical' | 'standard';
export type ScorecardGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';

const PERIOD_DAYS: Record<ScorecardPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const CACHE_HEADER =
  'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseScorecardPeriod(raw: string | undefined): ScorecardPeriod {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === '1y') {
    return raw;
  }
  return '30d';
}

export function parseScorecardTier(raw: string | undefined): ScorecardTier {
  if (raw === 'critical' || raw === 'standard') return raw;
  return 'all';
}

export function computeReliabilityGrade(
  availabilityPct: number | null,
  checksTotal: number
): ScorecardGrade {
  if (checksTotal === 0 || availabilityPct === null) return 'N/A';
  if (availabilityPct >= 99.5) return 'A';
  if (availabilityPct >= 98.0) return 'B';
  if (availabilityPct >= 95.0) return 'C';
  if (availabilityPct >= 90.0) return 'D';
  return 'F';
}

export interface ScorecardMonitorRow {
  slug: string;
  name: string;
  agency: string;
  url: string;
  category: string;
  categoryName: string;
  tier: 'critical' | 'standard';
  checksTotal: number;
  availabilityPct: number | null;
  cleanUptimePct: number | null;
  avgMs: number | null;
  maxMs: number;
  incidentCount: number;
  openIncidents: number;
  mttrSec: number | null;
  grade: ScorecardGrade;
}

export interface ScorecardCategoryRow {
  category: string;
  categoryName: string;
  monitorCount: number;
  checksTotal: number;
  availabilityPct: number | null;
  avgMs: number | null;
  incidentCount: number;
  mttrSec: number | null;
  grade: ScorecardGrade;
}

export function buildScorecardsPayload(
  dbData: ScorecardsDbPayload,
  period: ScorecardPeriod,
  tier: ScorecardTier
) {
  const categoryMap = new Map(categories.map(c => [c.slug, c]));
  const statsBySlug = new Map(dbData.monitors.map(m => [m.monitor_slug, m]));
  const incBySlug = new Map(dbData.incidents.map(i => [i.monitor_slug, i]));

  const scoped = enabledMonitors.filter(m => tier === 'all' || m.tier === tier);

  const monitors: ScorecardMonitorRow[] = scoped.map(m => {
    const st = statsBySlug.get(m.slug);
    const inc = incBySlug.get(m.slug);
    const total = Number(st?.total ?? 0);
    const up = Number(st?.up ?? 0);
    const down = Number(st?.down ?? 0);
    const sumMs = Number(st?.sum_ms ?? 0);
    const maxMs = Number(st?.max_ms ?? 0);
    const availabilityPct =
      total > 0 ? roundPct(((total - down) / total) * 100) : null;
    const cleanUptimePct = total > 0 ? roundPct((up / total) * 100) : null;
    const avgMs = total > 0 ? Math.round(sumMs / total) : null;
    const incidentCount = Number(inc?.incident_count ?? 0);
    const openIncidents = Number(inc?.open_incidents ?? 0);
    const mttrSec = inc?.mttr_sec ?? null;

    return {
      slug: m.slug,
      name: m.name,
      agency: m.agency,
      url: m.url,
      category: m.category,
      categoryName: categoryMap.get(m.category)?.name ?? m.category,
      tier: m.tier,
      checksTotal: total,
      availabilityPct,
      cleanUptimePct,
      avgMs,
      maxMs,
      incidentCount,
      openIncidents,
      mttrSec,
      grade: computeReliabilityGrade(availabilityPct, total),
    };
  });

  // Aggregate by category
  const catAcc = new Map<
    string,
    {
      monitorCount: number;
      total: number;
      down: number;
      sumMs: number;
      incidents: number;
      mttrValues: number[];
    }
  >();

  for (const row of monitors) {
    const st = statsBySlug.get(row.slug);
    const cur = catAcc.get(row.category) ?? {
      monitorCount: 0,
      total: 0,
      down: 0,
      sumMs: 0,
      incidents: 0,
      mttrValues: [],
    };
    cur.monitorCount += 1;
    cur.total += Number(st?.total ?? 0);
    cur.down += Number(st?.down ?? 0);
    cur.sumMs += Number(st?.sum_ms ?? 0);
    cur.incidents += row.incidentCount;
    if (row.mttrSec !== null) cur.mttrValues.push(row.mttrSec);
    catAcc.set(row.category, cur);
  }

  const categoryRows: ScorecardCategoryRow[] = Array.from(catAcc.entries())
    .map(([slug, acc]) => {
      const availabilityPct =
        acc.total > 0 ? roundPct(((acc.total - acc.down) / acc.total) * 100) : null;
      const avgMs = acc.total > 0 ? Math.round(acc.sumMs / acc.total) : null;
      const mttrSec =
        acc.mttrValues.length > 0
          ? Math.round(
              acc.mttrValues.reduce((a, b) => a + b, 0) / acc.mttrValues.length
            )
          : null;
      return {
        category: slug,
        categoryName: categoryMap.get(slug)?.name ?? slug,
        monitorCount: acc.monitorCount,
        checksTotal: acc.total,
        availabilityPct,
        avgMs,
        incidentCount: acc.incidents,
        mttrSec,
        grade: computeReliabilityGrade(availabilityPct, acc.total),
      };
    })
    .sort(
      (a, b) => (b.availabilityPct ?? -1) - (a.availabilityPct ?? -1)
    );

  // Overall summary
  let sumTotal = 0;
  let sumDown = 0;
  let totalIncidents = 0;
  const allMttrs: number[] = [];
  for (const row of monitors) {
    const st = statsBySlug.get(row.slug);
    sumTotal += Number(st?.total ?? 0);
    sumDown += Number(st?.down ?? 0);
    totalIncidents += row.incidentCount;
    if (row.mttrSec !== null) allMttrs.push(row.mttrSec);
  }

  return {
    generatedAt: new Date().toISOString(),
    period,
    days: PERIOD_DAYS[period],
    tier,
    summary: {
      totalMonitors: monitors.length,
      avgAvailabilityPct:
        sumTotal > 0 ? roundPct(((sumTotal - sumDown) / sumTotal) * 100) : null,
      totalIncidents,
      avgMttrSec:
        allMttrs.length > 0
          ? Math.round(allMttrs.reduce((a, b) => a + b, 0) / allMttrs.length)
          : null,
    },
    categories: categoryRows,
    monitors,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function scorecardsToCsv(
  rows: ScorecardMonitorRow[]
): string {
  const headers = [
    'slug',
    'name',
    'agency',
    'category',
    'tier',
    'grade',
    'availability_pct',
    'clean_uptime_pct',
    'checks_total',
    'avg_ms',
    'max_ms',
    'incident_count',
    'open_incidents',
    'mttr_sec',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.slug,
        r.name,
        r.agency,
        r.categoryName,
        r.tier,
        r.grade,
        r.availabilityPct,
        r.cleanUptimePct,
        r.checksTotal,
        r.avgMs,
        r.maxMs,
        r.incidentCount,
        r.openIncidents,
        r.mttrSec,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return lines.join('\r\n') + '\r\n';
}

export async function onScorecardsRequest(c: Context<{ Bindings: Env }>) {
  const period = parseScorecardPeriod(c.req.query('period'));
  const tier = parseScorecardTier(c.req.query('tier'));
  const format = c.req.query('format') === 'csv' ? 'csv' : 'json';

  const dbData = await fetchScorecardsFromDb(c.env, PERIOD_DAYS[period]);
  const payload = buildScorecardsPayload(dbData, period, tier);

  if (format === 'csv') {
    const csv = scorecardsToCsv(payload.monitors);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bettergovph-scorecards-${period}-${tier}.csv"`,
        'Cache-Control': CACHE_HEADER,
      },
    });
  }

  return c.json(payload, 200, { 'Cache-Control': CACHE_HEADER });
}
