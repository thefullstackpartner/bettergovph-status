import { FC } from 'react';
import { CalendarClockIcon, ExternalLinkIcon, WrenchIcon } from 'lucide-react';
import { formatManilaTimestamp } from '../../lib/format';
import type { MaintenanceWindow } from '../../types';

type Props = {
  maintenances?: {
    active: MaintenanceWindow[];
    upcoming: MaintenanceWindow[];
  };
};

const MaintenanceBanner: FC<Props> = ({ maintenances }) => {
  const active = maintenances?.active ?? [];
  const upcoming = maintenances?.upcoming ?? [];
  if (active.length === 0 && upcoming.length === 0) return null;

  return (
    <section
      aria-label="Scheduled maintenance windows"
      className="mt-4 space-y-2"
    >
      {active.map(w => (
        <div
          key={w.id}
          className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-sans-ed font-semibold">
              <WrenchIcon size={15} className="shrink-0 text-amber-700" />
              <span>Scheduled Maintenance in Progress: {w.title}</span>
            </div>
            <span className="font-mono-ed text-xs text-amber-800">
              {formatManilaTimestamp(w.startAt)} –{' '}
              {formatManilaTimestamp(w.endAt)}
            </span>
          </div>
          {w.description && (
            <p className="mt-1 text-xs text-amber-900">{w.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono-ed text-[11px] text-amber-800">
            <span>Affected: {w.slugs.join(', ')}</span>
            {w.sourceUrl && (
              <a
                href={w.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-amber-900 underline"
              >
                <span>Advisory</span>
                <ExternalLinkIcon size={11} />
              </a>
            )}
          </div>
        </div>
      ))}

      {upcoming.map(w => (
        <div
          key={w.id}
          className="border border-ed-rule bg-ed-paper-2 px-4 py-3 text-sm text-ed-ink-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-sans-ed font-semibold text-ed-ink">
              <CalendarClockIcon size={15} className="shrink-0 text-ed-navy" />
              <span>Upcoming Maintenance: {w.title}</span>
            </div>
            <span className="font-mono-ed text-xs text-ed-ink-3">
              {formatManilaTimestamp(w.startAt)} –{' '}
              {formatManilaTimestamp(w.endAt)}
            </span>
          </div>
          {w.description && (
            <p className="mt-1 text-xs text-ed-ink-3">{w.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono-ed text-[11px] text-ed-ink-3">
            <span>Affected: {w.slugs.join(', ')}</span>
            {w.sourceUrl && (
              <a
                href={w.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-ed-navy underline"
              >
                <span>Advisory</span>
                <ExternalLinkIcon size={11} />
              </a>
            )}
          </div>
        </div>
      ))}
    </section>
  );
};

export default MaintenanceBanner;
