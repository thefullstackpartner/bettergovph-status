import { enabledMonitors } from '../lib/monitors';
import { type AppContext, getSiteUrl } from './site';

const STATIC_PAGES: Array<{
  path: string;
  changefreq: string;
  priority: string;
}> = [
  { path: '/', changefreq: 'hourly', priority: '1.0' },
  { path: '/status', changefreq: 'always', priority: '0.9' },
  { path: '/incidents', changefreq: 'hourly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/status.md', changefreq: 'always', priority: '0.6' },
  { path: '/llms.txt', changefreq: 'weekly', priority: '0.4' },
  { path: '/llms-full.txt', changefreq: 'weekly', priority: '0.3' },
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSitemapXml(site: string): string {
  const urls = [
    ...STATIC_PAGES,
    ...enabledMonitors.map((m) => ({
      path: `/monitors/${m.slug}`,
      changefreq: 'hourly',
      priority: m.tier === 'critical' ? '0.7' : '0.5',
    })),
  ];

  const entries = urls
    .map(
      (u) =>
        `  <url><loc>${xmlEscape(site + u.path)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function onSitemapRequest(c: AppContext) {
  return c.body(buildSitemapXml(getSiteUrl(c)), 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  });
}
