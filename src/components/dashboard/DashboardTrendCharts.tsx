import { FC, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardDailyPoint } from '../../types';
import { SectionHeader } from '../ui';

type Props = {
  dailyTrend: DashboardDailyPoint[];
  days: number;
};

const DashboardTrendCharts: FC<Props> = ({ dailyTrend, days }) => {
  // For 1-year (365 points), bucket into ~52 weekly averages/sums so bars stay legible
  const chartSeries = useMemo(() => {
    if (dailyTrend.length <= 90) return dailyTrend;
    const buckets: DashboardDailyPoint[] = [];
    const chunkSize = 7;
    for (let i = 0; i < dailyTrend.length; i += chunkSize) {
      const slice = dailyTrend.slice(i, i + chunkSize);
      const total = slice.reduce((s, d) => s + d.total, 0);
      const up = slice.reduce((s, d) => s + d.up, 0);
      const degraded = slice.reduce((s, d) => s + d.degraded, 0);
      const waf = slice.reduce((s, d) => s + d.waf, 0);
      const down = slice.reduce((s, d) => s + d.down, 0);
      const avgMs = Math.round(
        slice.reduce((s, d) => s + d.avgMs, 0) / slice.length
      );
      buckets.push({
        day: slice[0].day,
        total,
        up,
        degraded,
        waf,
        down,
        availabilityPct:
          total > 0 ? Math.round(((total - down) / total) * 10000) / 100 : 0,
        avgMs,
      });
    }
    return buckets;
  }, [dailyTrend]);

  const bucketLabel = days > 90 ? 'Weekly rollup' : 'Daily';

  return (
    <section
      aria-label="Network trends"
      className="mt-8 grid gap-6 lg:grid-cols-2"
    >
      <div>
        <SectionHeader
          label="Check Outcomes Over Time"
          meta={`${bucketLabel} · ${days}d`}
        />
        <div className="h-72 w-full border border-ed-rule bg-white p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartSeries}>
              <CartesianGrid stroke="#dbe3ef" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#252629' }}
                minTickGap={32}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#252629' }}
                width={56}
                tickFormatter={v =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  borderColor: '#0c1b33',
                  borderRadius: 0,
                  fontSize: 12,
                }}
                formatter={(val: number, name: string) => [
                  val.toLocaleString(),
                  name.toUpperCase(),
                ]}
              />
              <Bar dataKey="up" stackId="checks" fill="#00af5f" name="Up" />
              <Bar dataKey="waf" stackId="checks" fill="#b8893a" name="WAF" />
              <Bar
                dataKey="degraded"
                stackId="checks"
                fill="#f58900"
                name="Degraded"
              />
              <Bar
                dataKey="down"
                stackId="checks"
                fill="#c8102e"
                name="Down"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <SectionHeader
          label="Network Response Time"
          meta={`${bucketLabel} avg (ms)`}
        />
        <div className="h-72 w-full border border-ed-rule bg-white p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartSeries}>
              <CartesianGrid stroke="#dbe3ef" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#252629' }}
                minTickGap={32}
              />
              <YAxis
                unit=" ms"
                tick={{ fontSize: 11, fill: '#252629' }}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  borderColor: '#0c1b33',
                  borderRadius: 0,
                  fontSize: 12,
                }}
                formatter={(val: number) => [`${val} ms`, 'Avg Latency']}
              />
              <Area
                type="monotone"
                dataKey="avgMs"
                stroke="#0b4fd9"
                fill="#e8efff"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default DashboardTrendCharts;
