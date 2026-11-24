import { expect, test } from '@playwright/test';

const mockSummary = {
  generatedAt: new Date().toISOString(),
  counts: {
    total: 2,
    up: 1,
    degraded: 0,
    down: 1,
    unknown: 0,
    openIncidents: 1,
  },
  categories: [
    { slug: 'tax-revenue', name: 'Tax & Revenue', description: 'Tax portals' },
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
      lastResponseMs: 210,
      lastError: null,
      lastColo: 'SIN',
      uptime24h: 100,
      avgMs24h: 210,
      bars90d: [],
    },
    {
      slug: 'bir-orus',
      name: 'BIR ORUS',
      agency: 'Bureau of Internal Revenue',
      department: 'Department of Finance',
      category: 'tax-revenue',
      url: 'https://orus.bir.gov.ph/',
      tier: 'critical',
      source: 'curated',
      status: 'down',
      lastCheckedAt: new Date().toISOString(),
      lastHttpStatus: 503,
      lastResponseMs: 1200,
      lastError: 'unexpected_status',
      lastColo: 'SIN',
      uptime24h: 50,
      avgMs24h: 900,
      bars90d: [],
    },
  ],
};

test('homepage renders summary and filters monitors', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.route('**/api/summary', route =>
    route.fulfill({ json: mockSummary })
  );

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('1 service currently down')).toBeVisible();
  await expect(page.getByText('BIR Main Portal')).toBeVisible();
  await expect(page.getByText('BIR ORUS')).toBeVisible();
  await page.screenshot({
    path: 'C:/Users/Centric Group/.gemini/antigravity-cli/brain/fc3020e8-96ac-494e-a08f-9917bc9ea89c/homepage-preview.png',
    fullPage: true,
  });

  await page.getByLabel('Filter by status').selectOption('down');
  await expect(page.getByText('BIR Main Portal')).toBeHidden();
  await expect(page.getByText('BIR ORUS')).toBeVisible();
});
