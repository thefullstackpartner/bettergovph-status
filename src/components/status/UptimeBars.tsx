import { FC, KeyboardEvent, useMemo, useState } from 'react';
import { XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DailyBar, HourlyBar } from '../../types';

type Props = {
  granularity?: 'daily' | 'hourly';
  bars?: DailyBar[];
  hourlyBars?: HourlyBar[];
  days?: number;
  hours?: number;
  compact?: boolean;
};

type SlotStats = {
  total: number;
  up: number;
  degraded: number;
  waf?: number;
  down: number;
  avgMs: number;
};

function getLastNDays(n: number): string[] {
  const result: string[] = [];
  const now = Date.now();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  for (let i = n - 1; i >= 0; i--) {
    result.push(fmt.format(new Date(now - i * 86_400_000)));
  }
  return result;
}

function getLastNHours(n: number): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const now = new Date();
  const currentHourUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours()
  );
  const labelFmt = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(currentHourUtc - i * 3_600_000);
    const key = dt.toISOString().slice(0, 13) + ':00:00Z';
    result.push({
      key,
      label: `${labelFmt.format(dt)} PHT`,
    });
  }
  return result;
}

const UptimeBars: FC<Props> = ({
  granularity = 'daily',
  bars = [],
  hourlyBars = [],
  days = 45,
  hours = 24,
  compact = false,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const slots = useMemo(() => {
    const rawSlots =
      granularity === 'hourly'
        ? (() => {
            const byHour = new Map<string, SlotStats>(
              hourlyBars.map(h => [h.hour, h])
            );
            return getLastNHours(hours).map(({ key, label }) => ({
              key,
              displayLabel: label,
              data: byHour.get(key) ?? null,
            }));
          })()
        : (() => {
            const byDay = new Map<string, SlotStats>(bars.map(b => [b.day, b]));
            return getLastNDays(days).map(day => ({
              key: day,
              displayLabel: day,
              data: byDay.get(day) ?? null,
            }));
          })();

    return rawSlots.map(({ key, displayLabel, data }) => {
      let colorClass = 'bg-ed-paper-3';
      let label = `${displayLabel}: No data`;

      if (data && data.total > 0) {
        const wafCount = data.waf ?? 0;
        const okCount = data.up + data.degraded + wafCount;
        const uptimePct = Math.round((okCount / data.total) * 1000) / 10;
        if (data.down > 0 && data.down / data.total >= 0.5) {
          colorClass = 'bg-ed-red';
        } else if (data.down > 0) {
          colorClass = 'bg-warning-500';
        } else if (wafCount > data.up && wafCount >= data.degraded) {
          colorClass = 'bg-indigo-500';
        } else if (data.degraded > data.up) {
          colorClass = 'bg-warning-500';
        } else {
          colorClass = 'bg-success-500';
        }
        const suffix =
          wafCount > data.up && wafCount >= data.degraded && data.down === 0
            ? ', probe blocked'
            : '';
        label = `${displayLabel}: ${uptimePct}% up (${data.total} checks, avg ${data.avgMs} ms${suffix})`;
      }

      return { key, colorClass, label };
    });
  }, [granularity, bars, hourlyBars, days, hours]);

  const activeKey = hoveredKey ?? selectedKey;
  const activeSlot = activeKey
    ? slots.find(s => s.key === activeKey) ?? null
    : null;

  const ariaTitle =
    granularity === 'hourly'
      ? `Uptime over the last ${hours} hours`
      : `Uptime over the last ${days} days`;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedKey(prev => (prev === key ? null : key));
    } else if (e.key === 'Escape') {
      setSelectedKey(null);
      setHoveredKey(null);
    }
  };

  return (
    <div className="w-full">
      <div
        className="flex w-full items-center gap-[2px]"
        role="list"
        aria-label={ariaTitle}
      >
        {slots.map(({ key, colorClass, label }) => {
          const isActive = activeKey === key;
          return (
            <div
              key={key}
              role="listitem"
              tabIndex={0}
              title={label}
              aria-label={label}
              aria-current={isActive ? 'true' : undefined}
              onClick={() =>
                setSelectedKey(prev => (prev === key ? null : key))
              }
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() =>
                setHoveredKey(prev => (prev === key ? null : prev))
              }
              onKeyDown={e => handleKeyDown(e, key)}
              className={cn(
                'flex-1 cursor-pointer rounded-[1px] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ed-navy',
                compact ? 'h-5' : 'h-7',
                colorClass,
                isActive && 'ring-2 ring-ed-ink ring-offset-1'
              )}
            />
          );
        })}
      </div>

      {activeSlot && (
        <div
          role="status"
          className="mt-1.5 flex items-start justify-between gap-2 border border-ed-rule bg-ed-paper-2 px-2.5 py-1.5 font-mono-ed text-[11px] leading-snug text-ed-ink"
        >
          <span className="min-w-0 break-words">{activeSlot.label}</span>
          {selectedKey && (
            <button
              type="button"
              aria-label="Clear selected time block"
              onClick={() => setSelectedKey(null)}
              className="mt-0.5 shrink-0 cursor-pointer text-ed-ink-4 hover:text-ed-ink"
            >
              <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default UptimeBars;
