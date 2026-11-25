import { categories, enabledMonitors } from '../lib/monitors';
import {
  type AppContext,
  REPO_RAW_BRANCH_URL,
  REPO_URL,
  SITE_NAME,
  TEXT_HEADERS,
  categoryName,
  getSiteUrl,
  mdTable,
  siteStats,
} from './site';

function intro(): string {
  const s = siteStats();
  return `# ${SITE_NAME}

> Volunteer-run, open-source uptime, latency and content-freshness monitor for ${s.total} Philippine government websites and online services across ${s.categories} categories. ${s.critical} high-traffic citizen portals (BIR, SSS, PhilHealth, Pag-IBIG, PSA, DFA, LTO, eGovPH, …) are checked every 5 minutes; ${s.standard} agency, SUC and embassy sites every 15 minutes, from Cloudflare's edge. All data is public, read-only and needs no authentication.

Key facts for agents:

- Monitor statuses: \`up\` (operational), \`degraded\` (slow response > 3 s, or \`lastError: "waf_403"\` = probe blocked by the site's firewall — the site may still work in a browser), \`down\` (timeout, DNS/TLS/connection failure, HTTP error, maintenance page), \`unknown\` (no data yet).
- A monitor flips to \`down\` on the 1st failed check; an incident opens after 2 consecutive \`down\` checks and resolves after 2 consecutive non-down checks.
- Timestamps are ISO-8601 UTC. Daily rollups use Asia/Manila calendar days.
- Every monitor has a stable \`slug\` (e.g. \`bir-orus\`); use it with the per-monitor endpoints.
- Prefer the Markdown endpoints for reading and \`view=lite\` for JSON — the full \`/api/summary\` payload is large.
- Rate limit: 120 requests / minute / IP. Responses are edge-cached for ~60 s, so polling faster than once a minute is pointless.
- When citing data, attribute "${SITE_NAME}" and link the monitor page \`/monitors/{slug}\`.`;
}

export function buildLlmsTxt(site: string): string {
  return `${intro()}

## Live status (Markdown, token-friendly)

- [Overall status](${site}/status.md): headline counts, every monitor that is currently down/degraded, open incidents, stale content
- [Incidents](${site}/api/incidents.md): recent outage incidents; \`?status=open\` for ongoing only, \`?page=N\` to paginate
- [Monitor detail](${site}/api/monitors/{slug}.md): one service — current status, 24h uptime, 14-day history, recent incidents, content freshness

## JSON API

- [OpenAPI 3.1 specification](${site}/api/openapi.json): machine-readable contract for every public endpoint (use for tool/function calling)
- [Monitors (lite, filterable)](${site}/api/monitors?view=lite): current status of all monitors; filter with \`status=down,degraded\`, \`category=health\`, \`tier=critical\`, \`q=philhealth\`
- [Monitor detail](${site}/api/monitors/{slug}): one monitor with 90-day bars, recent incidents and freshness events
- [Monitor history](${site}/api/monitors/{slug}/history?range=24h): raw check points (\`24h\`, \`7d\`, \`30d\`) or daily rollups (\`90d\`)
- [Incidents](${site}/api/incidents?status=open): paginated incident list (25 per page)
- [Dashboard analytics](${site}/api/dashboard?range=30d): availability KPIs, category performance and leaderboards (\`7d\`, \`30d\`, \`90d\`, \`1y\`; \`tier=all|critical|standard\`)
- [Full summary](${site}/api/summary): complete snapshot incl. 90-day and 24-hour bars for every monitor (large)

## Data & definitions

- [Full LLM context](${site}/llms-full.txt): this file plus field dictionary, categories and the complete monitor catalog
- [Monitor definitions schema](${REPO_RAW_BRANCH_URL}/src/data/schema/monitors.schema.json): JSON Schema for monitor data files
- [Category taxonomy](${REPO_RAW_BRANCH_URL}/src/data/categories.json): category slugs and descriptions

## Optional

- [About & methodology](${site}/about): how checks, statuses, WAF detection and freshness work
- [Source code](${REPO_URL}): GitHub repository (monitor definitions are data-as-code; suggest new portals via issues)
- [Sitemap](${site}/sitemap.xml): all human-facing pages
`;
}

function fieldDictionary(): string {
  return `## Field dictionary (monitor objects)

| Field | Type | Meaning |
| --- | --- | --- |
| \`slug\` | string | Stable unique id (\`^[a-z0-9-]+$\`) |
| \`name\` / \`agency\` / \`department\` | string | Service name, operating agency, parent department |
| \`category\` | string | Category slug (see table below) |
| \`url\` | string | URL that is probed |
| \`tier\` | \`critical\` \\| \`standard\` | Checked every 5 min / 15 min |
| \`source\` | \`curated\` \\| \`bettergov-websites\` | Hand-curated or imported from the BetterGov.ph directory |
| \`status\` | \`up\` \\| \`degraded\` \\| \`down\` \\| \`unknown\` | Result of the latest check |
| \`lastCheckedAt\` | ISO datetime \\| null | Time of the latest check |
| \`lastHttpStatus\` | number \\| null | HTTP status of the latest check |
| \`lastResponseMs\` | number \\| null | Latency of the latest check |
| \`lastError\` | string \\| null | Cause code of the latest non-up check (see causes) |
| \`lastColo\` | string \\| null | Cloudflare data center (IATA code) that ran the check |
| \`uptime24h\` | number \\| null | % of checks in the last 24h that were not down |
| \`avgMs24h\` | number \\| null | Mean latency over 24h |
| \`freshness.status\` | \`fresh\` \\| \`stale\` \\| \`unknown\` | Content updated within \`freshnessStaleDays\` (default 30)? Only for freshness-enabled portals |
| \`freshness.contentUpdatedAt\` / \`lastChangedAt\` | ISO datetime \\| null | Last detected content update / content change |
| \`bars90d[]\` | array | Daily rollups (Asia/Manila): \`total\`, \`up\`, \`degraded\`, \`waf\`, \`down\`, \`avgMs\` |
| \`hourly24h[]\` | array | Hourly rollups for the last 24h, same shape |

## Cause codes (\`lastError\`, incident \`cause\`)

| Code | Meaning |
| --- | --- |
| \`not_found\` | HTTP 404 — page moved or removed |
| \`unexpected_status\` / \`http_<code>\` | Other failing HTTP status (4xx/5xx) |
| \`maintenance\` | Page shows a maintenance notice |
| \`keyword_missing\` | Page loaded but expected content missing |
| \`timeout\` | No response within 15 s |
| \`dns\` | Domain could not be resolved |
| \`tls\` / \`tls_error\` | TLS handshake or certificate error |
| \`connect\` / \`fetch_error\` | Network connection failed |
| \`invalid_http_header\` | Malformed HTTP response |
| \`waf_403\` | Firewall/bot challenge blocked the probe (status \`degraded\`, not down) |
`;
}

export function buildLlmsFullTxt(site: string): string {
  const countByCategory = new Map<string, number>();
  for (const m of enabledMonitors) {
    countByCategory.set(m.category, (countByCategory.get(m.category) ?? 0) + 1);
  }

  const categoryTable = mdTable(
    ['Slug', 'Name', 'Monitors', 'Description'],
    categories.map((c) => [
      `\`${c.slug}\``,
      c.name,
      countByCategory.get(c.slug) ?? 0,
      c.description,
    ])
  );

  const sorted = [...enabledMonitors].sort(
    (a, b) =>
      (a.tier === b.tier ? 0 : a.tier === 'critical' ? -1 : 1) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name)
  );

  const catalog = mdTable(
    ['Slug', 'Name', 'Agency', 'Category', 'Tier', 'URL'],
    sorted.map((m) => [
      m.slug,
      m.name,
      m.agency,
      categoryName(m.category),
      m.tier,
      m.url,
    ])
  );

  return `${buildLlmsTxt(site)}
---

${fieldDictionary()}
## Categories

${categoryTable}

## Example requests

\`\`\`http
GET ${site}/status.md
GET ${site}/api/monitors?view=lite&status=down
GET ${site}/api/monitors?view=lite&q=philhealth
GET ${site}/api/monitors/{slug}.md
GET ${site}/api/monitors/{slug}/history?range=7d
GET ${site}/api/incidents?status=open
\`\`\`

## Monitor catalog (${sorted.length} enabled monitors)

Live status for any row: \`${site}/api/monitors/{slug}.md\` (Markdown) or \`${site}/api/monitors/{slug}\` (JSON).

${catalog}
`;
}

export function onLlmsTxtRequest(c: AppContext) {
  return c.body(buildLlmsTxt(getSiteUrl(c)), 200, TEXT_HEADERS);
}

export function onLlmsFullTxtRequest(c: AppContext) {
  return c.body(buildLlmsFullTxt(getSiteUrl(c)), 200, TEXT_HEADERS);
}
