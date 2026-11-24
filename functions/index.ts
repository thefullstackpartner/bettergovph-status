import { onMonitorHistoryRequest } from './api/history';
import { onIncidentsRequest } from './api/incidents';
import { onMonitorDetailRequest, onMonitorsRequest } from './api/monitors';
import { onSummaryRequest } from './api/summary';
import { onTriggerRequest } from './api/trigger';
import { withRequestSecurity } from './lib/request-security';
import { jsonResponse } from './lib/router';
import { processBatch, runCycle } from './lib/scheduler';
import { refreshSummarySnapshot } from './lib/snapshot';
import { pruneOldChecks } from './lib/supabase';
import type { BatchMessage, Env } from './types';

function notConfigured(missing: string[]): Response {
  return jsonResponse(
    {
      error: 'Not configured',
      message: `Missing required binding(s) or secret(s): ${missing.join(', ')}. See functions/README.md.`,
      missingBindings: missing,
    },
    { status: 503 }
  );
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return notConfigured(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'POST' && path === '/api/trigger') {
    return onTriggerRequest(request, env);
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  if (path === '/api/summary') {
    return onSummaryRequest(env);
  }
  if (path === '/api/monitors') {
    return onMonitorsRequest(env);
  }
  if (path === '/api/incidents') {
    return onIncidentsRequest(request, env);
  }

  const historyMatch = path.match(/^\/api\/monitors\/([a-z0-9-]+)\/history$/);
  if (historyMatch) {
    return onMonitorHistoryRequest(request, env, historyMatch[1]);
  }

  const detailMatch = path.match(/^\/api\/monitors\/([a-z0-9-]+)$/);
  if (detailMatch) {
    return onMonitorDetailRequest(env, detailMatch[1]);
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
}

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
        pruneOldChecks(env, 30).then(deleted =>
          console.log(`[prune] Deleted ${deleted} raw check rows older than 30d`)
        )
      );
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
      await processBatch(msg.body.slugs, env);
      msg.ack();
    }
    await refreshSummarySnapshot(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    return withRequestSecurity(request, env, async () => {
      try {
        return await routeApi(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[api]', message);
        return jsonResponse({ error: 'Internal server error' }, { status: 500 });
      }
    });
  },
} satisfies ExportedHandler<Env, BatchMessage>;
