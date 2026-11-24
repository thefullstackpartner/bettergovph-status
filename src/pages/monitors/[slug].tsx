import { FC, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react';
import {
  Button,
  Card,
  Container,
  Eyebrow,
  Notice,
  SectionHeader,
} from '../../components/ui';
import {
  IncidentCard,
  ResponseTimeChart,
  StatusPill,
  UptimeBars,
} from '../../components/status';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useMonitorHistory } from '../../hooks/useMonitorHistory';
import { getMonitorDetail } from '../../lib/api';
import {
  formatManilaTimestamp,
  formatMs,
  formatUptime,
} from '../../lib/format';
import { cn } from '../../lib/utils';
import type { MonitorDetailResponse } from '../../types';

const RANGES: Array<'24h' | '7d' | '30d' | '90d'> = ['24h', '7d', '30d', '90d'];

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
          <div className="border border-ed-rule bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Eyebrow tone="navy">{m.agency}</Eyebrow>
                <h1 className="mt-1 font-serif-ed text-3xl font-bold text-ed-ink max-md:text-2xl">
                  {m.name}
                </h1>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 font-mono-ed text-xs text-ed-navy hover:underline"
                >
                  <span>{m.url}</span>
                  <ExternalLinkIcon size={12} />
                </a>
              </div>
              <StatusPill status={m.status} error={m.lastError} />
            </div>

            {m.lastError === 'waf_403' && (
              <Notice tone="info" className="mt-4">
                This portal’s firewall (WAF) blocked automated monitoring
                probes (`403`). It may still be accessible normally in your
                browser.
              </Notice>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ed-rule pt-5 md:grid-cols-4">
              <div>
                <div className="font-mono-ed text-[11px] uppercase text-ed-ink-4">
                  Last Response
                </div>
                <div className="mt-1 font-serif-ed text-xl font-bold text-ed-ink">
                  {formatMs(m.lastResponseMs)}
                </div>
              </div>
              <div>
                <div className="font-mono-ed text-[11px] uppercase text-ed-ink-4">
                  24h Uptime
                </div>
                <div className="mt-1 font-serif-ed text-xl font-bold text-ed-ink">
                  {formatUptime(m.uptime24h)}
                </div>
              </div>
              <div>
                <div className="font-mono-ed text-[11px] uppercase text-ed-ink-4">
                  24h Avg Latency
                </div>
                <div className="mt-1 font-serif-ed text-xl font-bold text-ed-ink">
                  {formatMs(m.avgMs24h)}
                </div>
              </div>
              <div>
                <div className="font-mono-ed text-[11px] uppercase text-ed-ink-4">
                  Last Check (Colo)
                </div>
                <div className="mt-1 font-mono-ed text-xs text-ed-ink-2">
                  {formatManilaTimestamp(m.lastCheckedAt)}
                  {m.lastColo ? ` (${m.lastColo})` : ''}
                </div>
              </div>
            </div>
          </div>

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
