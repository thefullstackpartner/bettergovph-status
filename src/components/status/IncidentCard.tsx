import { FC } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDuration,
  formatIncidentCause,
  formatManilaTimestamp,
} from '../../lib/format';
import type { Incident } from '../../types';

type Props = {
  incident: Incident;
};

const IncidentCard: FC<Props> = ({ incident }) => {
  const isOpen = incident.resolved_at === null;
  const causeInfo = incident.cause ? formatIncidentCause(incident.cause) : null;

  return (
    <div className="border border-ed-rule bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            to={`/monitors/${incident.monitor_slug}`}
            className="font-serif-ed text-lg font-semibold text-ed-ink no-underline hover:text-ed-navy hover:underline"
          >
            {incident.monitor_name || incident.monitor_slug}
          </Link>
          {incident.agency && (
            <p className="mt-0.5 font-sans-ed text-xs text-ed-ink-3">
              {incident.agency}
            </p>
          )}
        </div>
        <span
          className={
            isOpen
              ? 'border border-ed-red/30 bg-red-50 px-2.5 py-0.5 font-mono-ed text-[11px] font-semibold uppercase text-ed-red-ink'
              : 'border border-success-500/30 bg-success-50 px-2.5 py-0.5 font-mono-ed text-[11px] font-semibold uppercase text-success-700'
          }
        >
          {isOpen ? 'Ongoing' : 'Resolved'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono-ed text-xs text-ed-ink-3">
        <span>Started: {formatManilaTimestamp(incident.started_at)}</span>
        {incident.resolved_at && (
          <span>Resolved: {formatManilaTimestamp(incident.resolved_at)}</span>
        )}
        <span>
          Duration: {formatDuration(incident.started_at, incident.resolved_at)}
        </span>
        {causeInfo && <span>Cause: {causeInfo.label}</span>}
      </div>
      {causeInfo && (
        <p className="mt-2 border-t border-ed-rule/60 pt-2 font-sans-ed text-xs leading-relaxed text-ed-ink-3">
          {causeInfo.description}
        </p>
      )}
    </div>
  );
};

export default IncidentCard;
