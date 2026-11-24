import type { Env } from '../types';
import { getMonitorBySlug } from '../lib/monitors';
import { jsonResponse } from '../lib/router';
import { fetchAllIncidents } from '../lib/supabase';

export async function onIncidentsRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') === 'open' ? 'open' : 'all';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const { items, total } = await fetchAllIncidents(env, status, page, 25);
  const enriched = items.map(item => {
    const def = getMonitorBySlug(item.monitor_slug);
    return {
      ...item,
      monitor_name: def?.name ?? item.monitor_slug,
      agency: def?.agency ?? '',
    };
  });

  return jsonResponse(
    { items: enriched, total, page, pageSize: 25 },
    { cacheControl: 'public, max-age=30, s-maxage=60' }
  );
}
