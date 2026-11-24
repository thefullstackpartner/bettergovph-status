export type CheckStatus = 'up' | 'degraded' | 'down';
export type MonitorTier = 'critical' | 'standard';

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

export interface BatchMessage {
  slugs: string[];
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  USER_AGENT?: string;
  TRIGGER_SECRET?: string;
  CHECK_QUEUE?: Queue<BatchMessage>;
  API_RATE_LIMITER?: RateLimit;
}
