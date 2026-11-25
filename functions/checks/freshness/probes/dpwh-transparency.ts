import type { CheckContext, FreshnessResult, MonitorDefinition } from '../../../types';
import { BaseFreshnessProbe } from '../base';

/**
 * Freshness probe for DPWH Transparency Portal (transparency.dpwh.gov.ph).
 * Checks WordPress REST API / sitemap first when reachable, then falls back to
 * HTML meta dates and normalized content hashing. Gracefully reports `waf_403`
 * when Cloudflare Bot Management blocks automated requests.
 */
export class DpwhTransparencyFreshnessProbe extends BaseFreshnessProbe {
  readonly name = 'dpwh-transparency';

  protected async executeProbe(
    monitor: MonitorDefinition,
    ctx: CheckContext,
    checkedAt: string
  ): Promise<FreshnessResult> {
    const baseUrl = new URL(monitor.url).origin;
    const timeoutMs = monitor.timeoutMs ?? 15_000;

    // 1. Try WordPress posts API (lightweight JSON with exact modified GMT timestamps).
    const wpUrl = `${baseUrl}/wp-json/wp/v2/posts?per_page=1&_fields=modified_gmt,date_gmt`;
    const wpDoc = await this.fetchDocument(
      wpUrl,
      ctx,
      timeoutMs,
      'application/json'
    );
    if (wpDoc.status === 200) {
      try {
        const posts = JSON.parse(wpDoc.body) as Array<Record<string, unknown>>;
        const normalizedPosts = Array.isArray(posts)
          ? posts.map(p => ({
              ...p,
              modified_gmt:
                typeof p.modified_gmt === 'string' &&
                !/[zZ]|[+-]\d{2}:?\d{2}$/.test(p.modified_gmt)
                  ? `${p.modified_gmt}Z`
                  : p.modified_gmt,
              date_gmt:
                typeof p.date_gmt === 'string' &&
                !/[zZ]|[+-]\d{2}:?\d{2}$/.test(p.date_gmt)
                  ? `${p.date_gmt}Z`
                  : p.date_gmt,
            }))
          : posts;
        const updatedAt = this.extractMaxJsonDate(normalizedPosts, [
          'modified_gmt',
          'date_gmt',
          'modified',
          'date',
        ]);
        if (updatedAt) {
          return this.successResult(monitor, checkedAt, {
            signalSource: 'api',
            contentUpdatedAt: updatedAt,
            contentHash: await this.sha256Hex(wpDoc.body),
            etag: wpDoc.headers.get('etag'),
            httpLastModified: this.parseDateIso(
              wpDoc.headers.get('last-modified')
            ),
          });
        }
      } catch {
        // Fall through to HTML/sitemap checks.
      }
    }

    // 2. Try sitemap.xml if not WAF-blocked.
    if (!this.isWafBlocked(wpDoc.status, wpDoc.body)) {
      const sitemapDoc = await this.fetchDocument(
        `${baseUrl}/sitemap.xml`,
        ctx,
        timeoutMs,
        'application/xml,text/xml'
      );
      if (sitemapDoc.status === 200) {
        const updatedAt = this.extractMaxXmlDate(sitemapDoc.body);
        if (updatedAt) {
          return this.successResult(monitor, checkedAt, {
            signalSource: 'sitemap',
            contentUpdatedAt: updatedAt,
            contentHash: await this.sha256Hex(sitemapDoc.body),
            etag: sitemapDoc.headers.get('etag'),
            httpLastModified: this.parseDateIso(
              sitemapDoc.headers.get('last-modified')
            ),
          });
        }
      }
    }

    // 3. Fall back to main page HTML + headers.
    const doc = await this.fetchDocument(monitor.url, ctx, timeoutMs);
    if (this.isWafBlocked(doc.status, doc.body)) {
      return this.errorResult(monitor, checkedAt, 'waf_403');
    }
    if (doc.status >= 400) {
      return this.errorResult(monitor, checkedAt, `http_${doc.status}`);
    }

    const httpLastModified = this.parseDateIso(doc.headers.get('last-modified'));
    const metaDate = this.extractHtmlModifiedDate(doc.body);
    const contentUpdatedAt = metaDate ?? httpLastModified;
    const contentHash = await this.sha256Hex(this.normalizeHtml(doc.body));

    return this.successResult(monitor, checkedAt, {
      signalSource: metaDate
        ? 'meta'
        : httpLastModified
          ? 'http_header'
          : 'content_hash',
      contentUpdatedAt,
      contentHash,
      etag: doc.headers.get('etag'),
      httpLastModified,
    });
  }
}
