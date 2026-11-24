export interface IncidentNotification {
  monitorSlug: string;
  monitorName: string;
  agency: string;
  url: string;
  cause: string | null;
  startedAt: string;
  resolvedAt?: string | null;
}

export interface Notifier {
  incidentOpened(incident: IncidentNotification): Promise<void>;
  incidentResolved(incident: IncidentNotification): Promise<void>;
}

/**
 * MVP no-op notifier. Discord webhook support is planned for the next phase
 * (see `docs/roadmap.md`).
 */
export class NoopNotifier implements Notifier {
  async incidentOpened(): Promise<void> {}
  async incidentResolved(): Promise<void> {}
}

export const defaultNotifier: Notifier = new NoopNotifier();
