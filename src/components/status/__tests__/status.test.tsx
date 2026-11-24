import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverallBanner, UptimeBars } from '../index';
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
  it('renders OverallBanner with down count', () => {
    render(<OverallBanner summary={baseSummary} />);
    expect(screen.getByText('1 service currently down')).toBeInTheDocument();
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
});
