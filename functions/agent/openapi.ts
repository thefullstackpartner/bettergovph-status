import {
  type AppContext,
  REPO_URL,
  SITE_NAME,
  getSiteUrl,
  siteStats,
} from './site';

type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const respRef = (name: string): Schema => ({
  $ref: `#/components/responses/${name}`,
});
const nullable = (type: string, extra: Schema = {}): Schema => ({
  type: [type, 'null'],
  ...extra,
});

const slugParam = {
  name: 'slug',
  in: 'path',
  required: true,
  description:
    'Stable monitor id, e.g. `bir-orus`. Full list in /llms-full.txt or GET /api/monitors?view=lite.',
  schema: { type: 'string', pattern: '^[a-z0-9-]+$' },
};

const statusEnum = ['up', 'degraded', 'down', 'unknown'];

const bar = (timeField: 'day' | 'hour'): Schema => ({
  type: 'object',
  required: [timeField, 'total', 'up', 'degraded', 'down', 'avgMs'],
  properties: {
    [timeField]: {
      type: 'string',
      description:
        timeField === 'day'
          ? 'Calendar day (YYYY-MM-DD, Asia/Manila)'
          : 'Hour bucket start (ISO-8601)',
    },
    total: { type: 'integer' },
    up: { type: 'integer' },
    degraded: { type: 'integer', description: 'Includes WAF-blocked checks' },
    waf: { type: 'integer', description: 'Checks blocked by a WAF (HTTP 403)' },
    down: { type: 'integer' },
    avgMs: { type: 'integer' },
  },
});

const monitorLiteProperties: Record<string, Schema> = {
  slug: { type: 'string' },
  name: { type: 'string' },
  agency: { type: 'string' },
  department: nullable('string'),
  category: { type: 'string', description: 'Category slug' },
  url: { type: 'string', format: 'uri' },
  tier: {
    type: 'string',
    enum: ['critical', 'standard'],
    description: 'critical = checked every 5 min, standard = every 15 min',
  },
  source: { type: 'string', enum: ['curated', 'bettergov-websites'] },
  status: {
    type: 'string',
    enum: statusEnum,
    description:
      'Latest check result. `degraded` with lastError `waf_403` means the probe was blocked by a firewall (the site may still work in a browser).',
  },
  lastCheckedAt: nullable('string', { format: 'date-time' }),
  lastHttpStatus: nullable('integer'),
  lastResponseMs: nullable('integer'),
  lastError: nullable('string', {
    description:
      'Cause code: not_found, unexpected_status, http_<code>, maintenance, keyword_missing, timeout, dns, tls, connect, invalid_http_header, waf_403',
  }),
  lastColo: nullable('string', {
    description: 'Cloudflare data center IATA code',
  }),
  uptime24h: nullable('number', {
    description: '% of non-down checks in the last 24h',
  }),
  avgMs24h: nullable('number'),
  freshness: ref('MonitorFreshness'),
};

export function buildOpenApiSpec(site: string): Schema {
  const s = siteStats();
  return {
    openapi: '3.1.0',
    info: {
      title: `${SITE_NAME} API`,
      version: '1.0.0',
      summary:
        'Uptime, latency and content freshness of Philippine government websites.',
      description: `Public, read-only API of ${SITE_NAME}: a volunteer-run monitor of ${s.total} Philippine government websites (${s.critical} critical portals checked every 5 minutes, ${s.standard} others every 15 minutes). No authentication. Rate limit 120 requests/minute/IP; responses are edge-cached ~60 s. Timestamps are ISO-8601 UTC; daily rollups use Asia/Manila days. For LLM-friendly text see ${site}/llms.txt and the \`.md\` endpoints.`,
      contact: { name: SITE_NAME, url: REPO_URL },
      license: { name: 'See repository', url: REPO_URL },
    },
    externalDocs: {
      description: 'LLM index (llms.txt)',
      url: `${site}/llms.txt`,
    },
    servers: [{ url: site }],
    tags: [
      { name: 'status', description: 'Current status' },
      { name: 'monitors', description: 'Individual monitored services' },
      { name: 'incidents', description: 'Outage incidents' },
      { name: 'analytics', description: 'Aggregated performance' },
      {
        name: 'markdown',
        description: 'Token-friendly Markdown renderings for LLMs',
      },
    ],
    paths: {
      '/api/monitors': {
        get: {
          operationId: 'listMonitors',
          tags: ['monitors'],
          summary:
            'List and search monitored services with their current status',
          description:
            'Returns every enabled monitor with its latest status. Use `view=lite` to omit the large per-monitor bar arrays, and filters to narrow results. Best starting point for questions like "is PhilHealth down?" (q=philhealth) or "what is down right now?" (status=down).',
          parameters: [
            {
              name: 'view',
              in: 'query',
              description:
                '`lite` omits bars90d and hourly24h (recommended for agents).',
              schema: {
                type: 'string',
                enum: ['full', 'lite'],
                default: 'full',
              },
            },
            {
              name: 'status',
              in: 'query',
              description: 'Comma-separated statuses, e.g. `down,degraded`.',
              schema: { type: 'string', example: 'down,degraded' },
            },
            {
              name: 'category',
              in: 'query',
              description: 'Category slug, e.g. `health`, `tax-revenue`.',
              schema: { type: 'string' },
            },
            {
              name: 'tier',
              in: 'query',
              schema: { type: 'string', enum: ['critical', 'standard'] },
            },
            {
              name: 'q',
              in: 'query',
              description:
                'Case-insensitive text search over name, agency, department, slug and URL.',
              schema: { type: 'string', maxLength: 100 },
            },
          ],
          responses: {
            '200': {
              description: 'Monitors',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['generatedAt', 'count', 'monitors'],
                    properties: {
                      generatedAt: { type: 'string', format: 'date-time' },
                      count: { type: 'integer' },
                      monitors: {
                        type: 'array',
                        items: {
                          oneOf: [ref('MonitorSummary'), ref('MonitorLite')],
                        },
                      },
                    },
                  },
                },
              },
            },
            '429': respRef('TooManyRequests'),
          },
        },
      },
      '/api/monitors/{slug}': {
        get: {
          operationId: 'getMonitor',
          tags: ['monitors'],
          summary:
            'Get one monitor with recent incidents and content-freshness events',
          parameters: [slugParam],
          responses: {
            '200': {
              description: 'Monitor detail',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      monitor: ref('MonitorSummary'),
                      incidents: { type: 'array', items: ref('Incident') },
                      freshnessEvents: {
                        type: 'array',
                        items: ref('FreshnessEvent'),
                      },
                      freshnessStaleDays: { type: 'integer' },
                    },
                  },
                },
              },
            },
            '404': respRef('NotFound'),
          },
        },
      },
      '/api/monitors/{slug}/history': {
        get: {
          operationId: 'getMonitorHistory',
          tags: ['monitors'],
          summary: 'Check history for one monitor',
          description:
            '`24h`, `7d`, `30d` return raw check points (downsampled to ≤200). `90d` returns daily rollups.',
          parameters: [
            slugParam,
            {
              name: 'range',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['24h', '7d', '30d', '90d'],
                default: '24h',
              },
            },
          ],
          responses: {
            '200': {
              description: 'History',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      slug: { type: 'string' },
                      range: { type: 'string' },
                      points: { type: 'array', items: ref('CheckPoint') },
                      daily: { type: 'array', items: ref('DailyBar') },
                    },
                  },
                },
              },
            },
            '404': respRef('NotFound'),
          },
        },
      },
      '/api/incidents': {
        get: {
          operationId: 'listIncidents',
          tags: ['incidents'],
          summary: 'List outage incidents (newest first, 25 per page)',
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['all', 'open'], default: 'all' },
            },
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
            },
          ],
          responses: {
            '200': {
              description: 'Incidents',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: { type: 'array', items: ref('Incident') },
                      total: { type: 'integer' },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/summary': {
        get: {
          operationId: 'getSummary',
          tags: ['status'],
          summary: 'Full status snapshot (large)',
          description:
            'Overall counts, categories and every monitor including 90-day and 24-hour bars. Several hundred KB; prefer /api/monitors?view=lite or /status.md.',
          responses: {
            '200': {
              description: 'Snapshot',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      generatedAt: { type: 'string', format: 'date-time' },
                      freshnessStaleDays: { type: 'integer' },
                      counts: ref('Counts'),
                      categories: { type: 'array', items: ref('Category') },
                      monitors: { type: 'array', items: ref('MonitorSummary') },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/dashboard': {
        get: {
          operationId: 'getDashboard',
          tags: ['analytics'],
          summary:
            'Aggregated availability KPIs, trends, category performance and leaderboards',
          parameters: [
            {
              name: 'range',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['7d', '30d', '90d', '1y'],
                default: '30d',
              },
            },
            {
              name: 'tier',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['all', 'critical', 'standard'],
                default: 'all',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Dashboard analytics',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/status.md': {
        get: {
          operationId: 'getStatusMarkdown',
          tags: ['markdown', 'status'],
          summary: 'Live overall status as Markdown',
          description:
            'Headline counts plus every down / slow / WAF-blocked monitor and open incidents. Compact; ideal for LLM context.',
          responses: { '200': respRef('Markdown') },
        },
      },
      '/api/monitors/{slug}.md': {
        get: {
          operationId: 'getMonitorMarkdown',
          tags: ['markdown', 'monitors'],
          summary:
            'One monitor as Markdown (status, 14-day history, incidents, freshness)',
          parameters: [slugParam],
          responses: { '200': respRef('Markdown'), '404': respRef('Markdown') },
        },
      },
      '/api/incidents.md': {
        get: {
          operationId: 'getIncidentsMarkdown',
          tags: ['markdown', 'incidents'],
          summary: 'Incidents as Markdown',
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['all', 'open'], default: 'all' },
            },
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
            },
          ],
          responses: { '200': respRef('Markdown') },
        },
      },
      '/api/status.md': {
        get: {
          operationId: 'getStatusMarkdownApi',
          tags: ['markdown', 'status'],
          summary: 'Alias of /status.md',
          responses: { '200': respRef('Markdown') },
        },
      },
    },
    components: {
      responses: {
        Markdown: {
          description: 'Markdown document',
          content: { 'text/markdown': { schema: { type: 'string' } } },
        },
        NotFound: {
          description: 'Not found',
          content: { 'application/json': { schema: ref('Error') } },
        },
        TooManyRequests: {
          description:
            'Rate limit exceeded (120/min/IP). Retry after the `Retry-After` header.',
          content: { 'application/json': { schema: ref('Error') } },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: { error: { type: 'string' } },
        },
        Category: {
          type: 'object',
          required: ['slug', 'name', 'description'],
          properties: {
            slug: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
        Counts: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            up: { type: 'integer' },
            degraded: { type: 'integer' },
            down: { type: 'integer' },
            unknown: { type: 'integer' },
            openIncidents: { type: 'integer' },
            freshnessMonitored: { type: 'integer' },
            fresh: { type: 'integer' },
            stale: { type: 'integer' },
          },
        },
        MonitorFreshness: {
          type: 'object',
          description: 'Content freshness (only meaningful when enabled=true).',
          properties: {
            enabled: { type: 'boolean' },
            status: { type: 'string', enum: ['fresh', 'stale', 'unknown'] },
            signalSource: nullable('string', {
              description:
                'api, sitemap, rss, meta, http_header or content_hash',
            }),
            contentUpdatedAt: nullable('string', { format: 'date-time' }),
            lastChangedAt: nullable('string', { format: 'date-time' }),
            lastCheckedAt: nullable('string', { format: 'date-time' }),
            changeCount30d: { type: 'integer' },
            changeCount90d: { type: 'integer' },
            probeError: nullable('string'),
          },
        },
        MonitorLite: {
          type: 'object',
          required: [
            'slug',
            'name',
            'agency',
            'category',
            'url',
            'tier',
            'status',
          ],
          properties: monitorLiteProperties,
        },
        MonitorSummary: {
          type: 'object',
          required: [
            'slug',
            'name',
            'agency',
            'category',
            'url',
            'tier',
            'status',
            'bars90d',
          ],
          properties: {
            ...monitorLiteProperties,
            bars90d: { type: 'array', items: ref('DailyBar') },
            hourly24h: { type: 'array', items: ref('HourlyBar') },
          },
        },
        DailyBar: bar('day'),
        HourlyBar: bar('hour'),
        CheckPoint: {
          type: 'object',
          properties: {
            checked_at: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['up', 'degraded', 'down'] },
            http_status: nullable('integer'),
            response_ms: nullable('integer'),
            error: nullable('string'),
            colo: nullable('string'),
          },
        },
        Incident: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            monitor_slug: { type: 'string' },
            monitor_name: { type: 'string' },
            agency: { type: 'string' },
            started_at: { type: 'string', format: 'date-time' },
            resolved_at: nullable('string', {
              format: 'date-time',
              description: 'null = ongoing',
            }),
            cause: nullable('string'),
          },
        },
        FreshnessEvent: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            monitor_slug: { type: 'string' },
            detected_at: { type: 'string', format: 'date-time' },
            signal_source: { type: 'string' },
            content_updated_at: nullable('string', { format: 'date-time' }),
          },
        },
      },
    },
  };
}

export function onOpenApiRequest(c: AppContext) {
  return c.json(buildOpenApiSpec(getSiteUrl(c)), 200, {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  });
}
