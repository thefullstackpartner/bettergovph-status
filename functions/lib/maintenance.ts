import maintenanceData from '../../src/data/maintenance.json';

export interface MaintenanceWindow {
  id: string;
  slugs: string[];
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  impact?: 'down' | 'degraded' | 'partial';
  sourceUrl?: string;
}

export interface MonitorMaintenance {
  id: string;
  status: 'active' | 'upcoming';
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  impact: 'down' | 'degraded' | 'partial';
  sourceUrl: string | null;
}

const DEFAULT_UPCOMING_HOURS = 48;

export const allMaintenanceWindows: MaintenanceWindow[] =
  maintenanceData as MaintenanceWindow[];

function isWindowValid(w: MaintenanceWindow): boolean {
  const start = Date.parse(w.startAt);
  const end = Date.parse(w.endAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

export function isMaintenanceActive(
  w: MaintenanceWindow,
  now = new Date()
): boolean {
  if (!isWindowValid(w)) return false;
  const t = now.getTime();
  return t >= Date.parse(w.startAt) && t < Date.parse(w.endAt);
}

export function isMaintenanceUpcoming(
  w: MaintenanceWindow,
  now = new Date(),
  withinHours = DEFAULT_UPCOMING_HOURS
): boolean {
  if (!isWindowValid(w)) return false;
  const t = now.getTime();
  const start = Date.parse(w.startAt);
  return start > t && start <= t + withinHours * 3600_000;
}

export function getActiveMaintenances(
  now = new Date(),
  windows: MaintenanceWindow[] = allMaintenanceWindows
): MaintenanceWindow[] {
  return windows.filter(w => isMaintenanceActive(w, now));
}

export function getUpcomingMaintenances(
  now = new Date(),
  withinHours = DEFAULT_UPCOMING_HOURS,
  windows: MaintenanceWindow[] = allMaintenanceWindows
): MaintenanceWindow[] {
  return windows
    .filter(w => isMaintenanceUpcoming(w, now, withinHours))
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

function toMonitorMaintenance(
  w: MaintenanceWindow,
  status: 'active' | 'upcoming'
): MonitorMaintenance {
  return {
    id: w.id,
    status,
    title: w.title,
    description: w.description ?? null,
    startAt: w.startAt,
    endAt: w.endAt,
    impact: w.impact ?? 'down',
    sourceUrl: w.sourceUrl ?? null,
  };
}

export function getMonitorMaintenance(
  slug: string,
  now = new Date(),
  windows: MaintenanceWindow[] = allMaintenanceWindows
): MonitorMaintenance | null {
  const active = windows.find(
    w => w.slugs.includes(slug) && isMaintenanceActive(w, now)
  );
  if (active) return toMonitorMaintenance(active, 'active');

  const upcoming = getUpcomingMaintenances(now, DEFAULT_UPCOMING_HOURS, windows).find(
    w => w.slugs.includes(slug)
  );
  if (upcoming) return toMonitorMaintenance(upcoming, 'upcoming');

  return null;
}

export function getActiveMaintenanceForSlug(
  slug: string,
  now = new Date(),
  windows: MaintenanceWindow[] = allMaintenanceWindows
): MaintenanceWindow | null {
  return (
    windows.find(w => w.slugs.includes(slug) && isMaintenanceActive(w, now)) ??
    null
  );
}
