import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpCheck } from '../checks/http';
import type { MonitorDefinition } from '../types';

const baseMonitor: MonitorDefinition = {
  slug: 'test-bir',
  name: 'BIR',
  agency: 'Bureau of Internal Revenue',
  category: 'tax-revenue',
  type: 'http',
  url: 'https://www.bir.gov.ph/',
  tier: 'critical',
  degradedMs: 500,
};

describe('httpCheck', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns up for 200 OK within degradedMs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200, headers: { 'cf-ray': 'abc-SIN' } })
    );
    const res = await httpCheck(baseMonitor, {
      userAgent: 'test-agent',
      colo: null,
    });
    expect(res.status).toBe('up');
    expect(res.http_status).toBe(200);
    expect(res.colo).toBe('SIN');
    expect(res.error).toBeNull();
  });

  it('returns down for 503 status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('err', { status: 503 })
    );
    const res = await httpCheck(baseMonitor, {
      userAgent: 'test-agent',
      colo: 'HKG',
    });
    expect(res.status).toBe('down');
    expect(res.http_status).toBe(503);
    expect(res.error).toBe('unexpected_status');
  });

  it('returns down with not_found error for 404 status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404 })
    );
    const res = await httpCheck(baseMonitor, {
      userAgent: 'test-agent',
      colo: 'HKG',
    });
    expect(res.status).toBe('down');
    expect(res.http_status).toBe(404);
    expect(res.error).toBe('not_found');
  });

  it('classifies timeout errors', async () => {
    const err = new Error('The operation timed out');
    err.name = 'TimeoutError';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(err);
    const res = await httpCheck(baseMonitor, {
      userAgent: 'test-agent',
      colo: null,
    });
    expect(res.status).toBe('down');
    expect(res.http_status).toBeNull();
    expect(res.error).toBe('timeout');
  });

  it('detects maintenance pages on 200 OK HTML responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body><h1>System Under Maintenance</h1></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    );
    const res = await httpCheck(baseMonitor, {
      userAgent: 'test-agent',
      colo: 'SIN',
    });
    expect(res.status).toBe('down');
    expect(res.http_status).toBe(200);
    expect(res.error).toBe('maintenance');
  });
});
