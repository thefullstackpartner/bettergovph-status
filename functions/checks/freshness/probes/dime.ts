import type { CheckContext, FreshnessResult, MonitorDefinition } from '../../../types';
import { BaseFreshnessProbe } from '../base';

/**
 * Freshness probe tailored for Project DIME (www.dime.gov.ph).
 * Project DIME is a Next.js application that does not emit Last-Modified on `/`.
 * This probe inspects:
 * 1. Embedded `__NEXT_DATA__` payload (if present) for project/update timestamps and payload hash.
 * 2. Next.js `buildId` + normalized HTML content hash (stripping CSRF/token meta tags).
 */
export class DimeFreshnessProbe extends BaseFreshnessProbe {
  readonly name = 'dime-nextjs';

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

    const etag = doc.headers.get('etag');
    const httpLastModified = this.parseDateIso(doc.headers.get('last-modified'));

    // Extract __NEXT_DATA__ JSON if present so we can detect data/build updates cleanly.
    const nextDataMatch = doc.body.match(
      /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
    );
    let contentUpdatedAt: string | null = null;
    let fingerprintSource = this.normalizeHtml(doc.body);

    if (nextDataMatch?.[1]) {
      try {
        const parsed = JSON.parse(nextDataMatch[1]) as {
          buildId?: string;
          props?: unknown;
        };
        contentUpdatedAt = this.extractMaxJsonDate(parsed.props);
        // Hash props + buildId so asset/data changes are captured without volatile HTML attributes.
        fingerprintSource = JSON.stringify({
          buildId: parsed.buildId ?? null,
          props: parsed.props ?? null,
          text: fingerprintSource,
        });
      } catch {
        // Fall back to normalized HTML if __NEXT_DATA__ is malformed.
      }
    }

    if (!contentUpdatedAt) {
      contentUpdatedAt =
        this.extractHtmlModifiedDate(doc.body) ?? httpLastModified;
    }

    const contentHash = await this.sha256Hex(fingerprintSource);
    const signalSource = contentUpdatedAt
      ? nextDataMatch?.[1]
        ? 'api'
        : httpLastModified
          ? 'http_header'
          : 'meta'
      : 'content_hash';

    return this.successResult(monitor, checkedAt, {
      signalSource,
      contentUpdatedAt,
      contentHash,
      etag,
      httpLastModified,
    });
  }
}
