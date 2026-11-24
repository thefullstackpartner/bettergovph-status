import { FC, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpDownIcon } from 'lucide-react';
import type { CategoryPerformance } from '../../types';
import { cn } from '../../lib/utils';
import { InfoHint, SectionHeader } from '../ui';

type SortKey =
  | 'availabilityPct'
  | 'cleanUptimePct'
  | 'downPct'
  | 'avgMs'
  | 'incidentCount';

type Props = {
  categories: CategoryPerformance[];
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
};

const CategoryLeaderboard: FC<Props> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  const [sortBy, setSortBy] = useState<SortKey>('availabilityPct');
  const [sortAsc, setSortAsc] = useState(true); // Worst availability first by default

  const sorted = useMemo(() => {
    const copy = [...categories];
    copy.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return sortAsc ? diff : -diff;
    });
    return copy;
  }, [categories, sortBy, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortBy(key);
      // Default to worst-first for availability, highest-first for latency/down/incidents
      setSortAsc(key === 'availabilityPct' || key === 'cleanUptimePct');
    }
  };

  const chartData = useMemo(
    () =>
      [...categories]
        .sort((a, b) => a.availabilityPct - b.availabilityPct)
        .map(c => ({
          name: c.name.length > 24 ? `${c.name.slice(0, 22)}…` : c.name,
          fullName: c.name,
          slug: c.slug,
          availabilityPct: c.availabilityPct,
        })),
    [categories]
  );

  return (
    <section aria-label="Category performance comparison" className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SectionHeader
          label="Category Performance"
          meta={`${categories.length} categories · click a row to filter monitors`}
          className="mb-0"
        />
        {selectedCategory !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className="cursor-pointer font-sans-ed text-xs font-semibold text-ed-navy hover:underline"
          >
            Clear category filter
          </button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="border border-ed-rule bg-white p-4 xl:col-span-2">
          <div className="mb-2 font-sans-ed text-xs font-semibold uppercase tracking-wider text-ed-ink-4">
            Availability by Category (Worst to Best)
          </div>
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke="#dbe3ef" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={[
                    (dataMin: number) => Math.max(0, Math.floor(dataMin - 2)),
                    100,
                  ]}
                  unit="%"
                  tick={{ fontSize: 11, fill: '#252629' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={145}
                  tick={{ fontSize: 11, fill: '#252629' }}
                />
                <Tooltip
                  contentStyle={{
                    borderColor: '#0c1b33',
                    borderRadius: 0,
                    fontSize: 12,
                  }}
                  formatter={(val: number) => [`${val.toFixed(2)}%`, 'Availability']}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullName ?? ''
                  }
                />
                <Bar dataKey="availabilityPct" radius={0}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={entry.slug}
                      fill={
                        idx === 0
                          ? '#c8102e'
                          : idx < 3
                            ? '#f58900'
                            : '#0b4fd9'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-x-auto border border-ed-rule bg-white xl:col-span-3">
          <table className="w-full border-collapse text-left font-sans-ed text-xs">
            <thead>
              <tr className="border-b border-ed-rule bg-ed-paper-2 text-[11px] font-semibold uppercase tracking-wider text-ed-ink-4">
                <th className="px-4 py-3">Category</th>
                <th className="px-3 py-3 text-right">Portals</th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('availabilityPct')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-ed-ink"
                    >
                      Avail %
                      <ArrowUpDownIcon className="h-3 w-3" />
                    </button>
                    <InfoHint
                      label="Availability percentage"
                      align="right"
                      text="Reachability %: checks that did not fail (up, degraded, or WAF-blocked)."
                    />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('cleanUptimePct')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-ed-ink"
                    >
                      Clean %
                      <ArrowUpDownIcon className="h-3 w-3" />
                    </button>
                    <InfoHint
                      label="Clean uptime percentage"
                      align="right"
                      text="Strictly healthy 'up' checks only; excludes down, degraded, and WAF 403."
                    />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    WAF %
                    <InfoHint
                      label="WAF blocked percentage"
                      align="right"
                      text="Checks where a portal's firewall blocked our probe with HTTP 403 (portal is online, probe was blocked)."
                    />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('downPct')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-ed-ink"
                    >
                      Down %
                      <ArrowUpDownIcon className="h-3 w-3" />
                    </button>
                    <InfoHint
                      label="Down percentage"
                      align="right"
                      text="Checks that timed out, failed DNS/TLS, or returned fatal server errors."
                    />
                  </span>
                </th>
                <th className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('avgMs')}
                    className="inline-flex cursor-pointer items-center gap-1 hover:text-ed-ink"
                  >
                    Avg ms
                    <ArrowUpDownIcon className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('incidentCount')}
                    className="inline-flex cursor-pointer items-center gap-1 hover:text-ed-ink"
                  >
                    Incidents
                    <ArrowUpDownIcon className="h-3 w-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(cat => {
                const isSelected = selectedCategory === cat.slug;
                return (
                  <tr
                    key={cat.slug}
                    onClick={() =>
                      onSelectCategory(isSelected ? 'all' : cat.slug)
                    }
                    className={cn(
                      'cursor-pointer border-b border-ed-rule transition-colors last:border-b-0 hover:bg-ed-paper-2',
                      isSelected && 'bg-ed-navy-tint'
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-ed-ink">
                      {cat.name}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-ed text-ed-ink-4">
                      {cat.monitorCount}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right font-mono-ed font-semibold',
                        cat.availabilityPct < 97
                          ? 'text-ed-red'
                          : cat.availabilityPct < 99
                            ? 'text-warning-700'
                            : 'text-success-700'
                      )}
                    >
                      {cat.availabilityPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-ed text-ed-ink-2">
                      {cat.cleanUptimePct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-ed text-ed-ink-4">
                      {cat.wafPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-ed text-ed-red">
                      {cat.downPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-ed text-ed-ink-2">
                      {cat.avgMs}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-ed text-ed-ink-2">
                      {cat.incidentCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default CategoryLeaderboard;
