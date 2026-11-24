import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('homepage has no critical accessibility violations', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.route('**/api/summary', route =>
    route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        counts: {
          total: 1,
          up: 1,
          degraded: 0,
          down: 0,
          unknown: 0,
          openIncidents: 0,
        },
        categories: [
          {
            slug: 'tax-revenue',
            name: 'Tax & Revenue',
            description: 'Tax portals',
          },
        ],
        monitors: [
          {
            slug: 'bir-main',
            name: 'BIR Main Portal',
            agency: 'Bureau of Internal Revenue',
            department: 'Department of Finance',
            category: 'tax-revenue',
            url: 'https://www.bir.gov.ph/',
            tier: 'critical',
            source: 'curated',
            status: 'up',
            lastCheckedAt: new Date().toISOString(),
            lastHttpStatus: 200,
            lastResponseMs: 180,
            lastError: null,
            lastColo: 'SIN',
            uptime24h: 100,
            avgMs24h: 180,
            bars90d: [],
          },
        ],
      },
    })
  );

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('All monitored portals operational')).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
