import { FC } from 'react';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  XCircleIcon,
} from 'lucide-react';
import { formatRelativeTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { SummaryResponse } from '../../types';
import { Eyebrow } from '../ui';

type Props = {
  summary: SummaryResponse;
};

const OverallBanner: FC<Props> = ({ summary }) => {
  const { counts, generatedAt } = summary;
  const hasDown = counts.down > 0;
  const hasDegraded = counts.degraded > 0;
  const allUnknown = counts.unknown === counts.total;

  let tone: 'ok' | 'warn' | 'down' | 'pending' = 'ok';
  let title = 'All monitored portals operational';
  let Icon = CheckCircle2Icon;

  if (allUnknown) {
    tone = 'pending';
    title = 'Awaiting initial status checks';
    Icon = ClockIcon;
  } else if (hasDown) {
    tone = 'down';
    title = `${counts.down} ${counts.down === 1 ? 'service' : 'services'} currently down`;
    Icon = XCircleIcon;
  } else if (hasDegraded) {
    tone = 'warn';
    title = `${counts.degraded} ${counts.degraded === 1 ? 'service' : 'services'} experiencing slow responses`;
    Icon = AlertTriangleIcon;
  }

  const wrapperClass = {
    ok: 'border-success-500 bg-success-50 text-ed-ink',
    warn: 'border-warning-500 bg-warning-50 text-ed-ink',
    down: 'border-ed-red bg-red-50 text-ed-ink',
    pending: 'border-ed-rule-strong bg-ed-paper-2 text-ed-ink',
  }[tone];

  const iconClass = {
    ok: 'text-success-600',
    warn: 'text-warning-600',
    down: 'text-ed-red',
    pending: 'text-ed-ink-3',
  }[tone];

  return (
    <section
      aria-label="Overall system status"
      className={cn(
        'border border-l-4 p-6 md:flex md:items-center md:justify-between md:gap-6',
        wrapperClass
      )}
    >
      <div className="flex items-start gap-4">
        <Icon className={cn('mt-0.5 h-7 w-7 shrink-0', iconClass)} />
        <div>
          <Eyebrow>Overall Status</Eyebrow>
          <h1 className="mt-1 font-serif-ed text-2xl font-bold tracking-tight text-ed-ink max-md:text-xl">
            {title}
          </h1>
          <p className="mt-1 font-sans-ed text-sm text-ed-ink-2">
            Tracking {counts.total} Philippine government portals ·{' '}
            <span className="font-medium text-success-700">
              {counts.up} up
            </span>
            {counts.degraded > 0 && (
              <>
                {' · '}
                <span className="font-medium text-warning-700">
                  {counts.degraded} degraded
                </span>
              </>
            )}
            {counts.down > 0 && (
              <>
                {' · '}
                <span className="font-medium text-ed-red-ink">
                  {counts.down} down
                </span>
              </>
            )}
            {counts.unknown > 0 && (
              <>
                {' · '}
                <span className="text-ed-ink-3">
                  {counts.unknown} pending
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-start md:mt-0 md:items-end">
        <span className="font-mono-ed text-[11px] uppercase tracking-[0.12em] text-ed-ink-3">
          Snapshot updated
        </span>
        <span className="mt-0.5 font-mono-ed text-xs font-medium text-ed-ink">
          {formatRelativeTime(generatedAt)}
        </span>
      </div>
    </section>
  );
};

export default OverallBanner;
