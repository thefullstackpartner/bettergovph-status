import type { Context } from 'hono';
import type { Env } from '../types';
import { getMonitorBySlug } from '../lib/monitors';
import { fetchAllIncidents } from '../lib/supabase';

export async function onIncidentsRequest(c: Context<{ Bindings: Env }>) {
  const status = c.req.query('status') === 'open' ? 'open' : 'all';
  const page = Math.max(1, Number(c.req.query('page') ?? '1') || 1);

  const { items, total } = await fetchAllIncidents(c.env, status, page, 25);
  const enriched = items.map(item => {
    const def = getMonitorBySlug(item.monitor_slug);
    return {
      ...item,
      monitor_name: def?.name ?? item.monitor_slug,
      agency: def?.agency ?? '',
    };
  });

  return c.json({ items: enriched, total, page, pageSize: 25 }, 200, {
    'Cache-Control': 'public, max-age=30, s-maxage=60',
  });
}
