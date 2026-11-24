import type { Env } from '../types';
import { getMonitorBySlug } from '../lib/monitors';
import { jsonResponse } from '../lib/router';
import { getSummarySnapshot } from '../lib/snapshot';
import { fetchMonitorIncidents } from '../lib/supabase';

export async function onMonitorsRequest(env: Env): Promise<Response> {
  const snapshot = await getSummarySnapshot(env);
  return jsonResponse(
    { generatedAt: snapshot.generatedAt, monitors: snapshot.monitors },
    { cacheControl: 'public, max-age=30, s-maxage=60' }
  );
}

export async function onMonitorDetailRequest(
  env: Env,
  slug: string
): Promise<Response> {
  const def = getMonitorBySlug(slug);
  if (!def) {
    return jsonResponse({ error: 'Monitor not found' }, { status: 404 });
  }

  const [snapshot, incidents] = await Promise.all([
    getSummarySnapshot(env),
    fetchMonitorIncidents(env, slug, 20),
  ]);

  const monitor = snapshot.monitors.find(m => m.slug === slug);
  return jsonResponse(
    { monitor, incidents },
    { cacheControl: 'public, max-age=30, s-maxage=60' }
  );
}
