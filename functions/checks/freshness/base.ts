import type {
  CheckContext,
  FreshnessResult,
  FreshnessSignalSource,
  MonitorDefinition,
} from '../../types';
import { classifyFetchError } from '../http';
import type { FreshnessProbe } from './types';

const MAX_BODY_BYTES = 262_144;
const DEFAULT_TIMEOUT_MS = 15_000;

export interface FetchedDocument {
  status: number;
  url: string;
  headers: Headers;
  body: string;
}

/**
 * Shared base class for content freshness probes.
 * Handles bounded HTTP fetching, HTML normalization, SHA-256 fingerprinting,
 * and common date extraction across XML sitemaps, RSS/Atom feeds, JSON, and HTML meta tags.
 */
export abstract class BaseFreshnessProbe implements FreshnessProbe {
  abstract readonly name: string;

  async probe(
    monitor: MonitorDefinition,
    ctx: CheckContext
  ): Promise<FreshnessResult> {
    const checkedAt = new Date().toISOString();
    try {
      return await this.executeProbe(monitor, ctx, checkedAt);
    } catch (err) {
      return this.errorResult(monitor, checkedAt, classifyFetchError(err));
    }
  }

  protected abstract executeProbe(
    monitor: MonitorDefinition,
    ctx: CheckContext,
    checkedAt: string
  ): Promise<FreshnessResult>;

  protected async fetchDocument(
    url: string,
    ctx: CheckContext,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    accept = 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8'
  ): Promise<FetchedDocument> {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': ctx.userAgent,
        Accept: accept,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    const body = await this.readBoundedText(res);
    return {
      status: res.status,
      url: res.url || url,
      headers: res.headers,
      body,
    };
  }

  protected async readBoundedText(res: Response): Promise<string> {
    if (!res.body) return '';
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
      while (total < MAX_BODY_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        const slice = value.subarray(0, MAX_BODY_BYTES - total);
        chunks.push(slice);
        total += slice.byteLength;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }

  protected isWafBlocked(status: number, body: string): boolean {
    if (status === 403 || status === 429) return true;
    const lower = body.slice(0, 2048).toLowerCase();
    return (
      lower.includes('just a moment...') ||
      lower.includes('cf-browser-verification') ||
      lower.includes('attention required! | cloudflare')
    );
  }

  /**
   * Strips volatile markup (scripts, styles, comments, CSRF/nonce tokens)
   * and collapses whitespace so content hashes only change on meaningful edits.
   */
  protected normalizeHtml(html: string): string {
    return html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(
        /<meta[^>]+name=["'](?:csrf[-_]?token|_token|nonce)["'][^>]*>/gi,
        ' '
      )
      .replace(
        /<input[^>]+type=["']hidden["'][^>]+(?:csrf|_token|nonce)[^>]*>/gi,
        ' '
      )
      .replace(/\snonce=["'][^"']*["']/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  protected async sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  protected parseDateIso(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const ms = Date.parse(trimmed);
    if (!Number.isFinite(ms)) return null;
    const year = new Date(ms).getUTCFullYear();
    if (year < 2000 || year > 2100) return null;
    return new Date(ms).toISOString();
  }

  protected extractMaxXmlDate(xml: string): string | null {
    const tagPattern = /<(?:lastmod|pubDate|updated|dc:date)>([^<]+)<\/(?:lastmod|pubDate|updated|dc:date)>/gi;
    let maxMs = -Infinity;
    for (const match of xml.matchAll(tagPattern)) {
      const iso = this.parseDateIso(match[1]);
      if (iso) {
        const ms = Date.parse(iso);
        if (ms > maxMs) maxMs = ms;
      }
    }
    return Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : null;
  }

  protected extractHtmlModifiedDate(html: string): string | null {
    const patterns = [
      /<meta[^>]+(?:property|name)=["'](?:article:modified_time|og:updated_time|last-modified|dcterms\.modified)["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:modified_time|og:updated_time|last-modified|dcterms\.modified)["']/i,
      /"dateModified"\s*:\s*"([^"]+)"/i,
      /"datePublished"\s*:\s*"([^"]+)"/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      const iso = this.parseDateIso(match?.[1]);
      if (iso) return iso;
    }

    let maxMs = -Infinity;
    for (const match of html.matchAll(/<time[^>]+datetime=["']([^"']+)["']/gi)) {
      const iso = this.parseDateIso(match[1]);
      if (iso) {
        const ms = Date.parse(iso);
        if (ms > maxMs) maxMs = ms;
      }
    }
    return Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : null;
  }

  protected extractMaxJsonDate(
    data: unknown,
    candidateKeys = ['updatedAt', 'updated_at', 'modified', 'dateModified', 'date', 'created_at']
  ): string | null {
    let maxMs = -Infinity;
    const visit = (node: unknown, depth: number) => {
      if (depth > 5 || node == null) return;
      if (Array.isArray(node)) {
        for (const item of node.slice(0, 50)) {
          visit(item, depth + 1);
        }
        return;
      }
      if (typeof node === 'object') {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (typeof v === 'string' && candidateKeys.includes(k)) {
            const iso = this.parseDateIso(v);
            if (iso) {
              const ms = Date.parse(iso);
              if (ms > maxMs) maxMs = ms;
            }
          } else if (typeof v === 'object' && v !== null) {
            visit(v, depth + 1);
          }
        }
      }
    };
    visit(data, 0);
    return Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : null;
  }

  protected successResult(
    monitor: MonitorDefinition,
    checkedAt: string,
    opts: {
      signalSource: FreshnessSignalSource;
      contentUpdatedAt?: string | null;
      contentHash?: string | null;
      etag?: string | null;
      httpLastModified?: string | null;
    }
  ): FreshnessResult {
    return {
      monitor_slug: monitor.slug,
      checked_at: checkedAt,
      signal_source: opts.signalSource,
      content_updated_at: opts.contentUpdatedAt ?? null,
      content_hash: opts.contentHash ?? null,
      etag: opts.etag ?? null,
      http_last_modified: opts.httpLastModified ?? null,
      probe_error: null,
    };
  }

  protected errorResult(
    monitor: MonitorDefinition,
    checkedAt: string,
    probeError: string
  ): FreshnessResult {
    return {
      monitor_slug: monitor.slug,
      checked_at: checkedAt,
      signal_source: null,
      content_updated_at: null,
      content_hash: null,
      etag: null,
      http_last_modified: null,
      probe_error: probeError,
    };
  }
}
