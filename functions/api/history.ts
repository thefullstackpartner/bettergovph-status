import type { Context } from 'hono';
import type { Env } from '../types';
import { getMonitorBySlug } from '../lib/monitors';
import { fetchMonitorHistory } from '../lib/supabase';

const VALID_RANGES = new Set(['24h', '7d', '30d', '90d']);

export async function onMonitorHistoryRequest(c: Context<{ Bindings: Env }>) {
  const slug = c.req.param('slug') ?? '';
  if (!getMonitorBySlug(slug)) {
    return c.json({ error: 'Monitor not found' }, 404);
  }

  const rawRange = c.req.query('range') ?? '24h';
  const range = (VALID_RANGES.has(rawRange) ? rawRange : '24h') as
    | '24h'
    | '7d'
    | '30d'
    | '90d';

  const history = await fetchMonitorHistory(c.env, slug, range);
  return c.json({ slug, range, ...history }, 200, {
    'Cache-Control': 'public, max-age=60, s-maxage=300',
  });
}
