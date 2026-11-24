import type { Env } from '../types';

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://bettergov.ph',
  'https://www.bettergov.ph',
]);

function isAllowedOrigin(origin: string): boolean {
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

function applyCorsHeaders(headers: Headers, origin: string | null) {
  if (!origin || !isAllowedOrigin(origin)) return;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Expose-Headers', 'RateLimit-Limit');
  headers.set('Vary', 'Origin');
}

export async function withRequestSecurity(
  request: Request,
  env: Env,
  handler: () => Promise<Response>
): Promise<Response> {
  const origin = request.headers.get('Origin');

  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    applyCorsHeaders(headers, origin);
    return new Response(null, { status: 204, headers });
  }

  if (env.API_RATE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local-fallback';
    const { success } = await env.API_RATE_LIMITER.limit({ key: ip });
    if (!success) {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'RateLimit-Limit': '120',
        'RateLimit-Remaining': '0',
      });
      applyCorsHeaders(headers, origin);
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers,
      });
    }
  }

  const response = await handler();
  const wrapped = new Response(response.body, response);
  if (env.API_RATE_LIMITER) {
    wrapped.headers.set('RateLimit-Limit', '120');
  }
  applyCorsHeaders(wrapped.headers, origin);
  return wrapped;
}
