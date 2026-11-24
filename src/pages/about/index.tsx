import { FC } from 'react';
import {
  Card,
  Container,
  Eyebrow,
  Notice,
  SectionHeader,
} from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const AboutPage: FC = () => {
  useDocumentTitle('About & Methodology | BetterGovPH Status');

  return (
    <Container narrow className="space-y-8 py-8">
      <div>
        <Eyebrow tone="navy">Methodology</Eyebrow>
        <h1 className="mt-1 font-serif-ed text-3xl font-bold text-ed-ink">
          How BetterGovPH Status Works
        </h1>
        <p className="mt-3 font-sans-ed text-base leading-relaxed text-ed-ink-2">
          BetterGovPH Status is a volunteer-run, open-source monitor tracking the
          availability and response times of Philippine government online
          portals and services from Cloudflare&apos;s edge.
        </p>
      </div>

      <Notice tone="info">
        <strong>Check origin &amp; WAF caveat:</strong> Probes run from
        Cloudflare&apos;s global network (typically Singapore, Hong Kong, or
        nearby APAC PoPs). Some government portals restrict datacenter IP
        ranges or place JavaScript WAF challenges (such as Cloudflare Bot Fight
        Mode or AWS WAF) in front of their pages. Plain HTTP probes cannot
        execute JavaScript challenges, so WAF-blocked portals are flagged as{' '}
        <strong>Probe Blocked (WAF)</strong> (<code>degraded</code>{' '}
        internally) rather than Down. Because the firewall blocks our probe
        before it reaches the origin server, we cannot see whether the portal
        behind it is operational or under maintenance—it may still be accessible
        normally in your browser. Every check records the Cloudflare colo that
        executed it.
      </Notice>

      <section>
        <SectionHeader label="Check Intervals &amp; Status Rules" />
        <Card className="space-y-4 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Critical portals (5-minute interval):</strong> High-traffic
              citizen services such as BIR, SSS, PhilHealth, Pag-IBIG, PSA, DFA,
              LTO, and eGovPH.
            </li>
            <li>
              <strong>Standard portals (15-minute interval):</strong> Agency
              and LGU/SUC websites imported from the BetterGov.ph directory.
            </li>
            <li>
              <strong>Operational:</strong> HTTP 2xx or 3xx response within
              3,000 ms, with no maintenance notice detected.
            </li>
            <li>
              <strong>Degraded:</strong> Reachable, but response took longer
              than 3,000 ms.
            </li>
            <li>
              <strong>Probe Blocked (WAF):</strong> Returned HTTP{' '}
              <code>403</code> from a WAF/bot challenge. Displayed separately
              from Degraded—the portal may still be accessible normally in a
              browser, so it is not counted as down.
            </li>
            <li>
              <strong>Down:</strong> Timeout (15 s), DNS/TLS/connection failure,
              missing expected keyword, HTTP 4xx/5xx status (other than WAF{' '}
              <code>403</code>; HTTP <code>404</code> is shown as{' '}
              <strong>Not Found (404)</strong>), or an HTML page displaying a
              maintenance notice
              (shown as <strong>Under Maintenance</strong>, e.g., &ldquo;under
              maintenance&rdquo;, &ldquo;scheduled maintenance&rdquo;) since
              citizens cannot transact.
            </li>
            <li>
              <strong>Incidents &amp; Retention:</strong> An incident opens
              after <strong>2 consecutive down checks</strong> and resolves
              after <strong>2 consecutive operational/degraded checks</strong>.
              Raw check samples are retained for 30 days; daily rollups are kept
              indefinitely.
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader label="Uptime Bar Color Legend" />
        <Card className="space-y-3 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <p>
            Each vertical bar represents one hour (24h view) or one day
            (45d/90d view) in Asia/Manila time, colored by the checks recorded
            during that window:
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2.5">
              <span
                className="mt-1 h-4 w-2.5 shrink-0 rounded-[1px] bg-success-500"
                aria-hidden="true"
              />
              <span>
                <strong>Green (Operational):</strong> Majority of checks were
                operational with zero down checks.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="mt-1 h-4 w-2.5 shrink-0 rounded-[1px] bg-warning-500"
                aria-hidden="true"
              />
              <span>
                <strong>Orange (Degraded / Partial Outage):</strong> Fewer than
                50% of checks were down, or slow/degraded responses outnumbered
                operational checks.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="mt-1 h-4 w-2.5 shrink-0 rounded-[1px] bg-indigo-500"
                aria-hidden="true"
              />
              <span>
                <strong>Indigo (Probe Blocked — WAF):</strong> Zero down checks,
                and the majority of checks were blocked by a firewall (HTTP{' '}
                <code>403</code>).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="mt-1 h-4 w-2.5 shrink-0 rounded-[1px] bg-ed-red"
                aria-hidden="true"
              />
              <span>
                <strong>Red (Down):</strong> 50% or more of checks in that
                window failed or displayed a maintenance notice.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="mt-1 h-4 w-2.5 shrink-0 rounded-[1px] bg-ed-paper-3"
                aria-hidden="true"
              />
              <span>
                <strong>Gray (No data):</strong> No checks were recorded during
                that window.
              </span>
            </li>
          </ul>
        </Card>
      </section>

      <section className="mb-10">
        <SectionHeader label="Incident Causes" />
        <Card className="space-y-3 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <p>
            When a portal fails two consecutive checks, an incident is opened
            with one of the following causes:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Page Not Found (HTTP 404)</strong> (<code>not_found</code>
              ): The server responded with HTTP <code>404</code>; the monitored
              page may have moved or been removed.
            </li>
            <li>
              <strong>Unexpected HTTP Error</strong> (
              <code>unexpected_status</code> / <code>http_&lt;code&gt;</code>):
              The server returned another failing status code (such as HTTP 5xx
              or 4xx) instead of a healthy response.
            </li>
            <li>
              <strong>Under Maintenance</strong> (<code>maintenance</code>): The
              portal displayed a maintenance notice and could not be used.
            </li>
            <li>
              <strong>Expected Content Missing</strong> (
              <code>keyword_missing</code>): The page loaded but did not contain
              the expected portal content, indicating a broken or placeholder
              page.
            </li>
            <li>
              <strong>Request Timed Out</strong> (<code>timeout</code>): The
              server did not respond within the 15-second check timeout window.
            </li>
            <li>
              <strong>DNS Resolution Failed</strong> (<code>dns</code>): The
              domain name could not be resolved to an IP address.
            </li>
            <li>
              <strong>TLS / SSL Error</strong> (<code>tls</code>): A secure
              HTTPS connection could not be established due to a TLS handshake
              or certificate error.
            </li>
            <li>
              <strong>Connection Failed</strong> (<code>connect</code>): The
              monitoring probe could not establish a network connection to the
              server.
            </li>
            <li>
              <strong>Malformed HTTP Response</strong> (
              <code>invalid_http_header</code>): The server returned invalid
              HTTP headers that could not be parsed.
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader label="Probe Behavior, Allowlisting &amp; Agency Opt-Out" />
        <Card className="space-y-3 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <p>
            Every probe identifies itself with an honest User-Agent header:{' '}
            <code className="bg-ed-paper-2 px-1.5 py-0.5 font-mono-ed text-xs">
              bettergovph-status/1.0
            </code>
            . For HTML responses, we read at most the first 16 KB to check for
            maintenance notices or configured keywords, then immediately cancel
            the stream so we never scrape or store full page content.
          </p>
          <p>
            For legacy servers whose HTTP response headers are rejected by
            Workers&apos; strict HTTP parser, the checker automatically falls
            back to a minimal TLS socket <code>HEAD</code> status-line check.
          </p>
          <p>
            We are actively reaching out to government agencies—and welcome
            agency IT teams—to allowlist{' '}
            <code className="bg-ed-paper-2 px-1.5 py-0.5 font-mono-ed text-xs">
              bettergovph-status/1.0
            </code>{' '}
            in their WAF rules or expose a lightweight unblocked{' '}
            <code className="bg-ed-paper-2 px-1.5 py-0.5 font-mono-ed text-xs">
              /health
            </code>{' '}
            endpoint so we can report accurate origin availability instead of{' '}
            <strong>Probe Blocked (WAF)</strong>. If you manage a government
            portal and need us to adjust a check endpoint, expected status
            codes, or opt out, please open an issue in the GitHub repository.
          </p>
        </Card>
      </section>
    </Container>
  );
};

export default AboutPage;
