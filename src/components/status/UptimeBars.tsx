import { FC, useMemo } from 'react';
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
  const slots = useMemo(() => {
    if (granularity === 'hourly') {
      const byHour = new Map<string, SlotStats>(
        hourlyBars.map(h => [h.hour, h])
      );
      return getLastNHours(hours).map(({ key, label }) => ({
        key,
        displayLabel: label,
        data: byHour.get(key) ?? null,
      }));
    }

    const byDay = new Map<string, SlotStats>(bars.map(b => [b.day, b]));
    return getLastNDays(days).map(day => ({
      key: day,
      displayLabel: day,
      data: byDay.get(day) ?? null,
    }));
  }, [granularity, bars, hourlyBars, days, hours]);

  const ariaTitle =
    granularity === 'hourly'
      ? `Uptime over the last ${hours} hours`
      : `Uptime over the last ${days} days`;

  return (
    <div
      className="flex w-full items-center gap-[2px]"
      role="list"
      aria-label={ariaTitle}
    >
      {slots.map(({ key, displayLabel, data }) => {
        let colorClass = 'bg-ed-paper-3';
        let label = `${displayLabel}: No data`;

        if (data && data.total > 0) {
          const okCount = data.up + data.degraded;
          const uptimePct = Math.round((okCount / data.total) * 1000) / 10;
          if (data.down > 0 && data.down / data.total >= 0.5) {
            colorClass = 'bg-ed-red';
          } else if (data.down > 0 || data.degraded > data.up) {
            colorClass = 'bg-warning-500';
          } else {
            colorClass = 'bg-success-500';
          }
          label = `${displayLabel}: ${uptimePct}% up (${data.total} checks, avg ${data.avgMs} ms)`;
        }

        return (
          <div
            key={key}
            role="listitem"
            tabIndex={0}
            title={label}
            aria-label={label}
            className={cn(
              'flex-1 rounded-[1px] transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ed-navy',
              compact ? 'h-5' : 'h-7',
              colorClass
            )}
          />
        );
      })}
    </div>
  );
};

export default UptimeBars;
