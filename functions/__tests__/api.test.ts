import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import * as supabase from '../lib/supabase';
import type { Env } from '../types';

const baseEnv: Env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

describe('Worker Hono API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('returns 503 when Supabase bindings are missing', async () => {
    const res = await app.request('/api/summary', {}, {} as Env);
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      error: string;
      missingBindings: string[];
    };
    expect(body.error).toBe('Not configured');
    expect(body.missingBindings).toEqual([
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);
  });

  it('rejects disallowed Origin with 403', async () => {
    const res = await app.request(
      '/api/summary',
      { headers: { Origin: 'https://evil.example.com' } },
      baseEnv
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Origin not allowed' });
  });

  it('handles OPTIONS preflight for allowed Origin', async () => {
    const res = await app.request(
      '/api/summary',
      {
        method: 'OPTIONS',
        headers: { Origin: 'https://bettergov.ph' },
      },
      baseEnv
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://bettergov.ph'
    );
  });

  it('returns 404 for unknown API routes', async () => {
    const res = await app.request('/api/does-not-exist', {}, baseEnv);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('returns 404 for unknown monitor slug', async () => {
    const res = await app.request(
      '/api/monitors/non-existent-slug-xyz',
      {},
      baseEnv
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Monitor not found' });
  });

  it('returns 403 for POST /api/trigger when disabled', async () => {
    const res = await app.request('/api/trigger', { method: 'POST' }, baseEnv);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Manual trigger is disabled' });
  });

  it('returns summary snapshot with Cloudflare cache headers', async () => {
    vi.spyOn(supabase, 'fetchSummaryFromDb').mockResolvedValue({
      states: [],
      u24: [],
      bars: [],
      hourly: [],
      openIncidents: 0,
    });

    const res = await app.request(
      '/api/summary',
      { headers: { Origin: 'http://localhost:5125' } },
      baseEnv
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=30, s-maxage=60'
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5125'
    );
    const body = (await res.json()) as {
      counts: { total: number; openIncidents: number };
    };
    expect(body.counts.total).toBeGreaterThan(0);
    expect(body.counts.openIncidents).toBe(0);
  });
});
