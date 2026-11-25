import type { Context } from 'hono';
import type { Env } from '../types';
import { getMonitorBySlug } from '../lib/monitors';
import {
  filterMonitors,
  parseMonitorFilter,
  toLiteMonitor,
} from '../lib/monitor-filter';
import { getSummarySnapshot } from '../lib/snapshot';
import {
  fetchMonitorFreshnessEvents,
  fetchMonitorIncidents,
} from '../lib/supabase';

/**
 * GET /api/monitors
 * Optional query params (all backwards compatible; no params = full list):
 * - view=lite      drop bars90d/hourly24h arrays
 * - status=a,b     up | degraded | down | unknown
 * - category=slug  category slug
 * - tier=critical|standard
 * - q=text         case-insensitive match on name/agency/department/slug/url
 */
export async function onMonitorsRequest(c: Context<{ Bindings: Env }>) {
  const snapshot = await getSummarySnapshot(c.env);
  const filter = parseMonitorFilter((key) => c.req.query(key));
  const filtered = filterMonitors(snapshot.monitors, filter);
  const monitors =
    c.req.query('view') === 'lite' ? filtered.map(toLiteMonitor) : filtered;

  return c.json(
    { generatedAt: snapshot.generatedAt, count: monitors.length, monitors },
    200,
    { 'Cache-Control': 'public, max-age=30, s-maxage=60' }
  );
}

export async function onMonitorDetailRequest(c: Context<{ Bindings: Env }>) {
  const slug = c.req.param('slug') ?? '';
  const def = getMonitorBySlug(slug);
  if (!def) {
    return c.json({ error: 'Monitor not found' }, 404);
  }

  const [snapshot, incidents, freshnessEvents] = await Promise.all([
    getSummarySnapshot(c.env),
    fetchMonitorIncidents(c.env, slug, 20),
    fetchMonitorFreshnessEvents(c.env, slug, 20),
  ]);

  const monitor = snapshot.monitors.find((m) => m.slug === slug);
  return c.json(
    {
      monitor,
      incidents,
      freshnessEvents,
      freshnessStaleDays: snapshot.freshnessStaleDays,
    },
    200,
    { 'Cache-Control': 'public, max-age=30, s-maxage=60' }
  );
}
