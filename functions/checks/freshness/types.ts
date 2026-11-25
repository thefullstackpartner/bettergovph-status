import type { CheckContext, FreshnessResult, MonitorDefinition } from '../../types';

/**
 * Contract for monitor-specific content freshness probes.
 * Each implementation encapsulates how a portal's update signals are fetched
 * and normalized into a uniform FreshnessResult.
 */
export interface FreshnessProbe {
  readonly name: string;
  probe(monitor: MonitorDefinition, ctx: CheckContext): Promise<FreshnessResult>;
}
