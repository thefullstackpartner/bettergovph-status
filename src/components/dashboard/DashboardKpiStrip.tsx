import { FC } from 'react';
import { AlertTriangleIcon, ArrowDownRightIcon, ClockIcon, ShieldAlertIcon } from 'lucide-react';
import type { DashboardKpis } from '../../types';
import { Eyebrow, InfoHint } from '../ui';

type Props = {
  kpis: DashboardKpis;
  days: number;
  onSelectCategory?: (slug: string) => void;
};

const DashboardKpiStrip: FC<Props> = ({ kpis, days, onSelectCategory }) => {
  return (
    <section
      aria-label="Key performance indicators"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div className="border border-ed-rule bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Eyebrow>Network Availability</Eyebrow>
            <InfoHint
              label="Network Availability"
              text="Percentage of checks where portals were reachable (up, slow/degraded, or WAF-blocked). Clean uptime counts strictly healthy 'up' checks only."
            />
          </span>
          <ShieldAlertIcon className="h-4 w-4 text-ed-navy" aria-hidden="true" />
        </div>
        <div className="mt-2 font-mono-ed text-3xl font-bold tracking-tight text-ed-ink">
          {kpis.availabilityPct.toFixed(2)}%
        </div>
        <p className="mt-1 font-sans-ed text-xs text-ed-ink-4">
          Clean uptime: <span className="font-mono-ed font-semibold text-ed-ink-2">{kpis.cleanUptimePct.toFixed(2)}%</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-ed-rule pt-2.5 font-mono-ed text-[11px] text-ed-ink-4">
          <span>WAF: {kpis.wafPct.toFixed(2)}%</span>
          <span>Degraded: {kpis.degradedPct.toFixed(2)}%</span>
          <span className="text-ed-red">Down: {kpis.downPct.toFixed(2)}%</span>
        </div>
      </div>

      <div className="border border-ed-rule bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Eyebrow>Weighted Avg Latency</Eyebrow>
            <InfoHint
              label="Weighted Avg Latency"
              text="Average server response time in milliseconds across all checks in the window. Lower is faster."
            />
          </span>
          <ClockIcon className="h-4 w-4 text-ed-navy" aria-hidden="true" />
        </div>
        <div className="mt-2 font-mono-ed text-3xl font-bold tracking-tight text-ed-ink">
          {kpis.avgMs} <span className="text-base font-normal text-ed-ink-4">ms</span>
        </div>
        <p className="mt-1 font-sans-ed text-xs text-ed-ink-4">
          Across {kpis.totalMonitors} portals ({days}d window)
        </p>
        <div className="mt-3 border-t border-ed-rule pt-2.5 font-mono-ed text-[11px] text-ed-ink-4">
          Peak recorded: <span className="font-semibold text-ed-ink-2">{kpis.maxMs.toLocaleString()} ms</span>
        </div>
      </div>

      <div className="border border-ed-rule bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Eyebrow>Incidents &amp; MTTR</Eyebrow>
            <InfoHint
              label="Incidents and MTTR"
              text="An incident opens after 2 consecutive failed checks. MTTR (Mean Time to Resolution) is the average minutes until recovery."
            />
          </span>
          <AlertTriangleIcon className="h-4 w-4 text-warning-600" aria-hidden="true" />
        </div>
        <div className="mt-2 font-mono-ed text-3xl font-bold tracking-tight text-ed-ink">
          {kpis.totalIncidents.toLocaleString()}
        </div>
        <p className="mt-1 font-sans-ed text-xs text-ed-ink-4">
          {kpis.openIncidents} currently ongoing
        </p>
        <div className="mt-3 border-t border-ed-rule pt-2.5 font-mono-ed text-[11px] text-ed-ink-4">
          Mean time to resolve:{' '}
          <span className="font-semibold text-ed-ink-2">
            {kpis.mttrMinutes !== null ? `${kpis.mttrMinutes} min` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="border border-ed-red/40 bg-ed-paper-2 p-5">
        <div className="flex items-center justify-between">
          <Eyebrow>Worst Category</Eyebrow>
          <ArrowDownRightIcon className="h-4 w-4 text-ed-red" aria-hidden="true" />
        </div>
        {kpis.worstCategory ? (
          <>
            <div className="mt-2 font-serif-ed text-lg font-bold leading-snug text-ed-ink">
              {kpis.worstCategory.name}
            </div>
            <p className="mt-1 font-mono-ed text-xs text-ed-red">
              {kpis.worstCategory.availabilityPct.toFixed(2)}% availability ({kpis.worstCategory.downPct.toFixed(2)}% down)
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-ed-rule pt-2.5 font-sans-ed text-xs">
              <span className="text-ed-ink-4">
                {kpis.worstCategory.monitorCount} portals
              </span>
              {onSelectCategory && (
                <button
                  type="button"
                  onClick={() => onSelectCategory(kpis.worstCategory!.slug)}
                  className="cursor-pointer font-semibold text-ed-navy hover:underline"
                >
                  Inspect portals &rarr;
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 font-sans-ed text-sm text-ed-ink-4">No category data</p>
        )}
      </div>
    </section>
  );
};

export default DashboardKpiStrip;
