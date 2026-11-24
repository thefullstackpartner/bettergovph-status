import type { Context } from 'hono';
import type { Env } from '../types';
import { getSummarySnapshot } from '../lib/snapshot';

export async function onSummaryRequest(c: Context<{ Bindings: Env }>) {
  const snapshot = await getSummarySnapshot(c.env);
  return c.json(snapshot, 200, {
    'Cache-Control': 'public, max-age=30, s-maxage=60',
  });
}
