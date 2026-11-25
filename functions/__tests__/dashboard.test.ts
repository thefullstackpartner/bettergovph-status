import { describe, expect, it, vi } from 'vitest';
import {
  buildDashboardPayload,
  parseDashboardRange,
  parseDashboardTier,
} from '../api/dashboard';
import { app } from '../index';
import { allMonitors } from '../lib/monitors';
import * as supabaseLib from '../lib/supabase';
import type { DashboardDbPayload } from '../lib/supabase';
import type { Env } from '../types';

const mockEnv: Env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  CHECK_QUEUE: {} as Env['CHECK_QUEUE'],
  USER_AGENT: 'bettergovph-status-test/1.0',
};

const sampleDbPayload: DashboardDbPayload = {
  days: 30,
  monitors: [
    {
      monitor_slug: 'bir-main',
      total: 1000,
      up: 995,
      degraded: 3,
      waf: 2,
      down: 0,
      sum_ms: 120000,
      max_ms: 420,
    },
    {
      monitor_slug: 'bir-efps',
      total: 1000,
      up: 850,
      degraded: 20,
      waf: 30,
      down: 100,
      sum_ms: 650000,
      max_ms: 4800,
    },
  ],
  daily: [
    {
      day: '2026-11-24',
      total: 2000,
      up: 1845,
      degraded: 23,
      waf: 32,
      down: 100,
      avg_ms: 385,
    },
  ],
  incidents: {
    totalIncidents: 4,
    openIncidents: 1,
    avgResolutionSec: 1800,
    byMonitor: [{ monitor_slug: 'bir-efps', count: 4 }],
    topCauses: [
      { cause: 'timeout', count: 3 },
      { cause: 'http_502', count: 1 },
    ],
  },
};

describe('dashboard API & aggregation', () => {
  it('parses range and tier query parameters with safe defaults', () => {
    expect(parseDashboardRange('7d')).toBe('7d');
    expect(parseDashboardRange('1y')).toBe('1y');
    expect(parseDashboardRange('invalid')).toBe('30d');
    expect(parseDashboardRange(undefined)).toBe('30d');

    expect(parseDashboardTier('critical')).toBe('critical');
    expect(parseDashboardTier('standard')).toBe('standard');
    expect(parseDashboardTier('other')).toBe('all');
  });

  it('builds category rollups, KPIs, and rankings from DB payload', () => {
    const result = buildDashboardPayload(sampleDbPayload, '30d', 'all');

    expect(result.kpis.totalChecks).toBe(2000);
    expect(result.kpis.availabilityPct).toBe(95);
    expect(result.kpis.cleanUptimePct).toBe(92.25);
    expect(result.kpis.avgMs).toBe(385);
    expect(result.kpis.maxMs).toBe(4800);
    expect(result.kpis.mttrMinutes).toBe(30);
    expect(result.kpis.worstCategory?.slug).toBe('tax-revenue');

    expect(result.worstPerformers[0].slug).toBe('bir-efps');
    expect(result.bestPerformers[0].slug).toBe('bir-main');
    expect(result.slowestMonitors[0].slug).toBe('bir-efps');
    expect(result.mostIncidents[0].slug).toBe('bir-efps');
    expect(result.incidentCauses[0]).toEqual({
      cause: 'timeout',
      count: 3,
      pct: 75,
    });
  });

  it('serves /api/dashboard with 5-minute edge cache headers', async () => {
    const spy = vi
      .spyOn(supabaseLib, 'fetchDashboardFromDb')
      .mockResolvedValue(sampleDbPayload);

    const res = await app.request(
      'http://localhost/api/dashboard?range=1y&tier=critical',
      undefined,
      mockEnv
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=300');
    expect(spy).toHaveBeenCalledWith(mockEnv, 365);

    const body = (await res.json()) as ReturnType<typeof buildDashboardPayload>;
    const expectedCriticalCount = allMonitors.filter(
      m => m.tier === 'critical' && m.enabled
    ).length;
    expect(body.range).toBe('1y');
    expect(body.tier).toBe('critical');
    expect(body.kpis.totalMonitors).toBe(expectedCriticalCount);

    spy.mockRestore();
  });
});
