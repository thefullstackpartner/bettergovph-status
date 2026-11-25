import { FC } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLinkIcon } from 'lucide-react';
import { formatMs, formatUptime } from '../../lib/format';
import type { MonitorSummary } from '../../types';
import StatusPill from './StatusPill';
import FreshnessPill from './FreshnessPill';
import UptimeBars from './UptimeBars';

type Props = {
  monitor: MonitorSummary;
  granularity?: 'hourly' | 'daily';
};

const MonitorRow: FC<Props> = ({ monitor, granularity = 'hourly' }) => {
  const hourlyTotals = (monitor.hourly24h ?? []).reduce(
    (acc, h) => ({ total: acc.total + h.total, waf: acc.waf + (h.waf ?? 0) }),
    { total: 0, waf: 0 }
  );
  const isWafUnverified24h =
    hourlyTotals.total > 0 && hourlyTotals.waf / hourlyTotals.total >= 0.95;

  return (
  <div className="border border-ed-rule bg-white p-5 transition-colors hover:border-ed-ink">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/monitors/${monitor.slug}`}
            className="font-serif-ed text-lg font-semibold text-ed-ink no-underline hover:text-ed-navy hover:underline"
          >
            {monitor.name}
          </Link>
          {monitor.tier === 'critical' && (
            <span
              title="Curated critical citizen portal — checked every 5 minutes"
              className="border border-ed-navy/25 bg-ed-navy/5 px-1.5 py-0.5 font-mono-ed text-[10px] font-semibold uppercase tracking-[0.06em] text-ed-navy"
            >
              Critical
            </span>
          )}
        </div>
        <p className="mt-0.5 font-sans-ed text-xs text-ed-ink-3">
          {monitor.agency}
          {' · '}
          <a
            href={monitor.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono-ed text-[11px] text-ed-ink-3 hover:text-ed-navy"
          >
            <span>{monitor.url.replace(/^https?:\/\//, '')}</span>
            <ExternalLinkIcon size={11} />
          </a>
        </p>
      </div>

      <div className="flex w-full flex-col items-start gap-2 border-t border-ed-rule/60 pt-3 sm:w-auto sm:flex-row sm:items-center sm:gap-3 sm:border-t-0 sm:pt-0">
        <div className="text-left font-mono-ed text-xs sm:text-right">
          <div className="font-medium text-ed-ink">
            {formatMs(monitor.lastResponseMs)}
          </div>
          <div className="text-[11px] text-ed-ink-4">
            {monitor.lastError === 'waf_403' || isWafUnverified24h
              ? 'WAF 403'
              : monitor.lastError === 'maintenance_scheduled'
                ? 'Scheduled'
                : monitor.lastError === 'maintenance'
                  ? 'Maintenance'
                  : monitor.lastError === 'not_found'
                    ? 'HTTP 404'
                    : monitor.lastError === 'timeout'
                      ? 'Timed out'
                      : `24h: ${formatUptime(monitor.uptime24h)}`}
          </div>
        </div>
        <StatusPill
          status={monitor.status}
          error={monitor.lastError}
          maintenance={monitor.maintenance}
        />
        {monitor.freshness?.enabled && (
          <FreshnessPill
            status={monitor.freshness.status}
            referenceDate={
              monitor.freshness.contentUpdatedAt ??
              monitor.freshness.lastChangedAt
            }
            probeError={monitor.freshness.probeError}
          />
        )}
      </div>
    </div>

    <div className="mt-4">
      <UptimeBars
        granularity={granularity}
        bars={monitor.bars90d}
        hourlyBars={monitor.hourly24h ?? []}
        days={45}
        hours={24}
        compact
      />
      <div className="mt-1 flex justify-between font-mono-ed text-[10px] text-ed-ink-4">
        <span>{granularity === 'hourly' ? '24 hours ago' : '45 days ago'}</span>
        <span>{granularity === 'hourly' ? 'Now' : 'Today'}</span>
      </div>
    </div>
  </div>
  );
};

export default MonitorRow;
