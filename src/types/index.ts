export type CheckStatus = 'up' | 'degraded' | 'down';
export type MonitorTier = 'critical' | 'standard';
export type MonitorSource = 'curated' | 'bettergov-websites';

export interface Category {
  slug: string;
  name: string;
  description: string;
}

export interface DailyBar {
  day: string;
  total: number;
  up: number;
  degraded: number;
  waf?: number;
  down: number;
  avgMs: number;
}

export interface HourlyBar {
  hour: string;
  total: number;
  up: number;
  degraded: number;
  waf?: number;
  down: number;
  avgMs: number;
}

export interface MonitorSummary {
  slug: string;
  name: string;
  agency: string;
  department: string | null;
  category: string;
  url: string;
  tier: MonitorTier;
  source: MonitorSource;
  status: CheckStatus | 'unknown';
  lastCheckedAt: string | null;
  lastHttpStatus: number | null;
  lastResponseMs: number | null;
  lastError: string | null;
  lastColo: string | null;
  uptime24h: number | null;
  avgMs24h: number | null;
  bars90d: DailyBar[];
  hourly24h?: HourlyBar[];
}

export interface SummaryResponse {
  generatedAt: string;
  counts: {
    total: number;
    up: number;
    degraded: number;
    down: number;
    unknown: number;
    openIncidents: number;
  };
  categories: Category[];
  monitors: MonitorSummary[];
}

export interface Incident {
  id: number;
  monitor_slug: string;
  monitor_name?: string;
  agency?: string;
  started_at: string;
  resolved_at: string | null;
  cause: string | null;
}

export interface CheckPoint {
  checked_at: string;
  status: CheckStatus;
  http_status: number | null;
  response_ms: number | null;
  error: string | null;
  colo: string | null;
}

export interface MonitorDetailResponse {
  monitor: MonitorSummary;
  incidents: Incident[];
}

export interface MonitorHistoryResponse {
  slug: string;
  range: '24h' | '7d' | '30d' | '90d';
  points: CheckPoint[];
  daily: DailyBar[];
}

export type DashboardRange = '7d' | '30d' | '90d' | '1y';
export type DashboardTierFilter = 'all' | 'critical' | 'standard';

export interface DashboardKpis {
  totalMonitors: number;
  totalChecks: number;
  availabilityPct: number;
  cleanUptimePct: number;
  wafPct: number;
  degradedPct: number;
  downPct: number;
  avgMs: number;
  maxMs: number;
  totalIncidents: number;
  openIncidents: number;
  mttrMinutes: number | null;
  worstCategory: {
    slug: string;
    name: string;
    availabilityPct: number;
    downPct: number;
    monitorCount: number;
  } | null;
}

export interface DashboardDailyPoint {
  day: string;
  total: number;
  up: number;
  degraded: number;
  waf: number;
  down: number;
  availabilityPct: number;
  avgMs: number;
}

export interface CategoryPerformance {
  slug: string;
  name: string;
  description: string;
  monitorCount: number;
  checksTotal: number;
  availabilityPct: number;
  cleanUptimePct: number;
  wafPct: number;
  degradedPct: number;
  downPct: number;
  avgMs: number;
  maxMs: number;
  incidentCount: number;
}

export interface MonitorPerformanceRow {
  slug: string;
  name: string;
  agency: string;
  category: string;
  categoryName: string;
  tier: MonitorTier;
  checksTotal: number;
  availabilityPct: number;
  cleanUptimePct: number;
  wafPct: number;
  degradedPct: number;
  downPct: number;
  avgMs: number;
  maxMs: number;
  incidentCount: number;
}

export interface IncidentCauseSummary {
  cause: string;
  count: number;
  pct: number;
}

export interface DashboardResponse {
  generatedAt: string;
  range: DashboardRange;
  days: number;
  tier: DashboardTierFilter;
  isMock?: boolean;
  kpis: DashboardKpis;
  dailyTrend: DashboardDailyPoint[];
  categories: CategoryPerformance[];
  monitors: MonitorPerformanceRow[];
  worstPerformers: MonitorPerformanceRow[];
  bestPerformers: MonitorPerformanceRow[];
  slowestMonitors: MonitorPerformanceRow[];
  mostIncidents: MonitorPerformanceRow[];
  incidentCauses: IncidentCauseSummary[];
}
