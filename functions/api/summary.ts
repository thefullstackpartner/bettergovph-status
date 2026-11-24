import type { Env } from '../types';
import { jsonResponse } from '../lib/router';
import { getSummarySnapshot } from '../lib/snapshot';

export async function onSummaryRequest(env: Env): Promise<Response> {
  const snapshot = await getSummarySnapshot(env);
  return jsonResponse(snapshot, {
    cacheControl: 'public, max-age=30, s-maxage=60',
  });
}
