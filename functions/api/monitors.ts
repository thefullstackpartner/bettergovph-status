import type { Context } from 'hono';
import type { Env } from '../types';
import { getMonitorBySlug } from '../lib/monitors';
import { getSummarySnapshot } from '../lib/snapshot';
import {
  fetchMonitorFreshnessEvents,
  fetchMonitorIncidents,
} from '../lib/supabase';

export async function onMonitorsRequest(c: Context<{ Bindings: Env }>) {
  const snapshot = await getSummarySnapshot(c.env);
  return c.json(
    { generatedAt: snapshot.generatedAt, monitors: snapshot.monitors },
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

  const monitor = snapshot.monitors.find(m => m.slug === slug);
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
