import { FC } from 'react';
import { cn } from '../../lib/utils';
import type { CheckStatus } from '../../types';

type Props = {
  status: CheckStatus | 'unknown';
  error?: string | null;
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

const StatusPill: FC<Props> = ({ status, error, className }) => {
  const isWaf = status === 'degraded' && error === 'waf_403';
  const isMaintenance = status === 'down' && error === 'maintenance';
  const cfg = isWaf ? WAF_STYLE : STYLES[status];
  const label = isMaintenance ? 'Under Maintenance' : cfg.label;
  const title = isWaf
    ? 'This portal’s firewall blocked automated monitoring; it may still be accessible in your browser.'
    : isMaintenance
      ? 'This portal is displaying a maintenance page and cannot currently be used.'
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
