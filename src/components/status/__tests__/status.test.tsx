import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverallBanner, StatusPill, UptimeBars } from '../index';
import type { SummaryResponse } from '../../../types';

const baseSummary: SummaryResponse = {
  generatedAt: new Date().toISOString(),
  counts: {
    total: 10,
    up: 9,
    degraded: 0,
    down: 1,
    unknown: 0,
    openIncidents: 1,
  },
  categories: [],
  monitors: [],
};

describe('status UI components', () => {
  it('renders OverallBanner with down count and clickable status filters', () => {
    const onFilterStatus = vi.fn();
    render(
      <OverallBanner
        summary={baseSummary}
        activeStatus="all"
        onFilterStatus={onFilterStatus}
      />
    );
    expect(screen.getByText('1 service currently down')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1 down' }));
    expect(onFilterStatus).toHaveBeenCalledWith('down');

    fireEvent.click(screen.getByRole('button', { name: '9 up' }));
    expect(onFilterStatus).toHaveBeenCalledWith('up');
  });

  it('renders accessible daily UptimeBars with aria-labels', () => {
    render(
      <UptimeBars
        granularity="daily"
        days={5}
        bars={[
          {
            day: new Date().toISOString().slice(0, 10),
            total: 10,
            up: 10,
            degraded: 0,
            down: 0,
            avgMs: 120,
          },
        ]}
      />
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[4].getAttribute('aria-label')).toContain('100% up');
  });

  it('renders accessible hourly UptimeBars with aria-labels', () => {
    const now = new Date();
    const currentHourIso =
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours()
        )
      )
        .toISOString()
        .slice(0, 13) + ':00:00Z';

    render(
      <UptimeBars
        granularity="hourly"
        hours={6}
        hourlyBars={[
          {
            hour: currentHourIso,
            total: 4,
            up: 4,
            degraded: 0,
            down: 0,
            avgMs: 215,
          },
        ]}
      />
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items[5].getAttribute('aria-label')).toContain('100% up');
  });

  it('renders WAF and maintenance context in StatusPill', () => {
    const { rerender } = render(
      <StatusPill status="degraded" error="waf_403" />
    );
    const wafLabel = screen.getByText('Probe Blocked (WAF)');
    expect(wafLabel).toBeInTheDocument();
    expect(wafLabel.parentElement?.getAttribute('title')).toContain(
      'accessible in your browser'
    );

    rerender(<StatusPill status="down" error="maintenance" />);
    expect(screen.getByText('Under Maintenance')).toBeInTheDocument();

    rerender(<StatusPill status="degraded" />);
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });
});
