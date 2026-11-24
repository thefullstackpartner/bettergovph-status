import { runners } from '../checks';
import type { CheckResult, Env, MonitorDefinition } from '../types';
import { enabledMonitors, getMonitorBySlug } from './monitors';
import { recordChecks } from './supabase';

export const BATCH_SIZE = 20;

export function selectDueMonitors(
  monitors: MonitorDefinition[],
  now = new Date(),
  tierFilter?: 'critical' | 'standard' | 'all'
): MonitorDefinition[] {
  if (tierFilter === 'all') return monitors;
  if (tierFilter === 'critical' || tierFilter === 'standard') {
    return monitors.filter(m => m.tier === tierFilter);
  }
  const minute = now.getUTCMinutes();
  const includeStandard = minute % 15 === 0;
  return monitors.filter(m => m.tier === 'critical' || includeStandard);
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function processBatch(
  slugs: string[],
  env: Env,
  colo: string | null = null
): Promise<CheckResult[]> {
  const userAgent =
    env.USER_AGENT ??
    'bettergovph-status/1.0 (+https://bettergovph-status.workers.dev/about)';

  const monitors = slugs
    .map(slug => getMonitorBySlug(slug))
    .filter((m): m is MonitorDefinition => m !== undefined);

  const settled = await Promise.allSettled(
    monitors.map(m => runners[m.type](m, { userAgent, colo }))
  );

  const results: CheckResult[] = settled.map((res, idx) => {
    if (res.status === 'fulfilled') return res.value;
    return {
      monitor_slug: monitors[idx].slug,
      checked_at: new Date().toISOString(),
      status: 'down',
      http_status: null,
      response_ms: 0,
      error: 'connect',
      colo,
    };
  });

  await recordChecks(env, results);
  return results;
}

export async function runCycle(
  env: Env,
  options: {
    tier?: 'critical' | 'standard' | 'all';
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  mode: 'queue' | 'inline';
  scheduledCount: number;
  totalDue: number;
  batches: number;
}> {
  const allDue = selectDueMonitors(enabledMonitors, new Date(), options.tier);
  const offset = Math.max(0, options.offset ?? 0);
  let due = offset > 0 ? allDue.slice(offset) : allDue;
  if (options.limit && options.limit > 0) {
    due = due.slice(0, options.limit);
  }

  const batches = chunkArray(
    due.map(m => m.slug),
    BATCH_SIZE
  );

  if (env.CHECK_QUEUE) {
    await env.CHECK_QUEUE.sendBatch(
      batches.map(slugs => ({ body: { slugs } }))
    );
    return {
      mode: 'queue',
      scheduledCount: due.length,
      totalDue: allDue.length,
      batches: batches.length,
    };
  }

  // Inline fallback for local dev or when CHECK_QUEUE is not bound.
  // Cap at 1 batch (20 monitors) to stay under the free 50-subrequest limit.
  const firstBatch = batches[0] ?? [];
  if (firstBatch.length > 0) {
    await processBatch(firstBatch, env);
  }
  return {
    mode: 'inline',
    scheduledCount: firstBatch.length,
    totalDue: allDue.length,
    batches: firstBatch.length > 0 ? 1 : 0,
  };
}
