import type { CheckContext, FreshnessResult, MonitorDefinition } from '../../types';
import { DimeFreshnessProbe } from './probes/dime';
import { DpwhTransparencyFreshnessProbe } from './probes/dpwh-transparency';
import { GenericFreshnessProbe } from './probes/generic';
import { SumbongSaPanguloFreshnessProbe } from './probes/sumbong-sa-pangulo';
import type { FreshnessProbe } from './types';

export type { FreshnessProbe } from './types';
export { BaseFreshnessProbe } from './base';
export { DimeFreshnessProbe } from './probes/dime';
export { DpwhTransparencyFreshnessProbe } from './probes/dpwh-transparency';
export { SumbongSaPanguloFreshnessProbe } from './probes/sumbong-sa-pangulo';
export { GenericFreshnessProbe } from './probes/generic';

const defaultProbe = new GenericFreshnessProbe();

const PROBE_REGISTRY: Record<string, FreshnessProbe> = {
  'dbm-dime': new DimeFreshnessProbe(),
  'dpwh-transparency': new DpwhTransparencyFreshnessProbe(),
  'sumbong-sa-pangulo': new SumbongSaPanguloFreshnessProbe(),
};

export function getFreshnessProbe(monitor: MonitorDefinition): FreshnessProbe {
  return PROBE_REGISTRY[monitor.slug] ?? defaultProbe;
}

export async function runFreshnessCheck(
  monitor: MonitorDefinition,
  ctx: CheckContext
): Promise<FreshnessResult> {
  const probe = getFreshnessProbe(monitor);
  return probe.probe(monitor, ctx);
}
