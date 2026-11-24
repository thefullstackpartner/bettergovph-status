import type { Context } from 'hono';
import type { Env } from '../types';
import { runCycle } from '../lib/scheduler';

/**
 * Manual status check trigger for authorized automation.
 * Disabled unless Authorization: Bearer <TRIGGER_SECRET> matches.
 */
export async function onTriggerRequest(c: Context<{ Bindings: Env }>) {
  const authHeader = c.req.header('Authorization');
  const validSecret =
    Boolean(c.env.TRIGGER_SECRET) &&
    authHeader === `Bearer ${c.env.TRIGGER_SECRET}`;

  if (!validSecret) {
    return c.json({ error: 'Manual trigger is disabled' }, 403);
  }

  const rawTier = c.req.query('tier');
  const tier =
    rawTier === 'critical' || rawTier === 'standard' || rawTier === 'all'
      ? rawTier
      : 'critical';
  const rawLimit = Number(c.req.query('limit') ?? '0');
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
  const rawOffset = Number(c.req.query('offset') ?? '0');
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  const result = await runCycle(c.env, { tier, limit, offset });
  return c.json({ ok: true, ...result });
}
