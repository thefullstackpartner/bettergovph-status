import { FC, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ExternalLinkIcon, RssIcon } from 'lucide-react';
import {
  Button,
  Card,
  Container,
  Eyebrow,
  InfoHint,
  Notice,
  SectionHeader,
} from '../../components/ui';
import {
  FreshnessPill,
  IncidentCard,
  MaintenanceBanner,
  ResponseTimeChart,
  StatusPill,
  UptimeBars,
} from '../../components/status';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useMonitorHistory } from '../../hooks/useMonitorHistory';
import { getMonitorDetail } from '../../lib/api';
import {
  formatFreshnessSignal,
  formatIncidentCause,
  formatManilaTimestamp,
  formatMs,
  formatRelativeTime,
  formatUptime,
} from '../../lib/format';
import { cn } from '../../lib/utils';
import categoriesData from '../../data/categories.json';
import type { Category, MonitorDetailResponse } from '../../types';

const RANGES: Array<'24h' | '7d' | '30d' | '90d'> = ['24h', '7d', '30d', '90d'];
const CATEGORIES_BY_SLUG = new Map(
  (categoriesData as Category[]).map(c => [c.slug, c])
);

const MonitorDetailPage: FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<MonitorDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'24h' | '7d' | '30d' | '90d'>('24h');
  const [barGranularity, setBarGranularity] = useState<'hourly' | 'daily'>(
    'hourly'
  );

  const history = useMonitorHistory(slug, range);

  useDocumentTitle(
    detail?.monitor
      ? `${detail.monitor.name} | BetterGovPH Status`
      : 'Monitor Detail | BetterGovPH Status'
  );

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    getMonitorDetail(slug)
      .then(res => {
        if (!cancelled) {
          setDetail(res);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load monitor'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const m = detail?.monitor;
  const categoryInfo = m ? CATEGORIES_BY_SLUG.get(m.category) : undefined;
  const categoryLabel = categoryInfo?.name ?? m?.category;
  const hourlyTotals = (m?.hourly24h ?? []).reduce(
    (acc, h) => ({ total: acc.total + h.total, waf: acc.waf + (h.waf ?? 0) }),
    { total: 0, waf: 0 }
  );
  const isWafUnverified24h =
    (hourlyTotals.total > 0 && hourlyTotals.waf / hourlyTotals.total >= 0.95) ||
    (m?.status === 'degraded' &&
      m.lastError === 'waf_403' &&
      hourlyTotals.total === 0);

  return (
    <Container narrow className="py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 font-sans-ed text-sm font-medium text-ed-navy no-underline hover:underline"
      >
        <ArrowLeftIcon size={14} />
        <span>Back to all portals</span>
      </Link>

      {loading && (
        <div className="border border-ed-rule bg-ed-paper-2 p-8 text-sm text-ed-ink-3">
          Loading monitor details...
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {m && (
        <>
          <div className="border border-[#002b82] bg-[#0038a8] p-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Eyebrow tone="onDark">{m.agency}</Eyebrow>
                  {m.category && (
                    <Link
                      to={`/?category=${encodeURIComponent(m.category)}`}
                      title={categoryInfo?.description}
                      className="border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono-ed text-[10px] font-semibold uppercase tracking-[0.06em] text-white no-underline transition-colors hover:bg-white/20"
                    >
                      {categoryLabel}
                    </Link>
                  )}
                  {m.tier === 'critical' && (
                    <span
                      title="Curated critical citizen portal — checked every 5 minutes"
                      className="border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono-ed text-[10px] font-semibold uppercase tracking-[0.06em] text-white"
                    >
                      Critical
                    </span>
                  )}
                </div>
                <h1 className="mt-1 font-serif-ed text-3xl font-bold text-white max-md:text-2xl">
                  {m.name}
                </h1>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 font-mono-ed text-xs text-white/80 hover:text-white hover:underline"
                >
                  <span>{m.url}</span>
                  <ExternalLinkIcon size={12} />
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/monitors/${m.slug}/feed.xml`}
                  target="_blank"
                  rel="noreferrer"
                  title="Subscribe to RSS incident feed for this monitor"
                  className="inline-flex items-center gap-1.5 border border-white/30 bg-white/10 px-2.5 py-1 font-mono-ed text-[11px] font-semibold uppercase tracking-[0.06em] text-white no-underline transition-colors hover:bg-white/20"
                >
                  <RssIcon size={12} />
                  <span>RSS</span>
                </a>
                <StatusPill
                  status={m.status}
                  error={m.lastError}
                  maintenance={m.maintenance}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 md:grid-cols-4">
              <div>
                <div className="font-mono-ed text-[11px] uppercase text-white/60">
                  Last Response
                </div>
                <div className="mt-1 font-serif-ed text-xl font-bold text-white">
                  {formatMs(m.lastResponseMs)}
                </div>
              </div>
              <div>
                <div className="font-mono-ed text-[11px] uppercase text-white/60">
                  24h Uptime
                </div>
                <div className="mt-1 font-serif-ed text-xl font-bold text-white">
                  {isWafUnverified24h
                    ? 'Unverified (WAF)'
                    : formatUptime(m.uptime24h)}
                </div>
              </div>
              <div>
                <div className="font-mono-ed text-[11px] uppercase text-white/60">
                  24h Avg Latency
                </div>
                <div className="mt-1 font-serif-ed text-xl font-bold text-white">
                  {formatMs(m.avgMs24h)}
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1 font-mono-ed text-[11px] uppercase text-white/60">
                  <span>Last Check (Probe Location)</span>
                  <InfoHint
                    label="Probe location"
                    align="right"
                    tone="onDark"
                    text="Checks run from Cloudflare's global edge network (e.g., LAX = Los Angeles, SJC = San Jose, SEA = Seattle, MNL = Manila). Latency and firewall blocks can vary by probe location."
                  />
                </div>
                <div className="mt-1 font-mono-ed text-xs text-white/85">
                  {formatManilaTimestamp(m.lastCheckedAt)}
                  {m.lastColo ? ` · Edge: ${m.lastColo}` : ''}
                </div>
                <div className="mt-1 font-mono-ed text-[11px] text-white/65">
                  {m.tier === 'critical'
                    ? 'Critical · 5-min checks'
                    : 'Standard · 15-min checks'}
                </div>
              </div>
            </div>
          </div>

          {m.maintenance && (
            <MaintenanceBanner
              maintenances={{
                active:
                  m.maintenance.status === 'active'
                    ? [
                        {
                          id: m.maintenance.id,
                          slugs: [m.slug],
                          title: m.maintenance.title,
                          description: m.maintenance.description ?? undefined,
                          startAt: m.maintenance.startAt,
                          endAt: m.maintenance.endAt,
                          impact: m.maintenance.impact,
                          sourceUrl: m.maintenance.sourceUrl ?? undefined,
                        },
                      ]
                    : [],
                upcoming:
                  m.maintenance.status === 'upcoming'
                    ? [
                        {
                          id: m.maintenance.id,
                          slugs: [m.slug],
                          title: m.maintenance.title,
                          description: m.maintenance.description ?? undefined,
                          startAt: m.maintenance.startAt,
                          endAt: m.maintenance.endAt,
                          impact: m.maintenance.impact,
                          sourceUrl: m.maintenance.sourceUrl ?? undefined,
                        },
                      ]
                    : [],
              }}
            />
          )}

          {m.lastError === 'waf_403' && (
            <Notice tone="info" className="mt-4">
              This portal’s firewall (WAF) blocked automated monitoring probes
              (`403`). It may still be accessible normally in your browser.
            </Notice>
          )}
          {m.lastError && m.lastError !== 'waf_403' && (
            <Notice tone="error" className="mt-4">
              <strong>{formatIncidentCause(m.lastError).label}</strong>
              {m.lastError === 'unexpected_status' && m.lastHttpStatus
                ? ` (HTTP ${m.lastHttpStatus})`
                : ''}
              : {formatIncidentCause(m.lastError).description}
            </Notice>
          )}

          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionHeader
                label={
                  barGranularity === 'hourly'
                    ? '24-Hour Uptime'
                    : '90-Day Uptime'
                }
                className="mb-0"
              />
              <div
                className="flex gap-1.5"
                role="group"
                aria-label="Uptime bar granularity"
              >
                <Button
                  size="sm"
                  variant={barGranularity === 'hourly' ? 'solid' : 'ghost'}
                  onClick={() => setBarGranularity('hourly')}
                >
                  24h Hourly
                </Button>
                <Button
                  size="sm"
                  variant={barGranularity === 'daily' ? 'solid' : 'ghost'}
                  onClick={() => setBarGranularity('daily')}
                >
                  90d Daily
                </Button>
              </div>
            </div>
            <Card>
              <UptimeBars
                granularity={barGranularity}
                bars={m.bars90d}
                hourlyBars={m.hourly24h ?? []}
                days={90}
                hours={24}
              />
              <div className="mt-2 flex justify-between font-mono-ed text-[11px] text-ed-ink-4">
                <span>
                  {barGranularity === 'hourly' ? '24 hours ago' : '90 days ago'}
                </span>
                <span>
                  {barGranularity === 'hourly' ? 'Now' : 'Today (Asia/Manila)'}
                </span>
              </div>
            </Card>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionHeader label="Response Time" className="mb-0" />
              <div className="flex gap-1.5" role="group" aria-label="Time range">
                {RANGES.map(r => (
                  <Button
                    key={r}
                    size="sm"
                    variant={range === r ? 'solid' : 'ghost'}
                    onClick={() => setRange(r)}
                    className={cn('uppercase')}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>

            {history.loading ? (
              <div className="flex h-64 items-center justify-center border border-ed-rule bg-ed-paper-2 text-sm text-ed-ink-3">
                Loading chart...
              </div>
            ) : (
              <ResponseTimeChart
                range={range}
                points={history.data?.points ?? []}
                daily={history.data?.daily ?? []}
              />
            )}
          </section>

          {m.freshness?.enabled && (
            <section className="mt-8" aria-label="Content freshness">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <SectionHeader
                  label="Content Freshness & Update Cadence"
                  meta={`Stale threshold: ${detail.freshnessStaleDays ?? 30} days`}
                  className="mb-0"
                />
                <FreshnessPill
                  status={m.freshness.status}
                  referenceDate={
                    m.freshness.contentUpdatedAt ?? m.freshness.lastChangedAt
                  }
                  probeError={m.freshness.probeError}
                />
              </div>

              <Card>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <div className="font-mono-ed text-[11px] uppercase text-ed-ink-4">
                      Last Content Update
                    </div>
                    <div className="mt-1 font-serif-ed text-lg font-bold text-ed-ink">
                      {m.freshness.contentUpdatedAt || m.freshness.lastChangedAt
                        ? formatRelativeTime(
                            m.freshness.contentUpdatedAt ??
                              m.freshness.lastChangedAt
                          )
                        : 'Pending'}
                    </div>
                    <div className="mt-0.5 font-mono-ed text-[11px] text-ed-ink-3">
                      {formatManilaTimestamp(
                        m.freshness.contentUpdatedAt ??
                          m.freshness.lastChangedAt
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="font-mono-ed text-[11px] uppercase text-ed-ink-4">
                      Detection Method
                    </div>
                    <div className="mt-1 font-sans-ed text-sm font-semibold text-ed-ink">
                      {formatFreshnessSignal(m.freshness.signalSource)}
                    </div>
                    <div className="mt-0.5 font-mono-ed text-[11px] text-ed-ink-3">
                      Checked {formatRelativeTime(m.freshness.lastCheckedAt)}
                    </div>
                  </div>

                  <div>
                    <div className="font-mono-ed text-[11px] uppercase text-ed-ink-4">
                      Updates (30d)
                    </div>
                    <div className="mt-1 font-serif-ed text-lg font-bold text-ed-ink">
                      {m.freshness.changeCount30d}
                    </div>
                    <div className="mt-0.5 font-mono-ed text-[11px] text-ed-ink-3">
                      Detected changes
                    </div>
                  </div>

                  <div>
                    <div className="font-mono-ed text-[11px] uppercase text-ed-ink-4">
                      Updates (90d)
                    </div>
                    <div className="mt-1 font-serif-ed text-lg font-bold text-ed-ink">
                      {m.freshness.changeCount90d}
                    </div>
                    <div className="mt-0.5 font-mono-ed text-[11px] text-ed-ink-3">
                      Detected changes
                    </div>
                  </div>
                </div>

                {m.freshness.probeError && (
                  <Notice tone="info" className="mt-4">
                    Last freshness probe returned{' '}
                    <code>{m.freshness.probeError}</code>. Previously recorded
                    freshness history is preserved.
                  </Notice>
                )}

                {detail.freshnessEvents && detail.freshnessEvents.length > 0 && (
                  <div className="mt-5 border-t border-ed-rule pt-4">
                    <div className="mb-2 font-mono-ed text-[11px] uppercase tracking-[0.06em] text-ed-ink-4">
                      Recent Detected Content Updates
                    </div>
                    <ul className="divide-y divide-ed-rule text-xs">
                      {detail.freshnessEvents.slice(0, 8).map(ev => (
                        <li
                          key={ev.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <span className="font-sans-ed font-medium text-ed-ink">
                            {formatFreshnessSignal(ev.signal_source)}
                          </span>
                          <span className="font-mono-ed text-ed-ink-3">
                            {formatManilaTimestamp(
                              ev.content_updated_at ?? ev.detected_at
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </section>
          )}

          <section className="mt-8">
            <SectionHeader
              label="Recent Incidents"
              meta={`${detail.incidents.length} recorded`}
            />
            {detail.incidents.length === 0 ? (
              <div className="border border-ed-rule bg-ed-paper-2 p-6 font-sans-ed text-sm text-ed-ink-3">
                No incidents recorded for this portal.
              </div>
            ) : (
              <div className="space-y-3">
                {detail.incidents.map(inc => (
                  <IncidentCard key={inc.id} incident={inc} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Container>
  );
};

export default MonitorDetailPage;
