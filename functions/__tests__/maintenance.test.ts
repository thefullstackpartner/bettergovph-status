import { describe, expect, it } from 'vitest';
import {
  type MaintenanceWindow,
  allMaintenanceWindows,
  getActiveMaintenanceForSlug,
  getActiveMaintenances,
  getMonitorMaintenance,
  getUpcomingMaintenances,
} from '../lib/maintenance';
import { allMonitors } from '../lib/monitors';

const sampleWindows: MaintenanceWindow[] = [
  {
    id: 'active-bir',
    slugs: ['bir-orus'],
    title: 'BIR ORUS Upgrade',
    startAt: '2026-11-25T23:00:00Z',
    endAt: '2026-11-26T02:00:00Z',
    impact: 'down',
  },
  {
    id: 'upcoming-sss',
    slugs: ['sss-portal'],
    title: 'SSS Scheduled Maintenance',
    startAt: '2026-11-26T12:00:00Z',
    endAt: '2026-11-26T14:00:00Z',
    impact: 'degraded',
  },
  {
    id: 'expired-lto',
    slugs: ['lto-ltms'],
    title: 'Past LTO Maintenance',
    startAt: '2026-11-24T00:00:00Z',
    endAt: '2026-11-24T04:00:00Z',
  },
];

describe('Scheduled maintenance windows', () => {
  const now = new Date('2026-11-26T00:00:00Z');

  it('identifies active, upcoming, and expired windows', () => {
    const active = getActiveMaintenances(now, sampleWindows);
    expect(active.map(w => w.id)).toEqual(['active-bir']);

    const upcoming = getUpcomingMaintenances(now, 48, sampleWindows);
    expect(upcoming.map(w => w.id)).toEqual(['upcoming-sss']);

    expect(getActiveMaintenanceForSlug('bir-orus', now, sampleWindows)?.id).toBe(
      'active-bir'
    );
    expect(getActiveMaintenanceForSlug('lto-ltms', now, sampleWindows)).toBeNull();
  });

  it('resolves per-monitor maintenance state', () => {
    const bir = getMonitorMaintenance('bir-orus', now, sampleWindows);
    expect(bir?.status).toBe('active');
    expect(bir?.impact).toBe('down');

    const sss = getMonitorMaintenance('sss-portal', now, sampleWindows);
    expect(sss?.status).toBe('upcoming');
    expect(sss?.impact).toBe('degraded');

    expect(getMonitorMaintenance('lto-ltms', now, sampleWindows)).toBeNull();
  });

  it('validates committed maintenance.json slugs and timestamps', () => {
    const knownSlugs = new Set(allMonitors.map(m => m.slug));
    for (const w of allMaintenanceWindows) {
      expect(Date.parse(w.endAt)).toBeGreaterThan(Date.parse(w.startAt));
      for (const slug of w.slugs) {
        expect(knownSlugs.has(slug)).toBe(true);
      }
    }
  });
});
