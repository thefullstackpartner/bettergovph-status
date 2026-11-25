import { FC } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatManilaTimestamp } from '../../lib/format';
import type { CheckPoint, DailyBar } from '../../types';

type Props = {
  range: '24h' | '7d' | '30d' | '90d';
  points: CheckPoint[];
  daily: DailyBar[];
};

const ResponseTimeChart: FC<Props> = ({ range, points, daily }) => {
  const chartData =
    range === '90d'
      ? daily.map(d => ({
          label: d.day,
          ms: d.avgMs,
        }))
      : points.map(p => ({
          label: formatManilaTimestamp(p.checked_at),
          ms: p.response_ms ?? 0,
        }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-ed-rule bg-ed-paper-2 font-sans-ed text-sm text-ed-ink-3">
        No response-time samples recorded for this window yet.
      </div>
    );
  }

  return (
    <div className="h-64 w-full border border-ed-rule bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <CartesianGrid stroke="#dbe3ef" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#252629' }}
            minTickGap={36}
          />
          <YAxis
            unit=" ms"
            tick={{ fontSize: 11, fill: '#252629' }}
            width={64}
          />
          <Tooltip
            formatter={(val: number) => [`${val} ms`, 'Response time']}
            contentStyle={{
              borderColor: '#0c1b33',
              borderRadius: 0,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="ms"
            stroke="#0b4fd9"
            fill="#e8efff"
            strokeWidth={2}
          />
          <ReferenceLine
            y={15000}
            stroke="#c8102e"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{
              value: 'Timeout (15,000 ms)',
              position: 'insideTopRight',
              fill: '#c8102e',
              fontSize: 11,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResponseTimeChart;
