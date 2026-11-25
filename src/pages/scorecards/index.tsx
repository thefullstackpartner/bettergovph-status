import { FC, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DownloadIcon, ExternalLinkIcon, SearchIcon } from 'lucide-react';
import { GradeBadge } from '../../components/status';
import {
  Button,
  Container,
  Eyebrow,
  Notice,
  SectionHeader,
} from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getScorecards } from '../../lib/api';
import { formatMs } from '../../lib/format';
import type {
  DashboardRange,
  DashboardTierFilter,
  ScorecardsResponse,
} from '../../types';

const PERIODS: Array<{ value: DashboardRange; label: string }> = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' },
];

const TIERS: Array<{ value: DashboardTierFilter; label: string }> = [
  { value: 'all', label: 'All Tiers' },
  { value: 'critical', label: 'Critical' },
  { value: 'standard', label: 'Standard' },
];

function formatMttr(sec: number | null): string {
  if (sec === null) return '—';
  if (sec < 60) return `${sec}s`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function formatPct(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}%`;
}

const ScorecardsPage: FC = () => {
  useDocumentTitle('Reliability Scorecards | BetterGovPH Status');
  const [period, setPeriod] = useState<DashboardRange>('30d');
  const [tier, setTier] = useState<DashboardTierFilter>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'avail_asc' | 'avail_desc' | 'incidents_desc' | 'mttr_desc'
  >('avail_asc');
  const [data, setData] = useState<ScorecardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getScorecards(period, tier)
      .then(res => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load scorecards'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, tier]);

  const filteredMonitors = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? data.monitors.filter(
          m =>
            m.name.toLowerCase().includes(q) ||
            m.agency.toLowerCase().includes(q) ||
            m.categoryName.toLowerCase().includes(q) ||
            m.slug.toLowerCase().includes(q)
        )
      : [...data.monitors];

    list.sort((a, b) => {
      if (sortBy === 'avail_desc') {
        return (b.availabilityPct ?? -1) - (a.availabilityPct ?? -1);
      }
      if (sortBy === 'incidents_desc') {
        return b.incidentCount - a.incidentCount;
      }
      if (sortBy === 'mttr_desc') {
        return (b.mttrSec ?? -1) - (a.mttrSec ?? -1);
      }
      // avail_asc: put monitors with data first, lowest availability at top
      const avA = a.availabilityPct ?? 999;
      const avB = b.availabilityPct ?? 999;
      return avA - avB;
    });
    return list;
  }, [data, query, sortBy]);

  const csvUrl = `/api/scorecards?period=${period}&tier=${tier}&format=csv`;
  const jsonUrl = `/api/scorecards?period=${period}&tier=${tier}&format=json`;

  return (
    <Container className="py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow tone="navy">Public Accountability</Eyebrow>
          <h1 className="mt-1 font-serif-ed text-3xl font-bold text-ed-ink max-md:text-2xl">
            Agency Reliability Scorecards
          </h1>
          <p className="mt-1 max-w-2xl font-sans-ed text-sm text-ed-ink-3">
            Availability grades, incident counts, and Mean Time to Recovery
            (MTTR) across monitored Philippine government portals.{' '}
            <Link
              to="/about#reliability-scorecards"
              className="text-ed-navy hover:underline"
            >
              How grades are calculated
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={csvUrl}
            download
            className="inline-flex items-center gap-1.5 border border-ed-rule bg-white px-3 py-1.5 font-mono-ed text-xs font-medium text-ed-ink no-underline transition-colors hover:border-ed-navy hover:text-ed-navy"
          >
            <DownloadIcon size={13} />
            <span>Export CSV</span>
          </a>
          <a
            href={jsonUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 border border-ed-rule bg-white px-3 py-1.5 font-mono-ed text-xs font-medium text-ed-ink no-underline transition-colors hover:border-ed-navy hover:text-ed-navy"
          >
            <DownloadIcon size={13} />
            <span>JSON</span>
          </a>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-ed-rule bg-ed-paper-2 p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period">
          {PERIODS.map(p => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? 'solid' : 'ghost'}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tier">
          {TIERS.map(t => (
            <Button
              key={t.value}
              size="sm"
              variant={tier === t.value ? 'solid' : 'ghost'}
              onClick={() => setTier(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {loading && !data ? (
        <div className="border border-ed-rule bg-ed-paper-2 p-8 font-sans-ed text-sm text-ed-ink-3">
          Aggregating reliability scorecards...
        </div>
      ) : (
        data && (
          <div className="space-y-8">
            <section>
              <SectionHeader
                label="Category Scorecards"
                meta={`${data.categories.length} categories`}
              />
              <div className="overflow-x-auto border border-ed-rule bg-white">
                <table className="w-full border-collapse text-left font-sans-ed text-sm">
                  <thead>
                    <tr className="border-b border-ed-rule bg-ed-paper-2 font-mono-ed text-[11px] uppercase tracking-wider text-ed-ink-3">
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Portals</th>
                      <th className="px-4 py-3">Availability</th>
                      <th className="px-4 py-3">Avg Latency</th>
                      <th className="px-4 py-3">Incidents</th>
                      <th className="px-4 py-3">Avg MTTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ed-rule">
                    {data.categories.map(c => (
                      <tr key={c.category} className="hover:bg-ed-paper-2/60">
                        <td className="px-4 py-3 font-medium text-ed-ink">
                          <Link
                            to={`/status?category=${encodeURIComponent(c.category)}`}
                            className="text-ed-navy no-underline hover:underline"
                          >
                            {c.categoryName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <GradeBadge grade={c.grade} score={c.score} />
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {c.monitorCount}
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {formatPct(c.availabilityPct)}
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {formatMs(c.avgMs)}
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {c.incidentCount}
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {formatMttr(c.mttrSec)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <SectionHeader
                  label="Portal Scorecards"
                  meta={`${filteredMonitors.length} shown`}
                  className="mb-0"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <SearchIcon
                      size={14}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ed-ink-3"
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Filter portals..."
                      aria-label="Filter portal scorecards"
                      className="border border-ed-rule bg-white py-1.5 pl-8 pr-3 font-sans-ed text-xs text-ed-ink focus:border-ed-navy focus:outline-none"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={e =>
                      setSortBy(e.target.value as typeof sortBy)
                    }
                    aria-label="Sort portal scorecards"
                    className="border border-ed-rule bg-white px-2.5 py-1.5 font-sans-ed text-xs text-ed-ink focus:border-ed-navy focus:outline-none"
                  >
                    <option value="avail_asc">Lowest Availability</option>
                    <option value="avail_desc">Highest Availability</option>
                    <option value="incidents_desc">Most Incidents</option>
                    <option value="mttr_desc">Slowest MTTR</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto border border-ed-rule bg-white">
                <table className="w-full border-collapse text-left font-sans-ed text-sm">
                  <thead>
                    <tr className="border-b border-ed-rule bg-ed-paper-2 font-mono-ed text-[11px] uppercase tracking-wider text-ed-ink-3">
                      <th className="px-4 py-3">Portal</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Availability</th>
                      <th className="px-4 py-3">Avg Latency</th>
                      <th className="px-4 py-3">Incidents</th>
                      <th className="px-4 py-3">MTTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ed-rule">
                    {filteredMonitors.map(m => (
                      <tr key={m.slug} className="hover:bg-ed-paper-2/60">
                        <td className="px-4 py-3">
                          <Link
                            to={`/monitors/${m.slug}`}
                            className="font-serif-ed text-base font-semibold text-ed-ink no-underline hover:text-ed-navy hover:underline"
                          >
                            {m.name}
                          </Link>
                          <p className="mt-0.5 font-sans-ed text-xs text-ed-ink-3">
                            {m.agency}
                            {m.url && (
                              <>
                                {' · '}
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-mono-ed text-[11px] text-ed-ink-3 hover:text-ed-navy"
                                >
                                  <span>
                                    {m.url.replace(/^https?:\/\//, '')}
                                  </span>
                                  <ExternalLinkIcon size={11} />
                                </a>
                              </>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <GradeBadge grade={m.grade} score={m.score} />
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {formatPct(m.availabilityPct)}
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {formatMs(m.avgMs)}
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {m.incidentCount}
                        </td>
                        <td className="px-4 py-3 font-mono-ed text-xs">
                          {formatMttr(m.mttrSec)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )
      )}
    </Container>
  );
};

export default ScorecardsPage;
