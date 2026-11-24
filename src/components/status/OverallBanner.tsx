import { FC } from 'react';
import { formatRelativeTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { CheckStatus, SummaryResponse } from '../../types';
import { Eyebrow } from '../ui';

export type BannerStatusFilter = 'all' | CheckStatus | 'unknown' | 'waf';

type Props = {
  summary: SummaryResponse;
  activeStatus?: string;
  onFilterStatus?: (status: BannerStatusFilter) => void;
};

const OverallBanner: FC<Props> = ({
  summary,
  activeStatus = 'all',
  onFilterStatus,
}) => {
  const { counts, generatedAt, monitors } = summary;
  const wafCount = monitors.filter(
    m => m.status === 'degraded' && m.lastError === 'waf_403'
  ).length;
  const degradedCount = Math.max(0, counts.degraded - wafCount);
  const hasDown = counts.down > 0;
  const hasDegraded = degradedCount > 0;
  const allUnknown = counts.unknown === counts.total;

  let title =
    wafCount > 0
      ? 'All reachable portals operational'
      : 'All monitored portals operational';

  if (allUnknown) {
    title = 'Awaiting initial status checks';
  } else if (hasDown) {
    title = `${counts.down} ${counts.down === 1 ? 'service' : 'services'} currently down`;
  } else if (hasDegraded) {
    title = `${degradedCount} ${degradedCount === 1 ? 'service' : 'services'} experiencing degraded responses`;
  }

  const handleSelect = (status: BannerStatusFilter) => {
    if (!onFilterStatus) return;
    onFilterStatus(activeStatus === status ? 'all' : status);
  };

  const chipClass = (status: BannerStatusFilter): string =>
    cn(
      'inline-flex items-center gap-2 border px-2.5 py-1 font-mono-ed text-xs transition-colors',
      activeStatus === status
        ? 'border-white bg-white font-semibold text-neutral-950'
        : 'border-white/20 bg-white/5 text-white/85 hover:border-white/50 hover:bg-white/10',
      onFilterStatus ? 'cursor-pointer' : 'cursor-default'
    );

  return (
    <section
      aria-label="Overall system status"
      className="border border-neutral-900 bg-neutral-950 p-6 text-white md:flex md:items-center md:justify-between md:gap-6"
    >
      <div>
        <Eyebrow tone="onDark">Overall Status</Eyebrow>
        <h1 className="mt-1 font-serif-ed text-2xl font-bold tracking-tight text-white max-md:text-xl">
          {title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 font-sans-ed text-xs">
          <button
            type="button"
            onClick={() => onFilterStatus?.('all')}
            aria-pressed={activeStatus === 'all'}
            className={chipClass('all')}
          >
            <span>{counts.total} total</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelect('up')}
            aria-pressed={activeStatus === 'up'}
            className={chipClass('up')}
          >
            <span
              className="h-2 w-2 rounded-full bg-success-500"
              aria-hidden="true"
            />
            <span>{counts.up} up</span>
          </button>
          {degradedCount > 0 && (
            <button
              type="button"
              onClick={() => handleSelect('degraded')}
              aria-pressed={activeStatus === 'degraded'}
              className={chipClass('degraded')}
            >
              <span
                className="h-2 w-2 rounded-full bg-warning-500"
                aria-hidden="true"
              />
              <span>{degradedCount} degraded</span>
            </button>
          )}
          {wafCount > 0 && (
            <button
              type="button"
              onClick={() => handleSelect('waf')}
              aria-pressed={activeStatus === 'waf'}
              className={chipClass('waf')}
            >
              <span
                className="h-2 w-2 rounded-full bg-indigo-400"
                aria-hidden="true"
              />
              <span>{wafCount} probe blocked</span>
            </button>
          )}
          {counts.down > 0 && (
            <button
              type="button"
              onClick={() => handleSelect('down')}
              aria-pressed={activeStatus === 'down'}
              className={chipClass('down')}
            >
              <span
                className="h-2 w-2 rounded-full bg-ed-red"
                aria-hidden="true"
              />
              <span>{counts.down} down</span>
            </button>
          )}
          {counts.unknown > 0 && (
            <button
              type="button"
              onClick={() => handleSelect('unknown')}
              aria-pressed={activeStatus === 'unknown'}
              className={chipClass('unknown')}
            >
              <span
                className="h-2 w-2 rounded-full bg-white/40"
                aria-hidden="true"
              />
              <span>{counts.unknown} pending</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-start md:mt-0 md:items-end">
        <span className="font-mono-ed text-[11px] uppercase tracking-[0.12em] text-white/60">
          Snapshot updated
        </span>
        <span className="mt-0.5 font-mono-ed text-xs font-medium text-white">
          {formatRelativeTime(generatedAt)}
        </span>
      </div>
    </section>
  );
};

export default OverallBanner;
