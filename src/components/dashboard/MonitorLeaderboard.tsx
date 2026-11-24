import { FC, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDownIcon, SearchIcon } from 'lucide-react';
import type { CategoryPerformance, MonitorPerformanceRow } from '../../types';
import { cn } from '../../lib/utils';
import { Button, InfoHint, Pagination, SectionHeader } from '../ui';

type SpotlightTab = 'worst' | 'best' | 'slowest' | 'incidents';
type TableSortKey = 'availabilityPct' | 'cleanUptimePct' | 'avgMs' | 'incidentCount';

type Props = {
  monitors: MonitorPerformanceRow[];
  worstPerformers: MonitorPerformanceRow[];
  bestPerformers: MonitorPerformanceRow[];
  slowestMonitors: MonitorPerformanceRow[];
  mostIncidents: MonitorPerformanceRow[];
  categories: CategoryPerformance[];
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
};

const PAGE_SIZE = 25;

const MonitorLeaderboard: FC<Props> = ({
  monitors,
  worstPerformers,
  bestPerformers,
  slowestMonitors,
  mostIncidents,
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  const [spotlight, setSpotlight] = useState<SpotlightTab>('worst');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<TableSortKey>('availabilityPct');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory]);

  const spotlightRows = useMemo(() => {
    switch (spotlight) {
      case 'best':
        return bestPerformers;
      case 'slowest':
        return slowestMonitors;
      case 'incidents':
        return mostIncidents;
      case 'worst':
      default:
        return worstPerformers;
    }
  }, [spotlight, worstPerformers, bestPerformers, slowestMonitors, mostIncidents]);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = monitors.filter(m => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) {
        return false;
      }
      if (q) {
        const hay = `${m.name} ${m.agency} ${m.categoryName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return sortAsc ? diff : -diff;
    });
    return filtered;
  }, [monitors, selectedCategory, search, sortBy, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredAndSorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleSort = (key: TableSortKey) => {
    if (sortBy === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortBy(key);
      setSortAsc(key === 'availabilityPct' || key === 'cleanUptimePct');
    }
    setPage(1);
  };

  return (
    <section aria-label="Monitor performance rankings" className="mt-10">
      <SectionHeader
        label="Monitor Spotlights"
        meta="Top 10 across selected window"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: 'worst', label: 'Worst Performing' },
            { id: 'best', label: 'Best Performing' },
            { id: 'slowest', label: 'Slowest Latency' },
            { id: 'incidents', label: 'Most Incidents' },
          ] as const
        ).map(tab => (
          <Button
            key={tab.id}
            size="sm"
            variant={spotlight === tab.id ? 'solid' : 'ghost'}
            onClick={() => setSpotlight(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {spotlightRows.map((m, idx) => (
          <Link
            key={m.slug}
            to={`/monitors/${m.slug}`}
            className="flex flex-col justify-between border border-ed-rule bg-white p-4 text-ed-ink no-underline transition-colors hover:border-ed-navy"
          >
            <div>
              <div className="flex items-center justify-between font-mono-ed text-[11px] text-ed-ink-4">
                <span>#{idx + 1}</span>
                <span className="uppercase">{m.tier}</span>
              </div>
              <div className="mt-1.5 line-clamp-2 font-serif-ed text-sm font-bold text-ed-ink">
                {m.name}
              </div>
              <div className="mt-0.5 truncate font-sans-ed text-[11px] text-ed-ink-4">
                {m.categoryName}
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-ed-rule pt-2 font-mono-ed text-xs">
              <span
                className={cn(
                  'font-bold',
                  m.availabilityPct < 95
                    ? 'text-ed-red'
                    : m.availabilityPct >= 99.5
                      ? 'text-success-700'
                      : 'text-ed-ink'
                )}
              >
                {m.availabilityPct.toFixed(2)}%
              </span>
              <span className="text-ed-ink-4">{m.avgMs} ms</span>
            </div>
          </Link>
        ))}
      </div>

      <div id="monitor-leaderboard" className="mt-8 scroll-mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            label="Full Monitor Leaderboard"
            meta={`${filteredAndSorted.length} of ${monitors.length} portals`}
            className="mb-0"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex items-center">
              <SearchIcon
                className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ed-ink-4"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search portal or agency..."
                aria-label="Search monitors in leaderboard"
                className="border border-ed-rule bg-white py-1.5 pl-8 pr-3 font-sans-ed text-xs text-ed-ink placeholder:text-ed-ink-4 focus:border-ed-navy focus:outline-none"
              />
            </label>
            <select
              aria-label="Filter leaderboard by category"
              value={selectedCategory}
              onChange={e => {
                onSelectCategory(e.target.value);
                setPage(1);
              }}
              className="border border-ed-rule bg-white px-2.5 py-1.5 font-sans-ed text-xs text-ed-ink focus:border-ed-navy focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-ed-rule bg-white">
          <table className="w-full border-collapse text-left font-sans-ed text-xs">
            <thead>
              <tr className="border-b border-ed-rule bg-ed-paper-2 text-[11px] font-semibold uppercase tracking-wider text-ed-ink-4">
                <th className="px-4 py-3">Portal</th>
                <th className="px-3 py-3">Category</th>
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
                      text="Checks where a portal's firewall blocked our probe with HTTP 403."
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
              {pagedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center font-sans-ed text-sm text-ed-ink-4"
                  >
                    No portals match your current filter.
                  </td>
                </tr>
              ) : (
                pagedRows.map(m => (
                  <tr
                    key={m.slug}
                    className="border-b border-ed-rule last:border-b-0 hover:bg-ed-paper-2"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/monitors/${m.slug}`}
                        className="font-semibold text-ed-navy no-underline hover:underline"
                      >
                        {m.name}
                      </Link>
                      <div className="text-[11px] text-ed-ink-4">{m.agency}</div>
                    </td>
                    <td className="px-3 py-2.5 text-ed-ink-2">{m.categoryName}</td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right font-mono-ed font-semibold',
                        m.availabilityPct < 95
                          ? 'text-ed-red'
                          : m.availabilityPct < 99
                            ? 'text-warning-700'
                            : 'text-success-700'
                      )}
                    >
                      {m.availabilityPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-ed text-ed-ink-2">
                      {m.cleanUptimePct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-ed text-ed-ink-4">
                      {m.wafPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-ed text-ed-ink-2">
                      {m.avgMs}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-ed text-ed-ink-2">
                      {m.incidentCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
    </section>
  );
};

export default MonitorLeaderboard;
