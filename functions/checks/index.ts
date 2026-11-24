import type { MonitorDefinition } from '../types';
import { httpCheck, type CheckRunner } from './http';

/**
 * Pluggable check runner registry.
 * Add new check types (keyword, tls, dns, tcp) here and in
 * `src/data/schema/monitors.schema.json`. See `docs/adding-check-types.md`.
 */
export const runners: Record<MonitorDefinition['type'], CheckRunner> = {
  http: httpCheck,
};
