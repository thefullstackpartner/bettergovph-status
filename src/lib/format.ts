export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

export function formatUptime(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return `${pct.toFixed(2)}%`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diffSec = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  );
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

const SIGNAL_LABELS: Record<string, string> = {
  api: 'API / JSON Probe',
  sitemap: 'XML Sitemap',
  rss: 'RSS / Atom Feed',
  meta: 'HTML Metadata',
  http_header: 'HTTP Last-Modified',
  content_hash: 'Content Fingerprint',
};

export function formatFreshnessSignal(source: string | null | undefined): string {
  if (!source) return 'Not yet detected';
  return SIGNAL_LABELS[source] ?? source;
}

export function formatDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const mins = Math.max(1, Math.round((end - start) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export function formatManilaTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(iso));
}

export interface IncidentCauseInfo {
  label: string;
  description: string;
}

const INCIDENT_CAUSES: Record<string, IncidentCauseInfo> = {
  not_found: {
    label: 'Page Not Found (HTTP 404)',
    description:
      'The server responded with HTTP 404; the monitored page may have moved or been removed.',
  },
  unexpected_status: {
    label: 'Unexpected HTTP Error',
    description:
      'The server returned an error status code (such as HTTP 5xx or 4xx) instead of a healthy response.',
  },
  maintenance: {
    label: 'Under Maintenance',
    description:
      'The portal displayed a maintenance notice and could not be used.',
  },
  keyword_missing: {
    label: 'Expected Content Missing',
    description:
      'The page loaded but did not contain the expected portal content, indicating a broken or placeholder page.',
  },
  timeout: {
    label: 'Request Timed Out',
    description:
      'The server did not respond within the check timeout window.',
  },
  dns: {
    label: 'DNS Resolution Failed',
    description: 'The domain name could not be resolved to an IP address.',
  },
  tls: {
    label: 'TLS / SSL Error',
    description:
      'A secure HTTPS connection could not be established due to a TLS handshake or certificate error.',
  },
  connect: {
    label: 'Connection Failed',
    description:
      'The monitoring probe could not establish a network connection to the server.',
  },
  invalid_http_header: {
    label: 'Malformed HTTP Response',
    description:
      'The server returned invalid HTTP headers that could not be parsed.',
  },
  waf_403: {
    label: 'Probe Blocked (WAF 403)',
    description: 'The portal’s firewall blocked automated monitoring probes.',
  },
  down: {
    label: 'Service Unreachable',
    description: 'The service failed consecutive health checks.',
  },
  fetch_error: {
    label: 'Network / Fetch Error',
    description:
      'The monitoring probe encountered a network-level failure while reaching the server.',
  },
  tls_error: {
    label: 'TLS / SSL Error',
    description:
      'A secure HTTPS connection could not be established due to a TLS handshake or certificate error.',
  },
  unknown: {
    label: 'Unspecified Failure',
    description: 'The service failed consecutive health checks without a specific error code.',
  },
};

export function formatIncidentCause(cause: string): IncidentCauseInfo {
  const known = INCIDENT_CAUSES[cause];
  if (known) return known;

  const httpMatch = cause.match(/^http_(\d{3})$/);
  if (httpMatch) {
    return {
      label: `HTTP ${httpMatch[1]}`,
      description: `The server returned HTTP ${httpMatch[1]} instead of a healthy response.`,
    };
  }

  return {
    label: cause,
    description: 'The service failed consecutive health checks.',
  };
}
