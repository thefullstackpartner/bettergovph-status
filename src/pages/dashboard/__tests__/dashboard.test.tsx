import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getMockDashboardData } from '../../../data/mockDashboard';
import curatedMonitors from '../../../data/monitors/curated.json';
import * as api from '../../../lib/api';
import DashboardPage from '../index';

vi.mock('../../../lib/api', async importOriginal => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getDashboard: vi.fn((range, tier) =>
      Promise.resolve(getMockDashboardData(range, tier))
    ),
  };
});

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe('DashboardPage', () => {
  it('renders KPI strip, category leaderboard, and monitor spotlights', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /performance & reliability dashboard/i })
    ).toBeInTheDocument();
    expect(await screen.findByText(/network availability/i)).toBeInTheDocument();
    expect(screen.getByText(/worst category/i)).toBeInTheDocument();
    expect(screen.getByText(/category performance/i)).toBeInTheDocument();
    expect(screen.getByText(/monitor spotlights/i)).toBeInTheDocument();
    expect(screen.getByText(/top incident causes/i)).toBeInTheDocument();
  });

  it('switches reporting windows up to 1 year and filters by tier', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText(/network availability/i);

    fireEvent.click(screen.getByRole('button', { name: '1 Year' }));
    await waitFor(() => {
      expect(screen.getByText(/365-day window/i)).toBeInTheDocument();
    });

    const criticalCount = curatedMonitors.filter(m => m.enabled).length;
    const tierSelect = screen.getByLabelText(/filter by monitor tier/i);
    fireEvent.change(tierSelect, { target: { value: 'critical' } });
    await waitFor(() => {
      expect(
        screen.getAllByText(new RegExp(`${criticalCount} portals`, 'i')).length
      ).toBeGreaterThan(0);
    });
  });

  it('switches monitor spotlight tabs and filters the full leaderboard', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText(/monitor spotlights/i);

    fireEvent.click(screen.getByRole('button', { name: 'Best Performing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Slowest Latency' }));

    const searchInput = screen.getByLabelText(/search monitors in leaderboard/i);
    fireEvent.change(searchInput, { target: { value: 'PAGASA' } });
    expect(screen.getAllByText(/PAGASA/i).length).toBeGreaterThan(0);
  });

  it('filters the monitor leaderboard when clicking a category row', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText(/category performance/i);

    const categorySection = screen.getByRole('region', {
      name: /category performance comparison/i,
    });
    const firstRow = categorySection.querySelector('tbody tr');
    expect(firstRow).not.toBeNull();
    fireEvent.click(firstRow!);

    const categorySelect = screen.getByLabelText(
      /filter leaderboard by category/i
    ) as HTMLSelectElement;
    expect(categorySelect.value).not.toBe('all');
    expect(
      screen.getByRole('button', { name: /clear category filter/i })
    ).toBeInTheDocument();
  });

  it('initializes and clears the category filter from URL search params', async () => {
    render(
      <MemoryRouter initialEntries={['/?category=tax-revenue']}>
        <DashboardPage />
      </MemoryRouter>
    );

    await screen.findByText(/category performance/i);

    const categorySelect = screen.getByLabelText(
      /filter leaderboard by category/i
    ) as HTMLSelectElement;
    expect(categorySelect.value).toBe('tax-revenue');

    const clearBtn = screen.getByRole('button', {
      name: /clear category filter/i,
    });
    fireEvent.click(clearBtn);
    expect(categorySelect.value).toBe('all');
  });
});
