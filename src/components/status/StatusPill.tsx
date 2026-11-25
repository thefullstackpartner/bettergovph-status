import { FC } from 'react';
import { cn } from '../../lib/utils';
import type { CheckStatus, MonitorMaintenance } from '../../types';

type Props = {
  status: CheckStatus | 'unknown';
  error?: string | null;
  maintenance?: MonitorMaintenance | null;
  className?: string;
};

const STYLES: Record<
  CheckStatus | 'unknown',
  { label: string; dot: string; pill: string }
> = {
  up: {
    label: 'Operational',
    dot: 'bg-success-500',
    pill: 'border-success-500/30 bg-success-50 text-success-700',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-warning-500',
    pill: 'border-warning-500/30 bg-warning-50 text-warning-700',
  },
  down: {
    label: 'Down',
    dot: 'bg-ed-red',
    pill: 'border-ed-red/30 bg-red-50 text-ed-red-ink',
  },
  unknown: {
    label: 'Pending',
    dot: 'bg-ed-ink-4',
    pill: 'border-ed-rule bg-ed-paper-2 text-ed-ink-3',
  },
};

const WAF_STYLE = {
  label: 'Probe Blocked (WAF)',
  dot: 'bg-indigo-500',
  pill: 'border-indigo-300 bg-indigo-50 text-indigo-800',
};

const SCHEDULED_MAINTENANCE_STYLE = {
  label: 'Scheduled Maintenance',
  dot: 'bg-amber-500',
  pill: 'border-amber-300 bg-amber-50 text-amber-900',
};

const StatusPill: FC<Props> = ({ status, error, maintenance, className }) => {
  const isScheduledMaintenance =
    (status !== 'up' && error === 'maintenance_scheduled') ||
    (status !== 'up' && maintenance?.status === 'active');
  const isWaf = !isScheduledMaintenance && status === 'degraded' && error === 'waf_403';
  const isMaintenance = !isScheduledMaintenance && status === 'down' && error === 'maintenance';
  const isNotFound = !isScheduledMaintenance && status === 'down' && error === 'not_found';
  const isTimeout = !isScheduledMaintenance && status === 'down' && error === 'timeout';
  const cfg = isScheduledMaintenance
    ? SCHEDULED_MAINTENANCE_STYLE
    : isWaf
      ? WAF_STYLE
      : STYLES[status];
  const label = isScheduledMaintenance
    ? cfg.label
    : isMaintenance
      ? 'Under Maintenance'
      : isNotFound
        ? 'Not Found (404)'
        : isTimeout
          ? 'Down · Timeout'
          : cfg.label;
  const title = isScheduledMaintenance
    ? maintenance?.title
      ? `Scheduled maintenance: ${maintenance.title}`
      : 'This portal is undergoing scheduled maintenance.'
    : isWaf
    ? 'This portal’s firewall blocked automated monitoring; it may still be accessible in your browser.'
    : isMaintenance
      ? 'This portal is displaying a maintenance page and cannot currently be used.'
      : isNotFound
        ? 'This URL returned HTTP 404 (Not Found); the page may have moved or been removed.'
        : isTimeout
          ? 'The server did not respond within the 15-second check timeout window.'
          : undefined;

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 border px-2.5 py-0.5 font-mono-ed text-[11px] font-medium uppercase tracking-[0.06em]',
        cfg.pill,
        className
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', cfg.dot)} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export default StatusPill;
