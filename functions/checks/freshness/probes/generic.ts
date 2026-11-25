import type { CheckContext, FreshnessResult, MonitorDefinition } from '../../../types';
import { BaseFreshnessProbe } from '../base';

/**
 * Default freshness probe for monitors without a custom portal-specific class.
 * Extracts HTTP Last-Modified, HTML meta/JSON-LD dates, and normalized content hash.
 */
export class GenericFreshnessProbe extends BaseFreshnessProbe {
  readonly name = 'generic-http';

  protected async executeProbe(
    monitor: MonitorDefinition,
    ctx: CheckContext,
    checkedAt: string
  ): Promise<FreshnessResult> {
    const doc = await this.fetchDocument(
      monitor.url,
      ctx,
      monitor.timeoutMs ?? 15_000
    );

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
