import type { CheckContext, CheckResult, MonitorDefinition } from '../types';

export type CheckRunner = (
  monitor: MonitorDefinition,
  ctx: CheckContext
) => Promise<CheckResult>;

const DEFAULT_MAINTENANCE_PHRASES = [
  'under maintenance',
  'undergoing maintenance',
  'scheduled maintenance',
  'site maintenance',
];

const MAX_SNIPPET_BYTES = 16_384;
const MAX_REDIRECTS = 2;

function classifyHttpFailure(status: number): string {
  return status === 404 ? 'not_found' : 'unexpected_status';
}

async function fetchWithBoundedRedirects(
  initialUrl: string,
  init: RequestInit,
  maxRedirects = MAX_REDIRECTS
): Promise<Response> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(currentUrl, { ...init, redirect: 'manual' });
    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get('location');
    if (!isRedirect || !location || hop === maxRedirects) {
      return res;
    }
    await res.body?.cancel().catch(() => {});
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error('redirect_limit');
}

export function classifyFetchError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return 'timeout';
    }
    const msg = err.message.toLowerCase();
    if (msg.includes('invalid http') || msg.includes('invalid header')) {
      return 'invalid_http_header';
    }
    if (msg.includes('dns') || msg.includes('enotfound')) return 'dns';
    if (msg.includes('tls') || msg.includes('ssl') || msg.includes('cert')) {
      return 'tls';
    }
  }
  return 'connect';
}

async function readHeadSnippet(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < MAX_SNIPPET_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value.subarray(0, MAX_SNIPPET_BYTES - total));
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/**
 * Fallback for servers (e.g. legacy IIS) whose response headers are rejected by
 * workerd's strict `fetch()` parser. Uses `cloudflare:sockets` to read only the
 * HTTP status line (`HTTP/1.1 200 OK`).
 */
async function rawSocketHeadStatus(
  rawUrl: string,
  userAgent: string,
  timeoutMs: number
): Promise<number | null> {
  try {
    const cfSocketsModule = 'cloudflare:sockets';
    const { connect } = (await import(
      /* @vite-ignore */ cfSocketsModule
    )) as typeof import('cloudflare:sockets');
    const u = new URL(rawUrl);
    const isHttps = u.protocol === 'https:';
    const port = Number(u.port || (isHttps ? 443 : 80));

    const socket = connect(
      { hostname: u.hostname, port },
      { secureTransport: isHttps ? 'on' : 'off', allowHalfOpen: false }
    );

    const writer = socket.writable.getWriter();
    const path = `${u.pathname || '/'}${u.search}`;
    const req =
      `HEAD ${path} HTTP/1.1\r\n` +
      `Host: ${u.host}\r\n` +
      `User-Agent: ${userAgent}\r\n` +
      `Accept: */*\r\n` +
      `Connection: close\r\n\r\n`;

    const timer = setTimeout(() => {
      void socket.close();
    }, timeoutMs);

    try {
      await writer.write(new TextEncoder().encode(req));
      const reader = socket.readable.getReader();
      const { value } = await reader.read();
      await reader.cancel();
      if (!value) return null;
      const head = new TextDecoder().decode(value).split('\r\n', 1)[0] ?? '';
      const match = head.match(/^HTTP\/\d\.\d\s+(\d{3})/);
      return match ? Number(match[1]) : null;
    } finally {
      clearTimeout(timer);
      await socket.close().catch(() => {});
    }
  } catch {
    return null;
  }
}

export const httpCheck: CheckRunner = async (monitor, ctx) => {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const timeoutMs = monitor.timeoutMs ?? 15_000;
  const degradedMs = monitor.degradedMs ?? 3_000;

  try {
    const res = await fetchWithBoundedRedirects(monitor.url, {
      method: monitor.method ?? 'GET',
      headers: {
        'User-Agent': ctx.userAgent,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs),
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    const responseMs = Math.max(1, Date.now() - started);
    const colo = res.headers.get('cf-ray')?.split('-')[1] ?? ctx.colo;
    const contentType = res.headers.get('content-type') ?? '';
    const isHtml = contentType.includes('text/html');

    // Read only the first 16 KB of HTML responses to detect maintenance pages or keywords.
    const snippet =
      isHtml && (monitor.method ?? 'GET') === 'GET'
        ? await readHeadSnippet(res)
        : '';
    if (!snippet) {
      await res.body?.cancel();
    }

    if (monitor.expectedStatus) {
      const ok = monitor.expectedStatus.includes(res.status);
      return {
        monitor_slug: monitor.slug,
        checked_at: checkedAt,
        status: !ok ? 'down' : responseMs > degradedMs ? 'degraded' : 'up',
        http_status: res.status,
        response_ms: responseMs,
        error: ok ? null : classifyHttpFailure(res.status),
        colo,
      };
    }

    // Many PH gov portals use Cloudflare/AWS WAF that returns 403 to automated probes
    // even while serving citizens normally in browsers. Report as degraded, not down.
    if (res.status === 403) {
      return {
        monitor_slug: monitor.slug,
        checked_at: checkedAt,
        status: 'degraded',
        http_status: res.status,
        response_ms: responseMs,
        error: 'waf_403',
        colo,
      };
    }

    const ok = res.status < 400;
    if (!ok) {
      return {
        monitor_slug: monitor.slug,
        checked_at: checkedAt,
        status: 'down',
        http_status: res.status,
        response_ms: responseMs,
        error: classifyHttpFailure(res.status),
        colo,
      };
    }

    if (snippet) {
      const lower = snippet.toLowerCase();
      if (
        monitor.expectedKeyword &&
        !lower.includes(monitor.expectedKeyword.toLowerCase())
      ) {
        return {
          monitor_slug: monitor.slug,
          checked_at: checkedAt,
          status: 'down',
          http_status: res.status,
          response_ms: responseMs,
          error: 'keyword_missing',
          colo,
        };
      }

      const maintenancePhrases =
        monitor.forbiddenKeywords ?? DEFAULT_MAINTENANCE_PHRASES;
      if (maintenancePhrases.some(p => lower.includes(p.toLowerCase()))) {
        return {
          monitor_slug: monitor.slug,
          checked_at: checkedAt,
          status: 'down',
          http_status: res.status,
          response_ms: responseMs,
          error: 'maintenance',
          colo,
        };
      }
    }

    return {
      monitor_slug: monitor.slug,
      checked_at: checkedAt,
      status: responseMs > degradedMs ? 'degraded' : 'up',
      http_status: res.status,
      response_ms: responseMs,
      error: null,
      colo,
    };
  } catch (err) {
    const kind = classifyFetchError(err);
    if (kind === 'invalid_http_header') {
      const rawStatus = await rawSocketHeadStatus(
        monitor.url,
        ctx.userAgent,
        timeoutMs
      );
      if (rawStatus !== null) {
        const responseMs = Math.max(1, Date.now() - started);
        const ok = monitor.expectedStatus
          ? monitor.expectedStatus.includes(rawStatus)
          : rawStatus < 400;
        return {
          monitor_slug: monitor.slug,
          checked_at: checkedAt,
          status:
            rawStatus === 403
              ? 'degraded'
              : !ok
                ? 'down'
                : responseMs > degradedMs
                  ? 'degraded'
                  : 'up',
          http_status: rawStatus,
          response_ms: responseMs,
          error:
            rawStatus === 403
              ? 'waf_403'
              : ok
                ? null
                : classifyHttpFailure(rawStatus),
          colo: ctx.colo,
        };
      }
    }

    return {
      monitor_slug: monitor.slug,
      checked_at: checkedAt,
      status: 'down',
      http_status: null,
      response_ms: Math.max(1, Date.now() - started),
      error: kind,
      colo: ctx.colo,
    };
  }
};
