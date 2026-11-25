export type CheckStatus = 'up' | 'degraded' | 'down';
export type MonitorTier = 'critical' | 'standard';
export type FreshnessStatus = 'fresh' | 'stale' | 'unknown';
export type FreshnessSignalSource =
  | 'api'
  | 'sitemap'
  | 'rss'
  | 'meta'
  | 'http_header'
  | 'content_hash';

export interface MonitorDefinition {
  slug: string;
  name: string;
  agency: string;
  department?: string | null;
  category: string;
  type: 'http';
  url: string;
  tier: MonitorTier;
  method?: 'GET' | 'HEAD';
  expectedStatus?: number[];
  timeoutMs?: number;
  degradedMs?: number;
  expectedKeyword?: string;
  forbiddenKeywords?: string[];
  source?: 'curated' | 'bettergov-websites';
  enabled?: boolean;
  freshnessEnabled?: boolean;
}

export interface CategoryDefinition {
  slug: string;
  name: string;
  description: string;
}

export interface CheckContext {
  userAgent: string;
  colo: string | null;
}

export interface CheckResult {
  monitor_slug: string;
  checked_at: string;
  status: CheckStatus;
  http_status: number | null;
  response_ms: number;
  error: string | null;
  colo: string | null;
}

export interface FreshnessResult {
  monitor_slug: string;
  checked_at: string;
  signal_source: FreshnessSignalSource | null;
  content_updated_at: string | null;
  content_hash: string | null;
  etag: string | null;
  http_last_modified: string | null;
  probe_error: string | null;
}

export interface BatchMessage {
  slugs: string[];
  kind?: 'uptime' | 'freshness';
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  USER_AGENT?: string;
  TRIGGER_SECRET?: string;
  FRESHNESS_STALE_DAYS?: string;
  CHECK_QUEUE?: Queue<BatchMessage>;
  API_RATE_LIMITER?: RateLimit;
}
