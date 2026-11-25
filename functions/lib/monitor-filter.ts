import type { SummarySnapshot } from './snapshot';

export type SnapshotMonitor = SummarySnapshot['monitors'][number];
export type LiteMonitor = Omit<SnapshotMonitor, 'bars90d' | 'hourly24h'>;

export type MonitorStatusFilter = SnapshotMonitor['status'];

export interface MonitorFilter {
  status?: Set<MonitorStatusFilter>;
  category?: string;
  tier?: 'critical' | 'standard';
  q?: string;
}

const STATUSES = new Set<MonitorStatusFilter>([
  'up',
  'degraded',
  'down',
  'unknown',
]);

/** Parse `status`, `category`, `tier`, and `q` query params. Unknown values are ignored. */
export function parseMonitorFilter(
  query: (key: string) => string | undefined
): MonitorFilter {
  const filter: MonitorFilter = {};

  const rawStatus = query('status');
  if (rawStatus) {
    const statuses = rawStatus
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is MonitorStatusFilter =>
        STATUSES.has(s as MonitorStatusFilter)
      );
    if (statuses.length > 0) filter.status = new Set(statuses);
  }

  const category = query('category')?.trim().toLowerCase();
  if (category) filter.category = category;

  const tier = query('tier')?.trim().toLowerCase();
  if (tier === 'critical' || tier === 'standard') filter.tier = tier;

  const q = query('q')?.trim().toLowerCase();
  if (q) filter.q = q.slice(0, 100);

  return filter;
}

export function filterMonitors<T extends SnapshotMonitor>(
  monitors: T[],
  filter: MonitorFilter
): T[] {
  return monitors.filter((m) => {
    if (filter.status && !filter.status.has(m.status)) return false;
    if (filter.category && m.category !== filter.category) return false;
    if (filter.tier && m.tier !== filter.tier) return false;
    if (filter.q) {
      const haystack = [m.name, m.agency, m.department ?? '', m.slug, m.url]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(filter.q)) return false;
    }
    return true;
  });
}

/** Drop the heavy 90-day / 24-hour bar arrays (~95% of the payload). */
export function toLiteMonitor(m: SnapshotMonitor): LiteMonitor {
  const lite: Partial<SnapshotMonitor> = { ...m };
  delete lite.bars90d;
  delete lite.hourly24h;
  return lite as LiteMonitor;
}
