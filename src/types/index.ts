export type CheckStatus = 'up' | 'degraded' | 'down';
export type MonitorTier = 'critical' | 'standard';
export type MonitorSource = 'curated' | 'bettergov-websites';
export type FreshnessStatus = 'fresh' | 'stale' | 'unknown';
export type FreshnessSignalSource =
  | 'api'
  | 'sitemap'
  | 'rss'
  | 'meta'
  | 'http_header'
  | 'content_hash';

export interface MonitorFreshness {
  enabled: boolean;
  status: FreshnessStatus;
  signalSource: FreshnessSignalSource | null;
  contentUpdatedAt: string | null;
  lastChangedAt: string | null;
  lastCheckedAt: string | null;
  changeCount30d: number;
  changeCount90d: number;
  probeError: string | null;
}

export interface FreshnessEvent {
  id: number;
  monitor_slug: string;
  detected_at: string;
  signal_source: FreshnessSignalSource;
  content_updated_at: string | null;
}

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
  maintenance?: MonitorMaintenance | null;
  freshness?: MonitorFreshness;
  bars90d: DailyBar[];
  hourly24h?: HourlyBar[];
}

export interface SummaryResponse {
  generatedAt: string;
  freshnessStaleDays?: number;
  counts: {
    total: number;
    up: number;
    degraded: number;
    down: number;
    unknown: number;
    openIncidents: number;
    freshnessMonitored?: number;
    fresh?: number;
    stale?: number;
  };
  categories: Category[];
  maintenances?: {
    active: MaintenanceWindow[];
    upcoming: MaintenanceWindow[];
  };
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
  freshnessEvents?: FreshnessEvent[];
  freshnessStaleDays?: number;
}

export interface MonitorHistoryResponse {
  slug: string;
  range: '24h' | '7d' | '30d' | '90d';
  points: CheckPoint[];
  daily: DailyBar[];
}

export type DashboardRange = '7d' | '30d' | '90d' | '1y';
export type DashboardTierFilter = 'all' | 'critical' | 'standard';

export type ScorecardGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';

export interface ScorecardMonitorRow {
  slug: string;
  name: string;
  agency: string;
  url: string;
  category: string;
  categoryName: string;
  tier: MonitorTier;
  checksTotal: number;
  availabilityPct: number | null;
  cleanUptimePct: number | null;
  avgMs: number | null;
  maxMs: number;
  incidentCount: number;
  openIncidents: number;
  mttrSec: number | null;
  score: number | null;
  grade: ScorecardGrade;
}

export interface ScorecardCategoryRow {
  category: string;
  categoryName: string;
  monitorCount: number;
  checksTotal: number;
  availabilityPct: number | null;
  avgMs: number | null;
  incidentCount: number;
  mttrSec: number | null;
  score: number | null;
  grade: ScorecardGrade;
}

export interface ScorecardsResponse {
  generatedAt: string;
  period: DashboardRange;
  days: number;
  tier: DashboardTierFilter;
  summary: {
    totalMonitors: number;
    avgAvailabilityPct: number | null;
    totalIncidents: number;
    avgMttrSec: number | null;
  };
  categories: ScorecardCategoryRow[];
  monitors: ScorecardMonitorRow[];
}

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
