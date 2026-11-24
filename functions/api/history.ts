import type { Env } from '../types';
import { getMonitorBySlug } from '../lib/monitors';
import { jsonResponse } from '../lib/router';
import { fetchMonitorHistory } from '../lib/supabase';

const VALID_RANGES = new Set(['24h', '7d', '30d', '90d']);

export async function onMonitorHistoryRequest(
  request: Request,
  env: Env,
  slug: string
): Promise<Response> {
  if (!getMonitorBySlug(slug)) {
    return jsonResponse({ error: 'Monitor not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const rawRange = url.searchParams.get('range') ?? '24h';
  const range = (VALID_RANGES.has(rawRange) ? rawRange : '24h') as
    | '24h'
    | '7d'
    | '30d'
    | '90d';

  const history = await fetchMonitorHistory(env, slug, range);
  return jsonResponse(
    { slug, range, ...history },
    { cacheControl: 'public, max-age=60, s-maxage=300' }
  );
}
