import { describe, expect, it } from 'vitest';
import { BATCH_SIZE, chunkArray, selectDueMonitors } from '../lib/scheduler';
import type { MonitorDefinition } from '../types';

const sample: MonitorDefinition[] = [
  {
    slug: 'crit-1',
    name: 'Critical',
    agency: 'Agency A',
    category: 'tax-revenue',
    type: 'http',
    url: 'https://a.gov.ph/',
    tier: 'critical',
  },
  {
    slug: 'std-1',
    name: 'Standard',
    agency: 'Agency B',
    category: 'executive',
    type: 'http',
    url: 'https://b.gov.ph/',
    tier: 'standard',
  },
];

describe('scheduler tiering and batching', () => {
  it('selects only critical monitors off the 15-minute mark', () => {
    const due = selectDueMonitors(sample, new Date('2026-11-24T00:05:00Z'));
    expect(due.map(m => m.slug)).toEqual(['crit-1']);
  });

  it('selects both critical and standard monitors on the 15-minute mark', () => {
    const due = selectDueMonitors(sample, new Date('2026-11-24T00:15:00Z'));
    expect(due.map(m => m.slug)).toEqual(['crit-1', 'std-1']);
  });

  it('chunks arrays into batches of at most BATCH_SIZE (20)', () => {
    const items = Array.from({ length: 85 }, (_, i) => i);
    const chunks = chunkArray(items, BATCH_SIZE);
    expect(chunks.map(c => c.length)).toEqual([20, 20, 20, 20, 5]);
  });
});
