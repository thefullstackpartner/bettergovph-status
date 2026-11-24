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
              than 3,000 ms, or returned HTTP <code>403</code> from a WAF/bot
              challenge (shown as <strong>Probe Blocked (WAF)</strong>).
            </li>
            <li>
              <strong>Down:</strong> Timeout (15 s), DNS/TLS/connection failure,
              missing expected keyword, HTTP 4xx/5xx status (other than WAF{' '}
              <code>403</code>), or an HTML page displaying a maintenance notice
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
