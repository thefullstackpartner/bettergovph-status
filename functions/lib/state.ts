import type { CheckStatus } from '../types';

export interface MonitorStateSnapshot {
  status: CheckStatus;
  consecutiveFail: number;
  consecutiveOk: number;
  openIncidentId: number | null;
}

export type StateTransition = 'incident_opened' | 'incident_resolved' | null;

export interface StateStepResult {
  next: MonitorStateSnapshot;
  transition: StateTransition;
}

/**
 * Pure 2-strike state machine mirroring `bgovph_record_checks` in Postgres.
 * - Opens an incident on 2 consecutive `down` checks.
 * - Resolves an open incident on 2 consecutive non-down (`up` | `degraded`) checks.
 */
export function nextMonitorState(
  prev: MonitorStateSnapshot | null,
  status: CheckStatus,
  nextIncidentId = 1
): StateStepResult {
  if (!prev) {
    return {
      next: {
        status,
        consecutiveFail: status === 'down' ? 1 : 0,
        consecutiveOk: status !== 'down' ? 1 : 0,
        openIncidentId: null,
      },
      transition: null,
    };
  }

  if (status === 'down') {
    const consecutiveFail = prev.consecutiveFail + 1;
    const shouldOpen = consecutiveFail >= 2 && prev.openIncidentId === null;
    return {
      next: {
        status,
        consecutiveFail,
        consecutiveOk: 0,
        openIncidentId: shouldOpen ? nextIncidentId : prev.openIncidentId,
      },
      transition: shouldOpen ? 'incident_opened' : null,
    };
  }

  const consecutiveOk = prev.consecutiveOk + 1;
  const shouldResolve = consecutiveOk >= 2 && prev.openIncidentId !== null;
  return {
    next: {
      status,
      consecutiveFail: 0,
      consecutiveOk,
      openIncidentId: shouldResolve ? null : prev.openIncidentId,
    },
    transition: shouldResolve ? 'incident_resolved' : null,
  };
}
