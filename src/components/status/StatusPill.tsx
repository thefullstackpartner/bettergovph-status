import { FC } from 'react';
import { cn } from '../../lib/utils';
import type { CheckStatus } from '../../types';

type Props = {
  status: CheckStatus | 'unknown';
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

const StatusPill: FC<Props> = ({ status, className }) => {
  const cfg = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2.5 py-0.5 font-mono-ed text-[11px] font-medium uppercase tracking-[0.06em]',
        cfg.pill,
        className
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', cfg.dot)} aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
};

export default StatusPill;
