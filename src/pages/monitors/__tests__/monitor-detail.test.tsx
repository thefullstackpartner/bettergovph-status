import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../../../lib/api';
import type { MonitorDetailResponse, MonitorHistoryResponse } from '../../../types';
import MonitorDetailPage from '../[slug]';

const mockDetail: MonitorDetailResponse = {
  monitor: {
    slug: 'bir-efps',
    name: 'BIR eFPS',
    agency: 'Bureau of Internal Revenue',
    department: 'Department of Finance',
    category: 'tax-revenue',
    url: 'https://efps.bir.gov.ph',
    tier: 'critical',
    source: 'curated',
    status: 'up',
    lastCheckedAt: '2026-11-25T15:00:00Z',
    lastHttpStatus: 200,
    lastResponseMs: 320,
    lastError: null,
    lastColo: 'MNL',
    uptime24h: 100,
    avgMs24h: 310,
    bars90d: [],
    hourly24h: [],
  },
  incidents: [],
  freshnessEvents: [],
};

const mockHistory: MonitorHistoryResponse = {
  slug: 'bir-efps',
  range: '24h',
  points: [],
  daily: [],
};

vi.mock('../../../lib/api', async importOriginal => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getMonitorDetail: vi.fn(() => Promise.resolve(mockDetail)),
    getMonitorHistory: vi.fn(() => Promise.resolve(mockHistory)),
  };
});

describe('MonitorDetailPage', () => {
  it('displays the monitor category name as a link to the filtered home view', async () => {
    render(
      <MemoryRouter initialEntries={['/monitors/bir-efps']}>
        <Routes>
          <Route path="/monitors/:slug" element={<MonitorDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    const categoryLink = await screen.findByRole('link', {
      name: 'Tax & Revenue',
    });
    expect(categoryLink).toHaveAttribute('href', '/?category=tax-revenue');
  });
});
