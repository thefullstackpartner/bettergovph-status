import { FC, useState } from 'react';
import {
  CategoryLeaderboard,
  DashboardKpiStrip,
  DashboardTrendCharts,
  IncidentCausesPanel,
  MonitorLeaderboard,
} from '../../components/dashboard';
import { Button, Container, Eyebrow, Notice } from '../../components/ui';
import { useDashboard } from '../../hooks/useDashboard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatManilaTimestamp } from '../../lib/format';
import type { DashboardRange, DashboardTierFilter } from '../../types';

const RANGES: Array<{ value: DashboardRange; label: string }> = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' },
];

const TIERS: Array<{ value: DashboardTierFilter; label: string }> = [
  { value: 'all', label: 'All Tiers' },
  { value: 'critical', label: 'Critical Only' },
  { value: 'standard', label: 'Standard Only' },
];

const DashboardPage: FC = () => {
  useDocumentTitle('Analytics Dashboard | BetterGovPH Status');
  const [range, setRange] = useState<DashboardRange>('30d');
  const [tier, setTier] = useState<DashboardTierFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data, loading, error } = useDashboard(range, tier);

  return (
    <Container className="py-8">
      <header className="mb-6 border border-[#002b82] bg-[#0038a8] p-6 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow tone="onDark">Data Aggregation &amp; Insights</Eyebrow>
            <h1 className="mt-1 font-serif-ed text-2xl font-bold tracking-tight text-white max-md:text-xl">
              Performance &amp; Reliability Dashboard
            </h1>
            <p className="mt-1 font-sans-ed text-sm text-white/85">
              Category comparisons, best &amp; worst performing portals, and
              latency trends (capped at a 1-year reporting window).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Reporting time range"
              className="flex gap-1 bg-white/10 p-1"
            >
              {RANGES.map(r => (
                <Button
                  key={r.value}
                  size="sm"
                  variant={range === r.value ? 'solid' : 'ghost'}
                  className={
                    range === r.value
                      ? 'bg-white text-[#0038a8] hover:bg-white/90'
                      : 'border-transparent text-white hover:bg-white/15'
                  }
                  onClick={() => setRange(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>

            <select
              aria-label="Filter by monitor tier"
              value={tier}
              onChange={e => setTier(e.target.value as DashboardTierFilter)}
              className="border border-white/30 bg-[#002b82] px-3 py-1.5 font-sans-ed text-xs font-semibold text-white focus:border-white focus:outline-none"
            >
              {TIERS.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {data?.isMock && (
        <Notice tone="info" className="mb-6">
          Preview mode: displaying deterministic mock aggregation across all{' '}
          {data.kpis.totalMonitors} portals ({data.days}-day window). Updated{' '}
          {formatManilaTimestamp(data.generatedAt)}.
        </Notice>
      )}

      {loading && !data && (
        <div className="border border-ed-rule bg-ed-paper-2 p-8 font-sans-ed text-sm text-ed-ink-3">
          Aggregating dashboard metrics...
        </div>
      )}

      {error && (
        <Notice tone="error" className="mb-6">
          Could not load dashboard metrics: {error}
        </Notice>
      )}

      {data && (
        <>
          <DashboardKpiStrip
            kpis={data.kpis}
            days={data.days}
            onSelectCategory={slug => setSelectedCategory(slug)}
          />

          <DashboardTrendCharts dailyTrend={data.dailyTrend} days={data.days} />

          <CategoryLeaderboard
            categories={data.categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          <MonitorLeaderboard
            monitors={data.monitors}
            worstPerformers={data.worstPerformers}
            bestPerformers={data.bestPerformers}
            slowestMonitors={data.slowestMonitors}
            mostIncidents={data.mostIncidents}
            categories={data.categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          <IncidentCausesPanel
            causes={data.incidentCauses}
            totalIncidents={data.kpis.totalIncidents}
          />
        </>
      )}
    </Container>
  );
};

export default DashboardPage;
