import type { Context } from 'hono';
import { categories, enabledMonitors } from '../lib/monitors';
import type { Env } from '../types';

export type AppContext = Context<{ Bindings: Env }>;

export const SITE_NAME = 'BetterGovPH Status';
export const REPO_URL =
  'https://github.com/thefullstackpartner/bettergovph-status';
export const REPO_RAW_BRANCH_URL = `${REPO_URL}/blob/main`;

export const TEXT_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
};

export const MARKDOWN_HEADERS = {
  'Content-Type': 'text/markdown; charset=utf-8',
  'Cache-Control': 'public, max-age=30, s-maxage=60',
};

/** Canonical site URL: `SITE_URL` var, or the request origin when unset. */
export function getSiteUrl(c: AppContext): string {
  const configured = c.env?.SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(c.req.url).origin;
}

export const categoryNameBySlug = new Map(
  categories.map((cat) => [cat.slug, cat.name])
);

export function categoryName(slug: string): string {
  return categoryNameBySlug.get(slug) ?? slug;
}

export function siteStats() {
  const critical = enabledMonitors.filter((m) => m.tier === 'critical').length;
  const freshness = enabledMonitors.filter((m) => m.freshnessEnabled).length;
  return {
    total: enabledMonitors.length,
    critical,
    standard: enabledMonitors.length - critical,
    freshness,
    categories: categories.length,
  };
}

const CAUSE_LABELS: Record<string, string> = {
  not_found: 'Page not found (HTTP 404)',
  unexpected_status: 'Unexpected HTTP error',
  maintenance: 'Under maintenance',
  maintenance_scheduled: 'Scheduled maintenance',
  keyword_missing: 'Expected content missing',
  timeout: 'Request timed out',
  dns: 'DNS resolution failed',
  tls: 'TLS / SSL error',
  tls_error: 'TLS / SSL error',
  connect: 'Connection failed',
  fetch_error: 'Network / fetch error',
  invalid_http_header: 'Malformed HTTP response',
  waf_403: 'Probe blocked (WAF 403)',
  down: 'Service unreachable',
  unknown: 'Unspecified failure',
};

export function causeLabel(code: string | null | undefined): string {
  if (!code) return '';
  const known = CAUSE_LABELS[code];
  if (known) return `${known} (\`${code}\`)`;
  const http = code.match(/^http_(\d{3})$/);
  if (http) return `HTTP ${http[1]} (\`${code}\`)`;
  return `\`${code}\``;
}

export function statusLabel(
  status: 'up' | 'degraded' | 'down' | 'unknown',
  error?: string | null
): string {
  if (status === 'degraded' && error === 'waf_403')
    return 'Probe blocked (WAF)';
  if (status === 'degraded' && error === 'maintenance_scheduled')
    return 'Scheduled maintenance';
  switch (status) {
    case 'up':
      return 'Operational';
    case 'degraded':
      return 'Degraded (slow)';
    case 'down':
      return 'Down';
    default:
      return 'No data';
  }
}

export function isWafBlocked(m: {
  status: string;
  lastError: string | null;
}): boolean {
  return m.status === 'degraded' && m.lastError === 'waf_403';
}

/** Escape a value for use inside a Markdown table cell. */
export function mdCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

export function mdTable(headers: string[], rows: unknown[][]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`);
  return [head, sep, ...body].join('\n');
}

/** Markdown link whose label and URL are already trusted (no escaping of URL). */
export function mdLink(label: string, url: string): string {
  return `[${label.replace(/[[\]]/g, '')}](${url})`;
}

export function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value}%`;
}

export function formatMs(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value} ms`;
}

export function formatDuration(
  startIso: string,
  endIso: string | null
): string {
  const end = endIso ? Date.parse(endIso) : Date.now();
  const minutes = Math.max(
    0,
    Math.round((end - Date.parse(startIso)) / 60_000)
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
