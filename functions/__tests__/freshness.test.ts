import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DimeFreshnessProbe,
  DpwhTransparencyFreshnessProbe,
  GenericFreshnessProbe,
  getFreshnessProbe,
  SumbongSaPanguloFreshnessProbe,
} from '../checks/freshness';
import {
  computeFreshnessStatus,
  getFreshnessStaleDays,
} from '../lib/freshness';
import type { CheckContext, MonitorDefinition } from '../types';

const ctx: CheckContext = {
  userAgent: 'bettergovph-status-test/1.0',
  colo: 'MNL',
};

function makeMonitor(overrides: Partial<MonitorDefinition>): MonitorDefinition {
  return {
    slug: 'test-portal',
    name: 'Test Portal',
    agency: 'Test Agency',
    category: 'infrastructure',
    type: 'http',
    url: 'https://example.gov.ph/',
    tier: 'critical',
    freshnessEnabled: true,
    ...overrides,
  };
}

describe('freshness threshold calculation', () => {
  it('defaults to 30 days and respects Env.FRESHNESS_STALE_DAYS', () => {
    expect(getFreshnessStaleDays()).toBe(30);
    expect(getFreshnessStaleDays({ FRESHNESS_STALE_DAYS: '45' })).toBe(45);
    expect(getFreshnessStaleDays({ FRESHNESS_STALE_DAYS: 'invalid' })).toBe(30);
  });

  it('computes fresh vs stale dynamically from reference date', () => {
    const now = new Date('2026-11-25T00:00:00Z');
    expect(computeFreshnessStatus(null, 30, now)).toBe('unknown');
    expect(computeFreshnessStatus('2026-11-20T00:00:00Z', 30, now)).toBe('fresh');
    expect(computeFreshnessStatus('2026-10-01T00:00:00Z', 30, now)).toBe('stale');
    // Changing threshold from 30 -> 60 flips the same DB timestamp to fresh.
    expect(computeFreshnessStatus('2026-10-01T00:00:00Z', 60, now)).toBe('fresh');
  });
});

describe('FreshnessProbeRegistry', () => {
  it('selects monitor-specific probe classes and falls back to GenericFreshnessProbe', () => {
    expect(getFreshnessProbe(makeMonitor({ slug: 'dbm-dime' }))).toBeInstanceOf(
      DimeFreshnessProbe
    );
    expect(
      getFreshnessProbe(makeMonitor({ slug: 'dpwh-transparency' }))
    ).toBeInstanceOf(DpwhTransparencyFreshnessProbe);
    expect(
      getFreshnessProbe(makeMonitor({ slug: 'sumbong-sa-pangulo' }))
    ).toBeInstanceOf(SumbongSaPanguloFreshnessProbe);
    expect(
      getFreshnessProbe(makeMonitor({ slug: 'other-portal' }))
    ).toBeInstanceOf(GenericFreshnessProbe);
  });
});

describe('monitor-specific freshness probes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DimeFreshnessProbe extracts __NEXT_DATA__ timestamp and ignores volatile CSRF tokens', async () => {
    const makeHtml = (token: string) =>
      `<!doctype html><html><head><meta name="csrf_token" content="${token}"/><meta name="_token" content="${token}"/></head><body><h1>Project DIME</h1><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
        {
          buildId: 'build-123',
          props: {
            pageProps: {
              lastUpdated: '2026-11-20T08:00:00Z',
              projects: [{ updatedAt: '2026-11-22T10:30:00Z' }],
            },
          },
        }
      )}</script></body></html>`;

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(makeHtml('token-aaa'), {
          status: 200,
          headers: { 'content-type': 'text/html', etag: '"abc"' },
        })
      )
      .mockResolvedValueOnce(
        new Response(makeHtml('token-bbb'), {
          status: 200,
          headers: { 'content-type': 'text/html', etag: '"abc"' },
        })
      );

    const probe = new DimeFreshnessProbe();
    const monitor = makeMonitor({
      slug: 'dbm-dime',
      url: 'https://www.dime.gov.ph/',
    });

    const r1 = await probe.probe(monitor, ctx);
    const r2 = await probe.probe(monitor, ctx);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r1.probe_error).toBeNull();
    expect(r1.signal_source).toBe('api');
    expect(r1.content_updated_at).toBe('2026-11-22T10:30:00.000Z');
    expect(r1.content_hash).toBeTruthy();
    expect(r1.content_hash).toBe(r2.content_hash);
  });

  it('DpwhTransparencyFreshnessProbe reads WP REST API when accessible and handles WAF 403', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ modified_gmt: '2026-11-18T04:15:00' }]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

    const probe = new DpwhTransparencyFreshnessProbe();
    const monitor = makeMonitor({
      slug: 'dpwh-transparency',
      url: 'https://transparency.dpwh.gov.ph/',
    });

    const okRes = await probe.probe(monitor, ctx);
    expect(okRes.probe_error).toBeNull();
    expect(okRes.signal_source).toBe('api');
    expect(okRes.content_updated_at).toBe('2026-11-18T04:15:00.000Z');

    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response('<title>Just a moment...</title>', { status: 403 })
      )
    );
    const wafRes = await probe.probe(monitor, ctx);
    expect(wafRes.probe_error).toBe('waf_403');
  });

  it('SumbongSaPanguloFreshnessProbe parses sitemap lastmod and handles WAF 403', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          `<urlset><url><loc>https://sumbongsapangulo.ph/</loc><lastmod>2026-11-15T12:00:00Z</lastmod></url></urlset>`,
          { status: 200, headers: { 'content-type': 'application/xml' } }
        )
      );

    const probe = new SumbongSaPanguloFreshnessProbe();
    const monitor = makeMonitor({
      slug: 'sumbong-sa-pangulo',
      url: 'https://sumbongsapangulo.ph/',
    });

    const okRes = await probe.probe(monitor, ctx);
    expect(okRes.probe_error).toBeNull();
    expect(okRes.signal_source).toBe('sitemap');
    expect(okRes.content_updated_at).toBe('2026-11-15T12:00:00.000Z');

    fetchMock.mockResolvedValueOnce(
      new Response('<title>Just a moment...</title>', { status: 403 })
    );
    const wafRes = await probe.probe(monitor, ctx);
    expect(wafRes.probe_error).toBe('waf_403');
  });
});
