import { Hono } from 'hono';
import type { Context } from 'hono';
import { onLlmsFullTxtRequest, onLlmsTxtRequest } from './agent/llms';
import {
  onIncidentsMarkdownRequest,
  onMonitorMarkdownRequest,
  onStatusMarkdownRequest,
} from './agent/markdown';
import { onOpenApiRequest } from './agent/openapi';
import { onRobotsTxtRequest } from './agent/robots';
import { onSitemapRequest } from './agent/sitemap';
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

type AppEnv = { Bindings: Env };

const notFound = (c: Context<AppEnv>) => c.json({ error: 'Not found' }, 404);
const onError = (err: Error, c: Context<AppEnv>) => {
  console.error('[api]', err.message);
  return c.json({ error: 'Internal server error' }, 500);
};

/** JSON + Markdown API mounted at /api. */
export const api = new Hono<AppEnv>();

// Static, bundled-data routes: must work even when Supabase is not configured.
api.get('/openapi.json', onOpenApiRequest);

// Everything below needs Supabase.
api.use('*', requireSupabaseEnv);

api.get('/summary', onSummaryRequest);
api.get('/dashboard', onDashboardRequest);
api.get('/status.md', onStatusMarkdownRequest);
api.get('/incidents.md', onIncidentsMarkdownRequest);
api.get('/monitors', onMonitorsRequest);
api.get('/monitors/:slug{[a-z0-9-]+\\.md}', onMonitorMarkdownRequest);
api.get('/monitors/:slug{[a-z0-9-]+}', onMonitorDetailRequest);
api.get('/monitors/:slug{[a-z0-9-]+}/history', onMonitorHistoryRequest);
api.get('/incidents', onIncidentsRequest);
api.post('/trigger', onTriggerRequest);

api.notFound(notFound);
api.onError(onError);

/** Root app: agent-discovery files at the site root + /api. */
export const app = new Hono<AppEnv>();

app.use('*', rejectDisallowedOrigin);
app.use('*', corsMiddleware);
app.use('*', rateLimitMiddleware);

app.get('/llms.txt', onLlmsTxtRequest);
app.get('/.well-known/llms.txt', onLlmsTxtRequest);
app.get('/llms-full.txt', onLlmsFullTxtRequest);
app.get('/robots.txt', onRobotsTxtRequest);
app.get('/sitemap.xml', onSitemapRequest);
app.get('/status.md', requireSupabaseEnv, onStatusMarkdownRequest);

app.route('/api', api);

app.notFound(notFound);
app.onError(onError);

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
