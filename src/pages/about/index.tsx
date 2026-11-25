import { FC, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GradeBadge } from '../../components/status';
import {
  Card,
  Container,
  Eyebrow,
  Notice,
  SectionHeader,
} from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { SUGGEST_PORTAL_URL } from '../../lib/links';

const AGENT_LINKS = [
  {
    href: '/llms.txt',
    description: 'LLM-friendly index of the site, API, and data (llmstxt.org).',
  },
  {
    href: '/status.md',
    description:
      'Live status as compact Markdown: what is down, slow, or blocked right now.',
  },
  {
    href: '/api/openapi.json',
    description: 'OpenAPI 3.1 spec for the JSON API (tool / function calling).',
  },
  {
    href: '/api/monitors?view=lite&status=down',
    description:
      'Filterable JSON list of monitors (status, category, tier, q).',
  },
  {
    href: '/incidents.rss',
    description:
      'RSS 2.0 feed of outage incidents (?status=open for ongoing only); per-monitor feeds at /api/monitors/{slug}/feed.xml.',
  },
  {
    href: '/api/scorecards?period=30d',
    description:
      'Agency & portal reliability scorecards with grades, incident counts, and MTTR (supports format=json or format=csv).',
  },
];

const AboutPage: FC = () => {
  useDocumentTitle('About & Methodology | BetterGovPH Status');
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hash]);

  return (
    <Container narrow className="space-y-8 py-8">
      <div>
        <Eyebrow tone="navy">Methodology</Eyebrow>
        <h1 className="mt-1 font-serif-ed text-3xl font-bold text-ed-ink">
          How BetterGovPH Status Works
        </h1>
        <p className="mt-3 font-sans-ed text-base leading-relaxed text-ed-ink-2">
          BetterGovPH Status is a volunteer-run, open-source monitor tracking
          the availability and response times of Philippine government online
          portals and services from Cloudflare&apos;s edge.
        </p>
      </div>

      <Notice tone="info">
        <strong>Check origin &amp; WAF caveat:</strong> Probes run from
        Cloudflare&apos;s global network (typically Singapore, Hong Kong, or
        nearby APAC PoPs). Some government portals restrict datacenter IP ranges
        or place JavaScript WAF challenges (such as Cloudflare Bot Fight Mode or
        AWS WAF) in front of their pages. Plain HTTP probes cannot execute
        JavaScript challenges, so WAF-blocked portals are flagged as{' '}
        <strong>Probe Blocked (WAF)</strong> (<code>degraded</code> internally)
        rather than Down. Because the firewall blocks our probe before it
        reaches the origin server, we cannot see whether the portal behind it is
        operational or under maintenance—it may still be accessible normally in
        your browser. Every check records the Cloudflare colo that executed it.
      </Notice>

      <section id="check-intervals">
        <SectionHeader label="Check Intervals &amp; Status Rules" />
        <Card className="space-y-4 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Critical portals (5-minute interval):</strong> Curated,
              high-traffic citizen services (such as BIR, SSS, PhilHealth,
              Pag-IBIG, PSA, DFA, LTO, and eGovPH), badged{' '}
              <strong>Critical</strong> across the dashboard.
            </li>
            <li>
              <strong>Standard portals (15-minute interval):</strong> Agency and
              LGU/SUC websites imported from the BetterGov.ph directory, checked
              at every 15-minute mark (<code>:00</code>, <code>:15</code>,{' '}
              <code>:30</code>, <code>:45</code>).
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
              <strong>Down:</strong> Timeout (15 s, shown as{' '}
              <strong>Down · Timeout</strong>), DNS/TLS/connection failure,
              missing expected keyword, HTTP 4xx/5xx status (other than WAF{' '}
              <code>403</code>; HTTP <code>404</code> is shown as{' '}
              <strong>Not Found (404)</strong>), or an HTML page displaying a
              maintenance notice (shown as <strong>Under Maintenance</strong>,
              e.g., &ldquo;under maintenance&rdquo;, &ldquo;scheduled
              maintenance&rdquo;) since citizens cannot transact.
            </li>
            <li>
              <strong>Incidents &amp; Retention:</strong> A portal&apos;s status
              flips to <strong>Down</strong> immediately on the 1st failed
              check, while an incident opens after{' '}
              <strong>2 consecutive down checks</strong> (to filter out brief
              one-off blips) and resolves after{' '}
              <strong>2 consecutive operational/degraded checks</strong>. Raw
              check samples are retained for 30 days; daily rollups are kept
              indefinitely.
            </li>
          </ul>
        </Card>
      </section>

      <section id="content-freshness">
        <SectionHeader label="Content Freshness &amp; Update Frequency" />
        <Card className="space-y-3 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <p>
            Beyond uptime and latency, selected data portals (such as{' '}
            <strong>Project DIME</strong>, <strong>DPWH Transparency</strong>,
            and <strong>Sumbong sa Pangulo</strong>) are probed every{' '}
            <strong>6 hours</strong> to measure how often their content updates
            and whether their data has gone stale.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Portal-specific probes:</strong> Each tracked portal uses
              a dedicated probe implementation—for example, inspecting Next.js{' '}
              <code>__NEXT_DATA__</code> payloads, WordPress REST APIs, XML
              sitemaps, HTML metadata, or normalized SHA-256 content
              fingerprints (stripping volatile CSRF/nonce tokens and scripts).
            </li>
            <li>
              <strong>Calculated staleness (default 30 days):</strong> Freshness
              status (<strong>Fresh</strong> vs. <strong>Stale</strong>) is
              calculated dynamically at read time from the most recent detected
              update or content change against a configurable threshold (
              <code>FRESHNESS_STALE_DAYS</code>, default <code>30</code> days).
            </li>
            <li>
              <strong>Independent from uptime:</strong> Stale content never
              marks a portal as <strong>Down</strong> or opens an outage
              incident. If a freshness probe is blocked by a portal WAF (
              <code>403</code>), previously recorded freshness history is
              preserved.
            </li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader label="Uptime Bar Color Legend" />
        <Card className="space-y-3 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <p>
            Each vertical bar represents one hour (24h view) or one day (45d/90d
            view) in Asia/Manila time, colored by the checks recorded during
            that window:
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

      <section>
        <SectionHeader label="For Developers &amp; AI Agents" />
        <Card className="space-y-3 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <p>
            All status data is public and free to use. Developers, AI
            assistants, and agents can read it directly without scraping this
            page:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            {AGENT_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-medium text-ed-navy underline underline-offset-2 hover:text-ed-navy-ink"
                >
                  <code className="font-mono-ed text-xs">{link.href}</code>
                </a>{' '}
                — {link.description}
              </li>
            ))}
          </ul>
          <p>
            AI assistants that fetch pages to answer a user&apos;s question are
            welcome. Collecting this content to train AI models is not permitted
            (see{' '}
            <a
              href="/robots.txt"
              className="font-medium text-ed-navy underline underline-offset-2 hover:text-ed-navy-ink"
            >
              robots.txt
            </a>
            ). The API is rate-limited to 120 requests per minute per IP.
          </p>
        </Card>
      </section>

      <section id="reliability-scorecards">
        <SectionHeader label="Reliability Scorecards & Grading" />
        <Card className="space-y-3 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <p>
            The{' '}
            <a
              href="/scorecards"
              className="font-medium text-ed-navy underline underline-offset-2 hover:text-ed-navy-ink"
            >
              Reliability Scorecards
            </a>{' '}
            page summarizes portal and category performance over 7-day, 30-day,
            90-day, and 1-year windows, including{' '}
            <strong>Mean Time to Recovery (MTTR)</strong> for resolved incidents
            and one-click CSV/JSON exports.
          </p>
          <p>
            Letter grades are computed from a{' '}
            <strong>0–100 composite reliability score</strong> combining{' '}
            <strong>70% availability</strong> (non-down checks),{' '}
            <strong>15% clean uptime</strong> (fast, non-WAF-blocked checks),
            and <strong>15% latency</strong> (full points &le; 500 ms, scaling
            down as response times approach 3 s+):
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <span className="inline-flex items-center gap-1.5">
              <GradeBadge grade="A" /> <span>&ge; 95</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GradeBadge grade="B" /> <span>&ge; 90</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GradeBadge grade="C" /> <span>&ge; 80</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GradeBadge grade="D" /> <span>&ge; 70</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GradeBadge grade="F" /> <span>&lt; 70</span>
            </span>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader label="Suggest a Missing Portal" />
        <Card className="space-y-3 font-sans-ed text-sm leading-relaxed text-ed-ink-2">
          <p>
            Our monitor directory is community-maintained and may not yet
            include every newly launched government initiative, microsite, or
            citizen-facing sub-portal.
          </p>
          <p>
            If a critical Philippine government portal is missing,{' '}
            <a
              href={SUGGEST_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ed-navy underline underline-offset-2 hover:text-ed-navy-ink"
            >
              suggest a portal on GitHub ↗
            </a>{' '}
            with its URL, agency, and why it matters for citizens.
          </p>
        </Card>
      </section>
    </Container>
  );
};

export default AboutPage;
