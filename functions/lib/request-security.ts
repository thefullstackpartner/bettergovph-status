import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../types';

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://bettergov.ph',
  'https://www.bettergov.ph',
]);

export function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (
      url.protocol === 'https:' &&
      url.port === '' &&
      (url.hostname.endsWith('.workers.dev') ||
        url.hostname === 'bettergov.ph' ||
        url.hostname.endsWith('.bettergov.ph'))
    ) {
      return true;
    }
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export const rejectDisallowedOrigin: MiddlewareHandler<{
  Bindings: Env;
}> = async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && !isAllowedOrigin(origin)) {
    return c.json({ error: 'Origin not allowed' }, 403);
  }
  await next();
};

export const corsMiddleware = cors({
  origin: (origin) => (origin && isAllowedOrigin(origin) ? origin : ''),
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['RateLimit-Limit'],
});

export const rateLimitMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next
) => {
  if (c.env.API_RATE_LIMITER) {
    const ip = c.req.header('CF-Connecting-IP') ?? 'local-fallback';
    const { success } = await c.env.API_RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return c.json({ error: 'Too many requests' }, 429, {
        'Retry-After': '60',
        'RateLimit-Limit': '120',
        'RateLimit-Remaining': '0',
      });
    }
  }

  await next();

  if (c.env.API_RATE_LIMITER) {
    c.header('RateLimit-Limit', '120');
  }
};

export const requireSupabaseEnv: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next
) => {
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_ROLE_KEY) {
    const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    return c.json(
      {
        error: 'Not configured',
        message: `Missing required binding(s) or secret(s): ${missing.join(', ')}. See functions/README.md.`,
        missingBindings: missing,
      },
      503
    );
  }
  await next();
};
