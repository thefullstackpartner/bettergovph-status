import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOpenApiSpec } from '../agent/openapi';
import { AI_RETRIEVAL_AGENTS, AI_TRAINING_CRAWLERS } from '../agent/robots';
import { api, app } from '../index';
import {
  filterMonitors,
  parseMonitorFilter,
  toLiteMonitor,
} from '../lib/monitor-filter';
import { enabledMonitors } from '../lib/monitors';
import * as supabase from '../lib/supabase';
import type { Env } from '../types';

const baseEnv: Env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

const downSlug = enabledMonitors[0].slug;
const upSlug = enabledMonitors[1].slug;

type SummaryPayload = Awaited<ReturnType<typeof supabase.fetchSummaryFromDb>>;

function mockData() {
  vi.spyOn(supabase, 'fetchSummaryFromDb').mockResolvedValue({
    states: [
      {
        monitor_slug: downSlug,
        status: 'down',
        last_checked_at: '2026-11-25T05:00:00Z',
        last_http_status: 503,
        last_response_ms: 1200,
        last_error: 'http_503',
        last_colo: 'SIN',
      },
      {
        monitor_slug: upSlug,
        status: 'up',
        last_checked_at: '2026-11-25T05:00:00Z',
        last_http_status: 200,
        last_response_ms: 300,
        last_error: null,
        last_colo: 'SIN',
      },
    ],
    u24: [],
    bars: [
      {
        monitor_slug: downSlug,
        bars_90d: [
          {
            day: '2026-11-24',
            total: 288,
            up: 280,
            degraded: 4,
            waf: 0,
            down: 4,
            avgMs: 420,
          },
        ],
      },
    ],
    hourly: [],
    openIncidents: 1,
  } as unknown as SummaryPayload);
  vi.spyOn(supabase, 'fetchAllIncidents').mockResolvedValue({
    items: [
      {
        id: 1,
        monitor_slug: downSlug,
        started_at: '2026-11-25T04:50:00Z',
        resolved_at: null,
        cause: 'http_503',
      },
    ],
    total: 1,
  });
  vi.spyOn(supabase, 'fetchMonitorIncidents').mockResolvedValue([]);
  vi.spyOn(supabase, 'fetchMonitorFreshnessEvents').mockResolvedValue([]);
}

describe('Agent discovery files (no Supabase required)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('serves llms.txt in llmstxt.org format with request-origin URLs', async () => {
    const res = await app.request(
      'https://status.test/llms.txt',
      {},
      {} as Env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const text = await res.text();
    expect(text.startsWith('# BetterGovPH Status\n')).toBe(true);
    expect(text).toMatch(/\n> .+/);
    expect(text).toContain('## Live status');
    expect(text).toContain('https://status.test/status.md');
    expect(text).toContain('https://status.test/api/openapi.json');
  });

  it('uses SITE_URL for absolute links when configured', async () => {
    const res = await app.request('http://127.0.0.1:5525/llms.txt', {}, {
      SITE_URL: 'https://status.example.ph/',
    } as Env);
    const text = await res.text();
    expect(text).toContain('https://status.example.ph/status.md');
    expect(text).not.toContain('127.0.0.1');
  });

  it('serves /.well-known/llms.txt as an alias', async () => {
    const res = await app.request('/.well-known/llms.txt', {}, {} as Env);
    expect(res.status).toBe(200);
  });

  it('llms-full.txt lists every enabled monitor slug', async () => {
    const res = await app.request('/llms-full.txt', {}, {} as Env);
    expect(res.status).toBe(200);
    const text = await res.text();
    for (const m of enabledMonitors) {
      expect(text).toContain(`| ${m.slug} |`);
    }
    expect(text).toContain('## Field dictionary');
  });

  it('robots.txt allows retrieval agents and blocks AI training crawlers', async () => {
    const res = await app.request(
      'https://status.test/robots.txt',
      {},
      {} as Env
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Sitemap: https://status.test/sitemap.xml');
    expect(text).toContain(
      'Content-Signal: search=yes, ai-input=yes, ai-train=no'
    );
    expect(text).toMatch(/User-agent: \*\nAllow: \/\nDisallow: \/api\/trigger/);
    for (const ua of AI_TRAINING_CRAWLERS) {
      expect(text).toContain(`User-agent: ${ua}\nDisallow: /\n`);
    }
    for (const ua of AI_RETRIEVAL_AGENTS) {
      expect(text).toContain(
        `User-agent: ${ua}\nAllow: /\nDisallow: /api/trigger`
      );
    }
    expect(text).toMatch(/User-agent: GPTBot\nDisallow: \/\n/);
    expect(text).toMatch(/User-agent: ChatGPT-User\nAllow: \//);
  });

  it('sitemap.xml includes static pages and every enabled monitor', async () => {
    const res = await app.request(
      'https://status.test/sitemap.xml',
      {},
      {} as Env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/xml');
    const xml = await res.text();
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    expect(xml).toContain('<loc>https://status.test/about</loc>');
    expect((xml.match(/<url>/g) ?? []).length).toBeGreaterThanOrEqual(
      enabledMonitors.length
    );
    expect(xml).toContain(
      `<loc>https://status.test/monitors/${downSlug}</loc>`
    );
  });

  it('serves OpenAPI 3.1 without Supabase and with open CORS', async () => {
    const res = await app.request(
      'https://status.test/api/openapi.json',
      { headers: { Origin: 'https://some-agent.example' } },
      {} as Env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const spec = (await res.json()) as {
      openapi: string;
      servers: Array<{ url: string }>;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.servers[0].url).toBe('https://status.test');
    expect(spec.paths['/api/trigger']).toBeUndefined();
  });

  it('OpenAPI documents every public GET route on the API (drift guard)', () => {
    const spec = buildOpenApiSpec('https://status.test') as {
      paths: Record<string, Record<string, unknown>>;
    };
    const getRoutes = api.routes
      .filter((r) => r.method === 'GET')
      .map((r) =>
        `/api${r.path}`
          .replace(/:(\w+)\{[^}]*\\\.md\}/g, '{$1}.md')
          .replace(/:(\w+)\{[^}]*\}/g, '{$1}')
      );
    expect(getRoutes.length).toBeGreaterThan(5);
    for (const path of getRoutes) {
      if (path === '/api/openapi.json') continue;
      expect(spec.paths[path]?.get, `missing ${path} in OpenAPI`).toBeDefined();
    }
    // all $refs resolve
    const json = JSON.stringify(spec);
    const components = (
      spec as unknown as { components: Record<string, Record<string, unknown>> }
    ).components;
    for (const [, kind, name] of json.matchAll(
      /"#\/components\/(\w+)\/(\w+)"/g
    )) {
      expect(
        components[kind]?.[name],
        `unresolved $ref ${kind}/${name}`
      ).toBeDefined();
    }
  });
});

describe('Markdown status endpoints', () => {
  afterEach(() => vi.restoreAllMocks());

  it('/status.md lists down monitors and open incidents', async () => {
    mockData();
    const res = await app.request('https://status.test/status.md', {}, baseEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
    const md = await res.text();
    const downName = enabledMonitors[0].name.replace(/[[\]]/g, '');
    expect(md).toContain('# BetterGovPH Status — Live status');
    expect(md).toContain('## Down (1)');
    expect(md).toContain(
      `[${downName}](https://status.test/api/monitors/${downSlug}.md)`
    );
    expect(md).toContain('## Open incidents (1)');
    expect(md).toContain('HTTP 503');
  });

  it('/status.md returns 503 without Supabase', async () => {
    const res = await app.request('/status.md', {}, {} as Env);
    expect(res.status).toBe(503);
  });

  it('/api/status.md is an alias', async () => {
    mockData();
    const res = await app.request('/api/status.md', {}, baseEnv);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Live status');
  });

  it('/api/monitors/{slug}.md renders one monitor', async () => {
    mockData();
    const res = await app.request(
      `https://status.test/api/monitors/${downSlug}.md`,
      {},
      baseEnv
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
    const md = await res.text();
    expect(md).toContain(`slug \`${downSlug}\``);
    expect(md).toContain('**Down**');
    expect(md).toContain('## Last 14 days');
    expect(md).toContain('| 2026-11-24 | 288 |');
  });

  it('/api/monitors/{slug}.md returns 404 markdown for unknown slug', async () => {
    const res = await app.request(
      '/api/monitors/no-such-slug-xyz.md',
      {},
      baseEnv
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('# Monitor not found');
  });

  it('JSON monitor detail route still works alongside .md route', async () => {
    mockData();
    const res = await app.request(`/api/monitors/${downSlug}`, {}, baseEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { monitor: { slug: string } };
    expect(body.monitor.slug).toBe(downSlug);
  });

  it('/api/incidents.md renders incidents table', async () => {
    mockData();
    const res = await app.request('/api/incidents.md?status=open', {}, baseEnv);
    expect(res.status).toBe(200);
    const md = await res.text();
    expect(md).toContain('Open incidents');
    expect(md).toContain('ongoing');
  });

  it('/incidents.rss renders valid RSS 2.0 XML with incidents', async () => {
    mockData();
    const res = await app.request(
      'https://status.test/incidents.rss',
      {},
      baseEnv
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/rss+xml');
    const xml = await res.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('href="https://status.test/incidents.rss"');
    expect(xml).toContain('<item>');
    expect(xml).toContain(`[Ongoing]`);
    expect(xml).toContain(`<link>https://status.test/monitors/${downSlug}</link>`);
    expect(xml).toContain('<guid isPermaLink="false">bgovph-incident-1</guid>');
  });

  it('/incidents.rss?status=open filters to ongoing incidents in title/selfUrl', async () => {
    mockData();
    const res = await app.request(
      'https://status.test/incidents.rss?status=open',
      {},
      baseEnv
    );
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('Incidents (Ongoing)');
    expect(xml).toContain(
      'href="https://status.test/incidents.rss?status=open"'
    );
  });

  it('/api/monitors/{slug}/feed.xml renders per-monitor RSS and handles empty incidents', async () => {
    mockData();
    vi.spyOn(supabase, 'fetchMonitorIncidents').mockResolvedValue([
      {
        id: 42,
        monitor_slug: downSlug,
        started_at: '2026-11-24T10:00:00Z',
        resolved_at: '2026-11-24T10:30:00Z',
        cause: 'timeout',
      },
    ]);
    const res = await app.request(
      `https://status.test/api/monitors/${downSlug}/feed.xml`,
      {},
      baseEnv
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/rss+xml');
    const xml = await res.text();
    expect(xml).toContain(
      `href="https://status.test/api/monitors/${downSlug}/feed.xml"`
    );
    expect(xml).toContain('[Resolved]');
    expect(xml).toContain('duration: 30m');
  });

  it('/api/monitors/{slug}/feed.xml returns 404 for unknown slug', async () => {
    const res = await app.request(
      '/api/monitors/no-such-slug-xyz/feed.xml',
      {},
      baseEnv
    );
    expect(res.status).toBe(404);
  });
});

describe('/api/monitors filtering', () => {
  afterEach(() => vi.restoreAllMocks());

  it('view=lite drops bar arrays and filters by status', async () => {
    mockData();
    const res = await app.request(
      '/api/monitors?view=lite&status=down',
      {},
      baseEnv
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      monitors: Array<Record<string, unknown>>;
    };
    expect(body.count).toBe(1);
    expect(body.monitors[0].slug).toBe(downSlug);
    expect(body.monitors[0]).not.toHaveProperty('bars90d');
    expect(body.monitors[0]).not.toHaveProperty('hourly24h');
  });

  it('no params returns the full list unchanged', async () => {
    mockData();
    const res = await app.request('/api/monitors', {}, baseEnv);
    const body = (await res.json()) as {
      monitors: Array<Record<string, unknown>>;
    };
    expect(body.monitors.length).toBe(enabledMonitors.length);
    expect(body.monitors[0]).toHaveProperty('bars90d');
  });

  it('parseMonitorFilter ignores invalid values', () => {
    const q: Record<string, string> = {
      status: 'down,bogus',
      tier: 'x',
      q: '  PhilHealth ',
    };
    const f = parseMonitorFilter((k) => q[k]);
    expect([...(f.status ?? [])]).toEqual(['down']);
    expect(f.tier).toBeUndefined();
    expect(f.q).toBe('philhealth');
  });

  it('filterMonitors matches q, category and tier', () => {
    const base = {
      department: null,
      source: 'curated' as const,
      lastCheckedAt: null,
      lastHttpStatus: null,
      lastResponseMs: null,
      lastError: null,
      lastColo: null,
      uptime24h: null,
      avgMs24h: null,
      freshness: {
        enabled: false,
        status: 'unknown' as const,
        signalSource: null,
        contentUpdatedAt: null,
        lastChangedAt: null,
        lastCheckedAt: null,
        changeCount30d: 0,
        changeCount90d: 0,
        probeError: null,
      },
      bars90d: [],
      hourly24h: [],
    };
    const list = [
      {
        ...base,
        slug: 'a',
        name: 'PhilHealth Member Portal',
        agency: 'PhilHealth',
        category: 'health',
        url: 'https://a',
        tier: 'critical' as const,
        status: 'up' as const,
      },
      {
        ...base,
        slug: 'b',
        name: 'BIR eFPS',
        agency: 'BIR',
        category: 'tax-revenue',
        url: 'https://b',
        tier: 'standard' as const,
        status: 'down' as const,
      },
    ];
    expect(
      filterMonitors(list, { q: 'philhealth' }).map((m) => m.slug)
    ).toEqual(['a']);
    expect(
      filterMonitors(list, { category: 'tax-revenue' }).map((m) => m.slug)
    ).toEqual(['b']);
    expect(
      filterMonitors(list, { tier: 'critical' }).map((m) => m.slug)
    ).toEqual(['a']);
    expect(toLiteMonitor(list[0])).not.toHaveProperty('bars90d');
  });
});
