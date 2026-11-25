import type { Env, FreshnessStatus } from '../types';

export const DEFAULT_FRESHNESS_STALE_DAYS = 30;

/**
 * Returns the configured staleness threshold in days from `Env.FRESHNESS_STALE_DAYS`,
 * falling back to 30 days if unset or invalid.
 */
export function getFreshnessStaleDays(env?: Partial<Env>): number {
  const raw = Number(env?.FRESHNESS_STALE_DAYS);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  return DEFAULT_FRESHNESS_STALE_DAYS;
}

/**
 * Computes freshness status dynamically from the most recent known content timestamp
 * (`contentUpdatedAt ?? lastChangedAt`) against `staleAfterDays`.
 * Never persisted in the database so threshold changes take effect immediately.
 */
export function computeFreshnessStatus(
  referenceDateIso: string | null | undefined,
  staleAfterDays = DEFAULT_FRESHNESS_STALE_DAYS,
  now = new Date()
): FreshnessStatus {
  if (!referenceDateIso) return 'unknown';
  const refMs = Date.parse(referenceDateIso);
  if (!Number.isFinite(refMs)) return 'unknown';
  const ageMs = now.getTime() - refMs;
  const thresholdMs = staleAfterDays * 86_400_000;
  return ageMs > thresholdMs ? 'stale' : 'fresh';
}
