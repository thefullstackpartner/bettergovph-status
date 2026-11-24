import { FC } from 'react';
import { formatIncidentCause } from '../../lib/format';
import type { IncidentCauseSummary } from '../../types';
import { SectionHeader } from '../ui';

type Props = {
  causes: IncidentCauseSummary[];
  totalIncidents: number;
};

const IncidentCausesPanel: FC<Props> = ({ causes, totalIncidents }) => {
  return (
    <section aria-label="Incident cause breakdown" className="mt-8">
      <SectionHeader
        label="Top Incident Causes"
        meta={`${totalIncidents.toLocaleString()} total incidents`}
      />
      <div className="border border-ed-rule bg-white p-5">
        {causes.length === 0 ? (
          <p className="font-sans-ed text-sm text-ed-ink-4">
            No incidents recorded in this window.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {causes.map(item => {
              const info = formatIncidentCause(item.cause);
              return (
                <div key={item.cause} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 font-sans-ed text-xs">
                    <span className="font-semibold text-ed-ink">
                      {info.label}
                    </span>
                    <span className="shrink-0 font-mono-ed text-ed-ink-4">
                      {item.count.toLocaleString()} ({item.pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-ed-paper-3">
                    <div
                      className="h-2 bg-ed-navy"
                      style={{
                        width: `${Math.min(100, Math.max(2, item.pct))}%`,
                      }}
                    />
                  </div>
                  <p className="font-sans-ed text-[11px] leading-relaxed text-ed-ink-4">
                    {info.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default IncidentCausesPanel;
