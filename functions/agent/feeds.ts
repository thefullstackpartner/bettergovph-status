import { getMonitorBySlug } from '../lib/monitors';
import { fetchAllIncidents, fetchMonitorIncidents } from '../lib/supabase';
import {
  type AppContext,
  SITE_NAME,
  causeLabel,
  getSiteUrl,
} from './site';

export const RSS_HEADERS = {
  'Content-Type': 'application/rss+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=30, s-maxage=60',
};

interface IncidentRow {
  id: number;
  monitor_slug: string;
  started_at: string;
  resolved_at: string | null;
  cause: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function plainCause(code: string | null | undefined): string {
  const label = causeLabel(code);
  return label ? label.replace(/`/g, '') : 'Outage detected';
}

function formatDurationText(startedAt: string, resolvedAt: string | null): string {
  if (!resolvedAt) return 'ongoing';
  const ms = new Date(resolvedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function renderIncidentItem(site: string, item: IncidentRow): string {
  const def = getMonitorBySlug(item.monitor_slug);
  const name = def?.name ?? item.monitor_slug;
  const agency = def?.agency ? ` (${def.agency})` : '';
  const state = item.resolved_at ? 'Resolved' : 'Ongoing';
  const cause = plainCause(item.cause);
  const title = `[${state}] ${name} — ${cause}`;
  const link = `${site}/monitors/${item.monitor_slug}`;
  const pubDate = new Date(item.started_at).toUTCString();
  const duration = formatDurationText(item.started_at, item.resolved_at);
  const resolvedLine = item.resolved_at
    ? ` Resolved: ${item.resolved_at} (duration: ${duration}).`
    : ' Status: ongoing.';
  const description = `${name}${agency}: ${cause}. Started: ${item.started_at}.${resolvedLine}`;

  return [
    '    <item>',
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(`bgovph-incident-${item.id}`)}</guid>`,
    `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
    `      <description>${escapeXml(description)}</description>`,
    '    </item>',
  ].join('\n');
}

/** Build an RSS 2.0 document from incident rows. */
export function renderRssFeed(opts: {
  title: string;
  link: string;
  selfUrl: string;
  description: string;
  site: string;
  items: IncidentRow[];
}): string {
  const lastBuild =
    opts.items.length > 0
      ? new Date(opts.items[0].started_at).toUTCString()
      : new Date().toUTCString();

  const itemsXml = opts.items
    .map((item) => renderIncidentItem(opts.site, item))
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(opts.title)}</title>`,
    `    <link>${escapeXml(opts.link)}</link>`,
    `    <atom:link href="${escapeXml(opts.selfUrl)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(opts.description)}</description>`,
    '    <language>en-ph</language>',
    `    <lastBuildDate>${escapeXml(lastBuild)}</lastBuildDate>`,
    itemsXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

export async function onIncidentsRssRequest(c: AppContext) {
  const status = c.req.query('status') === 'open' ? 'open' : 'all';
  const site = getSiteUrl(c);
  const { items } = await fetchAllIncidents(c.env, status, 1, 50);
  const suffix = status === 'open' ? ' (Ongoing)' : '';
  const selfUrl =
    status === 'open'
      ? `${site}/incidents.rss?status=open`
      : `${site}/incidents.rss`;

  const xml = renderRssFeed({
    title: `${SITE_NAME} — Incidents${suffix}`,
    link: `${site}/incidents`,
    selfUrl,
    description:
      'Outage incidents across monitored Philippine government websites and online portals.',
    site,
    items,
  });

  return c.text(xml, 200, RSS_HEADERS);
}

export async function onMonitorFeedRequest(c: AppContext) {
  const slug = c.req.param('slug') ?? '';
  const def = slug ? getMonitorBySlug(slug) : undefined;
  if (!def) {
    return c.text('Monitor not found', 404);
  }

  const site = getSiteUrl(c);
  const items = await fetchMonitorIncidents(c.env, slug, 50);

  const xml = renderRssFeed({
    title: `${def.name} Incidents — ${SITE_NAME}`,
    link: `${site}/monitors/${slug}`,
    selfUrl: `${site}/api/monitors/${slug}/feed.xml`,
    description: `Outage incident feed for ${def.name} (${def.agency}).`,
    site,
    items,
  });

  return c.text(xml, 200, RSS_HEADERS);
}
