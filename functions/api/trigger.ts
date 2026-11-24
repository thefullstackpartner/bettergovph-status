import type { Env } from '../types';
import { jsonResponse } from '../lib/router';
import { runCycle } from '../lib/scheduler';

/**
 * Manual status check trigger for local development (or authorized automation).
 * Disabled unless ALLOW_MANUAL_TRIGGER === 'true' or Bearer TRIGGER_SECRET matches.
 */
export async function onTriggerRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const allowLocal = env.ALLOW_MANUAL_TRIGGER === 'true';
  const authHeader = request.headers.get('Authorization');
  const validSecret =
    Boolean(env.TRIGGER_SECRET) &&
    authHeader === `Bearer ${env.TRIGGER_SECRET}`;

  if (!allowLocal && !validSecret) {
    return jsonResponse(
      { error: 'Manual trigger is disabled' },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const rawTier = url.searchParams.get('tier');
  const tier =
    rawTier === 'critical' || rawTier === 'standard' || rawTier === 'all'
      ? rawTier
      : 'critical';
  const rawLimit = Number(url.searchParams.get('limit') ?? '0');
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
  const rawOffset = Number(url.searchParams.get('offset') ?? '0');
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  const result = await runCycle(env, { tier, limit, offset });
  return jsonResponse({ ok: true, ...result });
}
