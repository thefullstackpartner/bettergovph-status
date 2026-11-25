import { getMonitorBySlug } from '../lib/monitors';
import { getSummarySnapshot } from '../lib/snapshot';
import {
  fetchAllIncidents,
  fetchMonitorFreshnessEvents,
  fetchMonitorIncidents,
} from '../lib/supabase';
import {
  type AppContext,
  MARKDOWN_HEADERS,
  SITE_NAME,
  categoryName,
  causeLabel,
  formatDuration,
  formatMs,
  formatPct,
  getSiteUrl,
  isWafBlocked,
  mdLink,
  mdTable,
  statusLabel,
} from './site';

const MAX_ROWS = 50;
const INCIDENTS_PAGE_SIZE = 25;

type Snapshot = Awaited<ReturnType<typeof getSummarySnapshot>>;
type SnapshotMonitor = Snapshot['monitors'][number];

function truncatedNote(total: number, shown: number, moreUrl: string): string {
  return total > shown
    ? `\n\n_…and ${total - shown} more — see ${moreUrl}_`
    : '';
}

function monitorRows(site: string, monitors: SnapshotMonitor[]): unknown[][] {
  return monitors.map((m) => [
    mdLink(m.name, `${site}/api/monitors/${m.slug}.md`),
    m.agency,
    categoryName(m.category),
    m.tier,
    m.lastHttpStatus,
    causeLabel(m.lastError),
    formatMs(m.lastResponseMs),
    m.lastCheckedAt,
  ]);
}

const MONITOR_HEADERS = [
  'Service',
  'Agency',
  'Category',
  'Tier',
  'HTTP',
  'Cause',
  'Latency',
  'Last checked (UTC)',
];

function monitorSection(
  site: string,
  title: string,
  monitors: SnapshotMonitor[],
  moreUrl: string,
  emptyText: string
): string {
  if (monitors.length === 0) return `## ${title} (0)\n\n${emptyText}`;
  const shown = monitors.slice(0, MAX_ROWS);
  return `## ${title} (${monitors.length})\n\n${mdTable(
    MONITOR_HEADERS,
    monitorRows(site, shown)
  )}${truncatedNote(monitors.length, shown.length, moreUrl)}`;
}

/** Critical tier first, then by name. */
function byPriority(a: SnapshotMonitor, b: SnapshotMonitor): number {
  if (a.tier !== b.tier) return a.tier === 'critical' ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export function renderStatusMarkdown(
  site: string,
  snapshot: Snapshot,
  openIncidents: Array<{
    monitor_slug: string;
    started_at: string;
    cause: string | null;
  }>
): string {
  const { counts } = snapshot;
  const down = snapshot.monitors
    .filter((m) => m.status === 'down')
    .sort(byPriority);
  const waf = snapshot.monitors.filter(isWafBlocked).sort(byPriority);
  const slow = snapshot.monitors
    .filter((m) => m.status === 'degraded' && !isWafBlocked(m))
    .sort(byPriority);
  const stale = snapshot.monitors
    .filter((m) => m.freshness.enabled && m.freshness.status === 'stale')
    .sort(byPriority);

  const criticalDown = down.filter((m) => m.tier === 'critical').length;
  const headline =
    counts.down === 0
      ? 'All monitored services are reachable.'
      : `${counts.down} service(s) down${criticalDown ? `, including ${criticalDown} critical citizen portal(s)` : ''}.`;

  const countsTable = mdTable(
    ['Metric', 'Value'],
    [
      ['Monitored services', counts.total],
      ['Operational (up)', counts.up],
      ['Degraded — slow', slow.length],
      ['Probe blocked (WAF)', waf.length],
      ['Down', counts.down],
      ['No data yet', counts.unknown],
      ['Open incidents', counts.openIncidents],
      [
        'Content freshness (fresh / stale / monitored)',
        `${counts.fresh} / ${counts.stale} / ${counts.freshnessMonitored}`,
      ],
    ]
  );

  const incidentsSection =
    openIncidents.length === 0
      ? '## Open incidents (0)\n\nNo open incidents.'
      : `## Open incidents (${counts.openIncidents})\n\n${mdTable(
          ['Service', 'Agency', 'Cause', 'Started (UTC)', 'Duration'],
          openIncidents.map((i) => {
            const def = getMonitorBySlug(i.monitor_slug);
            return [
              mdLink(
                def?.name ?? i.monitor_slug,
                `${site}/api/monitors/${i.monitor_slug}.md`
              ),
              def?.agency,
              causeLabel(i.cause),
              i.started_at,
              formatDuration(i.started_at, null),
            ];
          })
        )}${truncatedNote(
          counts.openIncidents,
          openIncidents.length,
          `${site}/api/incidents.md?status=open`
        )}`;

  const staleSection =
    stale.length === 0
      ? ''
      : `\n\n## Stale content (${stale.length})\n\nPortals whose content has not changed in over ${snapshot.freshnessStaleDays} days (uptime is unaffected).\n\n${mdTable(
          ['Service', 'Agency', 'Last content update (UTC)', 'Signal'],
          stale.map((m) => [
            mdLink(m.name, `${site}/api/monitors/${m.slug}.md`),
            m.agency,
            m.freshness.contentUpdatedAt ?? m.freshness.lastChangedAt,
            m.freshness.signalSource,
          ])
        )}`;

  return `# ${SITE_NAME} — Live status

Generated: ${snapshot.generatedAt} (UTC). Data refreshes every 5–15 minutes.

**${headline}**

${countsTable}

${monitorSection(
  site,
  'Down',
  down,
  `${site}/api/monitors?view=lite&status=down`,
  'No services are down.'
)}

${incidentsSection}

${monitorSection(
  site,
  'Degraded — slow responses',
  slow,
  `${site}/api/monitors?view=lite&status=degraded`,
  'No slow services.'
)}

${monitorSection(
  site,
  'Probe blocked by firewall (WAF)',
  waf,
  `${site}/api/monitors?view=lite&status=degraded`,
  'No probes blocked.'
)}

_WAF-blocked portals reject our automated probe (HTTP 403); they may still work normally in a browser._${staleSection}

## More

- Any service: ${site}/api/monitors/{slug}.md (slugs listed in ${site}/llms-full.txt)
- Search: ${site}/api/monitors?view=lite&q={text}
- Incidents: ${site}/api/incidents.md
- API spec: ${site}/api/openapi.json
- Human UI: ${site}/status
`;
}

export async function onStatusMarkdownRequest(c: AppContext) {
  const [snapshot, open] = await Promise.all([
    getSummarySnapshot(c.env),
    fetchAllIncidents(c.env, 'open', 1, MAX_ROWS),
  ]);
  return c.body(
    renderStatusMarkdown(getSiteUrl(c), snapshot, open.items),
    200,
    MARKDOWN_HEADERS
  );
}

export async function onIncidentsMarkdownRequest(c: AppContext) {
  const site = getSiteUrl(c);
  const status = c.req.query('status') === 'open' ? 'open' : 'all';
  const page = Math.max(1, Number(c.req.query('page') ?? '1') || 1);
  const { items, total } = await fetchAllIncidents(
    c.env,
    status,
    page,
    INCIDENTS_PAGE_SIZE
  );
  const pages = Math.max(1, Math.ceil(total / INCIDENTS_PAGE_SIZE));

  const table =
    items.length === 0
      ? 'No incidents.'
      : mdTable(
          [
            'Service',
            'Agency',
            'Cause',
            'Started (UTC)',
            'Resolved (UTC)',
            'Duration',
          ],
          items.map((i) => {
            const def = getMonitorBySlug(i.monitor_slug);
            return [
              mdLink(
                def?.name ?? i.monitor_slug,
                `${site}/api/monitors/${i.monitor_slug}.md`
              ),
              def?.agency,
              causeLabel(i.cause),
              i.started_at,
              i.resolved_at ?? 'ongoing',
              formatDuration(i.started_at, i.resolved_at),
            ];
          })
        );

  const base = `${site}/api/incidents.md?status=${status}`;
  const nav = [
    page > 1 ? `[← Previous](${base}&page=${page - 1})` : '',
    page < pages ? `[Next →](${base}&page=${page + 1})` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const body = `# ${SITE_NAME} — ${status === 'open' ? 'Open incidents' : 'Incidents'}

${total} incident(s) total · page ${page} of ${pages}. An incident opens after 2 consecutive failed checks and resolves after 2 consecutive successful checks.

${table}
${nav ? `\n${nav}\n` : ''}
JSON: ${site}/api/incidents?status=${status}&page=${page}
`;
  return c.body(body, 200, MARKDOWN_HEADERS);
}

export function renderMonitorMarkdown(
  site: string,
  m: SnapshotMonitor,
  freshnessStaleDays: number,
  incidents: Array<{
    started_at: string;
    resolved_at: string | null;
    cause: string | null;
  }>,
  freshnessEvents: Array<{
    detected_at: string;
    signal_source: string;
    content_updated_at: string | null;
  }>
): string {
  const facts = mdTable(
    ['Field', 'Value'],
    [
      ['Status', `**${statusLabel(m.status, m.lastError)}** (\`${m.status}\`)`],
      ['Agency', m.agency],
      ['Department', m.department],
      ['Category', `${categoryName(m.category)} (\`${m.category}\`)`],
      ['URL', m.url],
      [
        'Tier',
        `${m.tier} (checked every ${m.tier === 'critical' ? '5' : '15'} min)`,
      ],
      ['Last checked (UTC)', m.lastCheckedAt],
      ['Last HTTP status', m.lastHttpStatus],
      ['Last latency', formatMs(m.lastResponseMs)],
      ['Last cause', causeLabel(m.lastError)],
      ['Checked from (Cloudflare colo)', m.lastColo],
      ['Uptime, last 24h', formatPct(m.uptime24h)],
      ['Avg latency, last 24h', formatMs(m.avgMs24h)],
    ]
  );

  const recentDays = m.bars90d.slice(-14).reverse();
  const daily =
    recentDays.length === 0
      ? 'No daily data yet.'
      : mdTable(
          [
            'Day (Asia/Manila)',
            'Checks',
            'Up',
            'Slow',
            'WAF',
            'Down',
            'Availability',
            'Avg latency',
          ],
          recentDays.map((d) => [
            d.day,
            d.total,
            d.up,
            Math.max(0, d.degraded - (d.waf ?? 0)),
            d.waf ?? 0,
            d.down,
            d.total > 0
              ? `${Math.round(((d.total - d.down) / d.total) * 10000) / 100}%`
              : '—',
            formatMs(d.avgMs),
          ])
        );

  const incidentTable =
    incidents.length === 0
      ? 'No recorded incidents.'
      : mdTable(
          ['Started (UTC)', 'Resolved (UTC)', 'Duration', 'Cause'],
          incidents.map((i) => [
            i.started_at,
            i.resolved_at ?? 'ongoing',
            formatDuration(i.started_at, i.resolved_at),
            causeLabel(i.cause),
          ])
        );

  let freshness = '';
  if (m.freshness.enabled) {
    const f = m.freshness;
    freshness = `\n## Content freshness\n\n${mdTable(
      ['Field', 'Value'],
      [
        [
          'Status',
          `${f.status} (stale after ${freshnessStaleDays} days without updates)`,
        ],
        ['Last content update (UTC)', f.contentUpdatedAt],
        ['Last detected change (UTC)', f.lastChangedAt],
        ['Last freshness check (UTC)', f.lastCheckedAt],
        ['Signal source', f.signalSource],
        [
          'Changes in last 30 / 90 days',
          `${f.changeCount30d} / ${f.changeCount90d}`,
        ],
        ['Probe error', f.probeError],
      ]
    )}\n${
      freshnessEvents.length
        ? `\nRecent content changes:\n\n${mdTable(
            ['Detected (UTC)', 'Content updated (UTC)', 'Signal'],
            freshnessEvents
              .slice(0, 10)
              .map((e) => [
                e.detected_at,
                e.content_updated_at,
                e.signal_source,
              ])
          )}\n`
        : ''
    }`;
  }

  return `# ${m.name} — ${statusLabel(m.status, m.lastError)}

Source: ${SITE_NAME} · slug \`${m.slug}\` · page ${site}/monitors/${m.slug}

${facts}

## Last 14 days

${daily}

## Recent incidents

${incidentTable}
${freshness}
## More

- JSON: ${site}/api/monitors/${m.slug}
- Check history: ${site}/api/monitors/${m.slug}/history?range=24h (also \`7d\`, \`30d\`, \`90d\`)
- Overall status: ${site}/status.md
`;
}

export async function onMonitorMarkdownRequest(c: AppContext) {
  const slug = (c.req.param('slug') ?? '').replace(/\.md$/, '');
  if (!getMonitorBySlug(slug)) {
    return c.body(
      `# Monitor not found\n\nNo monitor with slug \`${slug}\`. See ${getSiteUrl(c)}/llms-full.txt for all slugs.\n`,
      404,
      {
        'Content-Type': 'text/markdown; charset=utf-8',
      }
    );
  }

  const [snapshot, incidents, freshnessEvents] = await Promise.all([
    getSummarySnapshot(c.env),
    fetchMonitorIncidents(c.env, slug, 20),
    fetchMonitorFreshnessEvents(c.env, slug, 20),
  ]);
  const monitor = snapshot.monitors.find((m) => m.slug === slug);
  if (!monitor) {
    return c.body(
      `# Monitor disabled\n\nMonitor \`${slug}\` is currently not being checked.\n`,
      404,
      {
        'Content-Type': 'text/markdown; charset=utf-8',
      }
    );
  }

  return c.body(
    renderMonitorMarkdown(
      getSiteUrl(c),
      monitor,
      snapshot.freshnessStaleDays,
      incidents,
      freshnessEvents
    ),
    200,
    MARKDOWN_HEADERS
  );
}
