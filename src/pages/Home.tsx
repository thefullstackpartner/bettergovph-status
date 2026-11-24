import { FC, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import {
  Button,
  Container,
  Notice,
  Pagination,
  SectionHeader,
} from '../components/ui';
import { MonitorRow, OverallBanner } from '../components/status';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSummary } from '../hooks/useSummary';

const PAGE_SIZE = 25;

const Home: FC = () => {
  useDocumentTitle('BetterGovPH Status | Philippine Government Service Uptime');
  const { data, loading, error } = useSummary();
  const [searchParams, setSearchParams] = useSearchParams();
  const [granularity, setGranularity] = useState<'hourly' | 'daily'>('hourly');

  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? 'all';
  const statusFilter = searchParams.get('status') ?? 'all';
  const tierFilter = searchParams.get('tier') ?? 'all';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const criticalCount = useMemo(
    () => (data ? data.monitors.filter(m => m.tier === 'critical').length : 0),
    [data]
  );

  const filteredMonitors = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.monitors.filter(m => {
      if (category !== 'all' && m.category !== category) return false;
      if (tierFilter === 'critical' && m.tier !== 'critical') return false;
      if (statusFilter === 'critical' && m.tier !== 'critical') return false;
      if (
        statusFilter === 'waf' &&
        !(m.status === 'degraded' && m.lastError === 'waf_403')
      ) {
        return false;
      }
      if (
        statusFilter === 'degraded' &&
        !(m.status === 'degraded' && m.lastError !== 'waf_403')
      ) {
        return false;
      }
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'critical' &&
        statusFilter !== 'waf' &&
        statusFilter !== 'degraded' &&
        m.status !== statusFilter
      ) {
        return false;
      }
      if (q) {
        const hay =
          `${m.name} ${m.agency} ${m.department ?? ''} ${m.url}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, query, category, statusFilter, tierFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMonitors.length / PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);
  const pagedMonitors = filteredMonitors.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <Container className="py-8">
      {loading && !data && (
        <div className="border border-ed-rule bg-ed-paper-2 p-8 font-sans-ed text-sm text-ed-ink-3">
          Loading status snapshot...
        </div>
      )}

      {error && (
        <Notice tone="error" className="mb-6">
          Could not load status data: {error}. Make sure the Worker is running
          with <code>npm run functions:dev</code>.
        </Notice>
      )}

      {data && (
        <>
          <OverallBanner
            summary={data}
            activeStatus={statusFilter}
            onFilterStatus={status => updateParam('status', status)}
          />

          <section className="mt-8" aria-label="Filter monitored portals">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionHeader
                label="Monitored Portals"
                meta={`${filteredMonitors.length} of ${data.monitors.length} shown`}
                className="mb-0"
              />
              <div
                className="flex gap-1.5"
                role="group"
                aria-label="Uptime bar granularity"
              >
                <Button
                  size="sm"
                  variant={granularity === 'hourly' ? 'solid' : 'ghost'}
                  onClick={() => setGranularity('hourly')}
                >
                  24h Hourly
                </Button>
                <Button
                  size="sm"
                  variant={granularity === 'daily' ? 'solid' : 'ghost'}
                  onClick={() => setGranularity('daily')}
                >
                  45d Daily
                </Button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-ed-rule bg-ed-paper-2 px-3 py-2.5">
              <p className="font-sans-ed text-xs text-ed-ink-3">
                <strong>Critical</strong> marks {criticalCount} curated,
                high-impact citizen portals checked every 5 minutes; standard
                portals are checked every 15 minutes.{' '}
                <Link to="/about" className="text-ed-navy hover:underline">
                  Learn more
                </Link>
                .
              </p>
              <div
                className="ml-auto flex items-center gap-1.5"
                role="group"
                aria-label="Filter by portal tier"
              >
                <Button
                  size="sm"
                  variant={tierFilter !== 'critical' ? 'solid' : 'ghost'}
                  onClick={() => updateParam('tier', 'all')}
                >
                  All ({data.monitors.length})
                </Button>
                <Button
                  size="sm"
                  variant={tierFilter === 'critical' ? 'solid' : 'ghost'}
                  onClick={() => updateParam('tier', 'critical')}
                >
                  Critical ({criticalCount})
                </Button>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px_180px]">
              <div className="relative">
                <SearchIcon
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ed-ink-3"
                />
                <input
                  type="search"
                  value={query}
                  onChange={e => updateParam('q', e.target.value)}
                  aria-label="Search portals or agencies"
                  placeholder="Search portal, agency, or URL..."
                  className="h-11 w-full border border-ed-rule-strong bg-white pl-9 pr-3 font-sans-ed text-sm text-ed-ink outline-none placeholder:text-ed-ink-4 focus:border-ed-navy"
                />
              </div>

              <div className="relative">
                <select
                  aria-label="Filter by category"
                  value={category}
                  onChange={e => updateParam('category', e.target.value)}
                  className="h-11 w-full appearance-none border border-ed-rule-strong bg-white pl-3 pr-9 font-sans-ed text-sm text-ed-ink outline-none focus:border-ed-navy"
                >
                  <option value="all">All categories</option>
                  {data.categories.map(cat => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ed-ink-3"
                  aria-hidden="true"
                />
              </div>

              <div className="relative">
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={e => updateParam('status', e.target.value)}
                  className="h-11 w-full appearance-none border border-ed-rule-strong bg-white pl-3 pr-9 font-sans-ed text-sm text-ed-ink outline-none focus:border-ed-navy"
                >
                  <option value="all">All statuses</option>
                  <option value="down">Down</option>
                  <option value="degraded">Degraded</option>
                  <option value="waf">Probe Blocked (WAF)</option>
                  <option value="up">Operational</option>
                  <option value="unknown">Pending</option>
                </select>
                <ChevronDownIcon
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ed-ink-3"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div
              className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono-ed text-[11px] text-ed-ink-3"
              aria-label="Uptime bar color legend"
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-2 rounded-[1px] bg-success-500"
                  aria-hidden="true"
                />
                Operational
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-2 rounded-[1px] bg-warning-500"
                  aria-hidden="true"
                />
                Degraded / &lt;50% down
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-2 rounded-[1px] bg-indigo-500"
                  aria-hidden="true"
                />
                Probe Blocked (WAF)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-2 rounded-[1px] bg-ed-red"
                  aria-hidden="true"
                />
                Down (≥50%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-2 rounded-[1px] bg-ed-paper-3"
                  aria-hidden="true"
                />
                No data
              </span>
            </div>

            {pagedMonitors.length === 0 ? (
              <div className="border border-ed-rule bg-ed-paper-2 p-8 text-center font-sans-ed text-sm text-ed-ink-3">
                No portals match your current filters.
              </div>
            ) : (
              <div className="space-y-3">
                {pagedMonitors.map(monitor => (
                  <MonitorRow
                    key={monitor.slug}
                    monitor={monitor}
                    granularity={granularity}
                  />
                ))}
              </div>
            )}

            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={p => updateParam('page', String(p))}
            />
          </section>
        </>
      )}
    </Container>
  );
};

export default Home;
