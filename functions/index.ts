import { Hono } from 'hono';
import { onDashboardRequest } from './api/dashboard';
import { onMonitorHistoryRequest } from './api/history';
import { onIncidentsRequest } from './api/incidents';
import { onMonitorDetailRequest, onMonitorsRequest } from './api/monitors';
import { onSummaryRequest } from './api/summary';
import { onTriggerRequest } from './api/trigger';
import {
  corsMiddleware,
  rateLimitMiddleware,
  rejectDisallowedOrigin,
  requireSupabaseEnv,
} from './lib/request-security';
import {
  processBatch,
  processFreshnessBatch,
  runCycle,
  runFreshnessCycle,
} from './lib/scheduler';
import {
  pruneOldChecks,
  pruneOldDailyStats,
  pruneOldFreshnessEvents,
} from './lib/supabase';
import type { BatchMessage, Env } from './types';

export const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.use('*', rejectDisallowedOrigin);
app.use('*', corsMiddleware);
app.use('*', rateLimitMiddleware);
app.use('*', requireSupabaseEnv);

app.get('/summary', onSummaryRequest);
app.get('/dashboard', onDashboardRequest);
app.get('/monitors', onMonitorsRequest);
app.get('/monitors/:slug{[a-z0-9-]+}', onMonitorDetailRequest);
app.get('/monitors/:slug{[a-z0-9-]+}/history', onMonitorHistoryRequest);
app.get('/incidents', onIncidentsRequest);
app.post('/trigger', onTriggerRequest);

app.notFound(c => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('[api]', err.message);
  return c.json({ error: 'Internal server error' }, 500);
});

export type AppType = typeof app;

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[scheduled] Supabase secrets not configured; skipping.');
      return;
    }

    if (controller.cron === '15 16 * * *') {
      ctx.waitUntil(
        Promise.all([
          pruneOldChecks(env, 30),
          pruneOldDailyStats(env, 365),
          pruneOldFreshnessEvents(env, 180),
        ]).then(([deletedChecks, deletedDaily, deletedFreshness]) =>
          console.log(
            `[prune] Deleted ${deletedChecks} raw checks (>30d), ${deletedDaily} daily stats (>365d), and ${deletedFreshness} freshness events (>180d)`
          )
        )
      );
      return;
    }

    if (controller.cron === '0 */6 * * *') {
      ctx.waitUntil(runFreshnessCycle(env));
      return;
    }

    ctx.waitUntil(runCycle(env));
  },

  async queue(batch: MessageBatch<BatchMessage>, env: Env): Promise<void> {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[queue] Supabase secrets not configured; dropping batch.');
      return;
    }
    for (const msg of batch.messages) {
      if (msg.body.kind === 'freshness') {
        await processFreshnessBatch(msg.body.slugs, env);
      } else {
        await processBatch(msg.body.slugs, env);
      }
      msg.ack();
    }
  },

  fetch: app.fetch,
} satisfies ExportedHandler<Env, BatchMessage>;
