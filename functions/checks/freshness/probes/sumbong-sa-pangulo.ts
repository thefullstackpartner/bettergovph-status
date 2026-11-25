import type { CheckContext, FreshnessResult, MonitorDefinition } from '../../../types';
import { BaseFreshnessProbe } from '../base';

/**
 * Freshness probe for Sumbong sa Pangulo (sumbongsapangulo.ph).
 * Checks sitemap/feed when accessible, then falls back to HTML meta dates
 * and normalized content hashing. Gracefully reports `waf_403` when
 * Cloudflare Bot Management challenges automated requests.
 */
export class SumbongSaPanguloFreshnessProbe extends BaseFreshnessProbe {
  readonly name = 'sumbong-sa-pangulo';

  protected async executeProbe(
    monitor: MonitorDefinition,
    ctx: CheckContext,
    checkedAt: string
  ): Promise<FreshnessResult> {
    const baseUrl = new URL(monitor.url).origin;
    const timeoutMs = monitor.timeoutMs ?? 15_000;

    // 1. Check sitemap.xml first.
    const sitemapDoc = await this.fetchDocument(
      `${baseUrl}/sitemap.xml`,
      ctx,
      timeoutMs,
      'application/xml,text/xml'
    );
    if (this.isWafBlocked(sitemapDoc.status, sitemapDoc.body)) {
      return this.errorResult(monitor, checkedAt, 'waf_403');
    }
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

    // 2. Fall back to main page HTML + headers.
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
