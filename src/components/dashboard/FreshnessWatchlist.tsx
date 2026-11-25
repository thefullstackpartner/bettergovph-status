import { FC, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FreshnessPill } from '../status';
import { Card, SectionHeader } from '../ui';
import { formatFreshnessSignal, formatRelativeTime } from '../../lib/format';
import type { MonitorSummary } from '../../types';

type Props = {
  monitors: MonitorSummary[];
  staleDays?: number;
};

const FreshnessWatchlist: FC<Props> = ({ monitors, staleDays = 30 }) => {
  const tracked = useMemo(
    () => monitors.filter(m => m.freshness?.enabled),
    [monitors]
  );

  if (tracked.length === 0) return null;

  const freshCount = tracked.filter(m => m.freshness?.status === 'fresh').length;
  const staleCount = tracked.filter(m => m.freshness?.status === 'stale').length;

  return (
    <section className="mt-8" aria-label="Content freshness watchlist">
      <SectionHeader
        label="Content Freshness Watchlist"
        meta={`${tracked.length} tracked · ${freshCount} fresh · ${staleCount} stale (>${staleDays}d)`}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-sans-ed text-sm">
            <thead>
              <tr className="border-b border-ed-rule font-mono-ed text-[11px] uppercase tracking-[0.06em] text-ed-ink-4">
                <th className="py-2 pr-4">Portal</th>
                <th className="py-2 pr-4">Freshness</th>
                <th className="py-2 pr-4">Last Content Update</th>
                <th className="py-2 pr-4">Detection Method</th>
                <th className="py-2 text-right">30d Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ed-rule">
              {tracked.map(m => {
                const fr = m.freshness!;
                const refDate = fr.contentUpdatedAt ?? fr.lastChangedAt;
                return (
                  <tr key={m.slug} className="hover:bg-ed-paper-2/60">
                    <td className="py-3 pr-4">
                      <Link
                        to={`/monitors/${m.slug}`}
                        className="font-serif-ed font-semibold text-ed-ink no-underline hover:text-ed-navy hover:underline"
                      >
                        {m.name}
                      </Link>
                      <div className="font-mono-ed text-[11px] text-ed-ink-4">
                        {m.agency}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <FreshnessPill
                        status={fr.status}
                        referenceDate={refDate}
                        probeError={fr.probeError}
                      />
                    </td>
                    <td className="py-3 pr-4 font-mono-ed text-xs text-ed-ink-2">
                      {refDate ? formatRelativeTime(refDate) : 'Pending'}
                    </td>
                    <td className="py-3 pr-4 font-sans-ed text-xs text-ed-ink-3">
                      {formatFreshnessSignal(fr.signalSource)}
                    </td>
                    <td className="py-3 text-right font-mono-ed text-xs font-semibold text-ed-ink">
                      {fr.changeCount30d}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
};

export default FreshnessWatchlist;
