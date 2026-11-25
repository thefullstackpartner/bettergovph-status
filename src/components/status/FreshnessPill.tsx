import { FC } from 'react';
import { cn } from '../../lib/utils';
import type { FreshnessStatus } from '../../types';

type Props = {
  status: FreshnessStatus;
  referenceDate?: string | null;
  probeError?: string | null;
};

const CONFIG: Record<
  FreshnessStatus,
  { label: string; dot: string; box: string }
> = {
  fresh: {
    label: 'Fresh',
    dot: 'bg-emerald-600',
    box: 'border-emerald-700/25 bg-emerald-50 text-emerald-800',
  },
  stale: {
    label: 'Stale',
    dot: 'bg-amber-600',
    box: 'border-amber-700/30 bg-amber-50 text-amber-900',
  },
  unknown: {
    label: 'Freshness Pending',
    dot: 'bg-ed-ink-4',
    box: 'border-ed-rule bg-ed-paper-2 text-ed-ink-3',
  },
};

function formatAgeBadge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'today';
  return `${days}d ago`;
}

const FreshnessPill: FC<Props> = ({ status, referenceDate, probeError }) => {
  const c = CONFIG[status];
  const age = formatAgeBadge(referenceDate);
  const title =
    probeError === 'waf_403'
      ? 'Freshness probe blocked by portal WAF (403)'
      : referenceDate
        ? `Last content update: ${new Date(referenceDate).toISOString()}`
        : 'Content freshness status';

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 border px-2.5 py-0.5 font-mono-ed text-[11px] font-medium uppercase tracking-[0.06em]',
        c.box
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', c.dot)} aria-hidden="true" />
      <span>{c.label}</span>
      {age && <span className="font-normal opacity-80">· {age}</span>}
    </span>
  );
};

export default FreshnessPill;
