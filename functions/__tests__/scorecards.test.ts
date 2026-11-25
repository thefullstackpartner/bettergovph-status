import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildScorecardsPayload,
  computeCompositeScore,
  computeReliabilityGrade,
  scorecardsToCsv,
} from '../api/scorecards';
import { app } from '../index';
import { enabledMonitors } from '../lib/monitors';
import * as supabase from '../lib/supabase';
import type { Env } from '../types';

const baseEnv: Env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

const firstSlug = enabledMonitors[0].slug;

describe('Scorecards & CSV export', () => {
  afterEach(() => vi.restoreAllMocks());

  it('assigns reliability grades from composite scores', () => {
    expect(computeReliabilityGrade(null, 0)).toBe('N/A');
    expect(computeReliabilityGrade(96.0, 100)).toBe('A');
    expect(computeReliabilityGrade(91.0, 100)).toBe('B');
    expect(computeReliabilityGrade(83.0, 100)).toBe('C');
    expect(computeReliabilityGrade(72.0, 100)).toBe('D');
    expect(computeReliabilityGrade(65.0, 100)).toBe('F');

    const fastClean = computeCompositeScore(99.5, 99.0, 250, 100);
    expect(fastClean).toBe(99.5);
    const slowDegraded = computeCompositeScore(99.5, 40.0, 3500, 100);
    expect(slowDegraded).toBeLessThan(85);
  });

  it('builds scorecards payload with MTTR and category rollups', () => {
    const payload = buildScorecardsPayload(
      {
        days: 30,
        monitors: [
          {
            monitor_slug: firstSlug,
            total: 1000,
            up: 990,
            degraded: 5,
            waf: 0,
            down: 5,
            sum_ms: 250_000,
            max_ms: 1400,
          },
        ],
        incidents: [
          {
            monitor_slug: firstSlug,
            incident_count: 2,
            open_incidents: 0,
            mttr_sec: 420,
          },
        ],
      },
      '30d',
      'all'
    );

    const row = payload.monitors.find(m => m.slug === firstSlug);
    expect(row).toBeDefined();
    expect(row?.availabilityPct).toBe(99.5);
    expect(row?.grade).toBe('A');
    expect(row?.incidentCount).toBe(2);
    expect(row?.mttrSec).toBe(420);
    expect(payload.summary.totalIncidents).toBe(2);
    expect(payload.summary.avgMttrSec).toBe(420);
  });

  it('marks 95%+ WAF-blocked monitors as unverified N/A instead of 100% available', () => {
    const payload = buildScorecardsPayload(
      {
        days: 30,
        monitors: [
          {
            monitor_slug: firstSlug,
            total: 100,
            up: 0,
            degraded: 100,
            waf: 100,
            down: 0,
            sum_ms: 20_000,
            max_ms: 500,
          },
        ],
        incidents: [],
      },
      '30d',
      'all'
    );
    const row = payload.monitors.find(m => m.slug === firstSlug);
    expect(row?.wafBlocked).toBe(true);
    expect(row?.availabilityPct).toBeNull();
    expect(row?.score).toBeNull();
    expect(row?.grade).toBe('N/A');
  });

  it('escapes commas and quotes in CSV export', () => {
    const csv = scorecardsToCsv([
      {
        slug: 'test-portal',
        name: 'Portal, "National"',
        agency: 'Agency A',
        url: 'https://portal.gov.ph',
        category: 'tax-revenue',
        categoryName: 'Tax & Revenue',
        tier: 'critical',
        checksTotal: 100,
        availabilityPct: 99.0,
        cleanUptimePct: 98.0,
        wafPct: 0,
        wafBlocked: false,
        avgMs: 200,
        maxMs: 800,
        incidentCount: 1,
        openIncidents: 0,
        mttrSec: 300,
        score: 91.0,
        grade: 'B',
      },
    ]);
    expect(csv).toContain('"Portal, ""National"""');
    expect(csv.split('\r\n')[0]).toContain('slug,name,agency,category');
  });

  it('serves GET /api/scorecards in JSON and CSV formats', async () => {
    vi.spyOn(supabase, 'fetchScorecardsFromDb').mockResolvedValue({
      days: 30,
      monitors: [
        {
          monitor_slug: firstSlug,
          total: 200,
          up: 196,
          degraded: 0,
          waf: 0,
          down: 4,
          sum_ms: 40_000,
          max_ms: 900,
        },
      ],
      incidents: [],
    });

    const jsonRes = await app.request(
      '/api/scorecards?period=30d&tier=critical',
      {},
      baseEnv
    );
    expect(jsonRes.status).toBe(200);
    const body = (await jsonRes.json()) as { period: string; tier: string };
    expect(body.period).toBe('30d');
    expect(body.tier).toBe('critical');

    const csvRes = await app.request(
      '/api/scorecards?period=30d&format=csv',
      {},
      baseEnv
    );
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get('Content-Type')).toContain('text/csv');
    const csvText = await csvRes.text();
    expect(csvText).toContain(firstSlug);
  });
});
