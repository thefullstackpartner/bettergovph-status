import { FC } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLinkIcon } from 'lucide-react';
import { formatMs, formatUptime } from '../../lib/format';
import type { MonitorSummary } from '../../types';
import StatusPill from './StatusPill';
import UptimeBars from './UptimeBars';

type Props = {
  monitor: MonitorSummary;
  granularity?: 'hourly' | 'daily';
};

const MonitorRow: FC<Props> = ({ monitor, granularity = 'hourly' }) => (
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

      <div className="flex items-center gap-4">
        <div className="text-right font-mono-ed text-xs">
          <div className="font-medium text-ed-ink">
            {formatMs(monitor.lastResponseMs)}
          </div>
          <div className="text-[11px] text-ed-ink-4">
            {monitor.lastError === 'waf_403'
              ? 'WAF 403'
              : monitor.lastError === 'maintenance'
                ? 'Maintenance'
                : monitor.lastError === 'not_found'
                  ? 'HTTP 404'
                  : `24h: ${formatUptime(monitor.uptime24h)}`}
          </div>
        </div>
        <StatusPill status={monitor.status} error={monitor.lastError} />
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

export default MonitorRow;
