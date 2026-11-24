import type {
  MonitorDetailResponse,
  MonitorHistoryResponse,
  SummaryResponse,
} from '../types';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return (await res.json()) as T;
}

export function getSummary(): Promise<SummaryResponse> {
  return fetchJson<SummaryResponse>('/api/summary');
}

export function getMonitorDetail(slug: string): Promise<MonitorDetailResponse> {
  return fetchJson<MonitorDetailResponse>(
    `/api/monitors/${encodeURIComponent(slug)}`
  );
}

export function getMonitorHistory(
  slug: string,
  range: '24h' | '7d' | '30d' | '90d'
): Promise<MonitorHistoryResponse> {
  return fetchJson<MonitorHistoryResponse>(
    `/api/monitors/${encodeURIComponent(slug)}/history?range=${range}`
  );
}

export function getIncidents(status: 'open' | 'all', page = 1) {
  return fetchJson<{
    items: Array<{
      id: number;
      monitor_slug: string;
      monitor_name: string;
      agency: string;
      started_at: string;
      resolved_at: string | null;
      cause: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/incidents?status=${status}&page=${page}`);
}
