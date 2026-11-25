import { FC } from 'react';
import { Link } from 'react-router-dom';
import versionData from '../../version.json';
import { SUGGEST_PORTAL_URL } from '../../lib/links';
import { Container } from '../ui';

const Footer: FC = () => {
  const commit = (versionData as { head_commit?: string })?.head_commit?.slice(
    0,
    6
  );

  return (
    <footer className="mt-16 border-t border-ed-rule bg-ed-paper-2 py-12 font-sans-ed text-sm text-ed-ink-2">
      <Container>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-serif-ed text-base font-bold text-ed-ink">
              BetterGovPH Status
            </h3>
            <p className="mt-2 leading-relaxed text-ed-ink-3">
              Open-source, edge-native uptime monitoring for Philippine
              government portals, inspired by BetterGov.ph.
            </p>
          </div>

          <div>
            <h3 className="font-mono-ed text-[11px] font-semibold uppercase tracking-[0.14em] text-ed-ink-3">
              Navigation
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-ed-ink-2 no-underline hover:text-ed-navy hover:underline"
                >
                  Status Overview
                </Link>
              </li>
              <li>
                <Link
                  to="/incidents"
                  className="text-ed-ink-2 no-underline hover:text-ed-navy hover:underline"
                >
                  Incident History
                </Link>
              </li>
              <li>
                <Link
                  to="/scorecards"
                  className="text-ed-ink-2 no-underline hover:text-ed-navy hover:underline"
                >
                  Reliability Scorecards
                </Link>
              </li>
              <li>
                <a
                  href="/incidents.rss"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ed-ink-2 no-underline hover:text-ed-navy hover:underline"
                >
                  Incidents RSS Feed
                </a>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-ed-ink-2 no-underline hover:text-ed-navy hover:underline"
                >
                  Methodology &amp; Opt-out
                </Link>
              </li>
              <li>
                <a
                  href={SUGGEST_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ed-navy no-underline hover:underline"
                >
                  Suggest a Missing Portal ↗
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono-ed text-[11px] font-semibold uppercase tracking-[0.14em] text-ed-ink-3">
              Data &amp; Attribution
            </h3>
            <p className="mt-2 leading-relaxed text-ed-ink-3">
              Directory seed data adapted from{' '}
              <a
                href="https://github.com/bettergovph/bettergov"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-ed-navy underline underline-offset-2"
              >
                bettergovph/bettergov
              </a>{' '}
              (CC BY-NC-ND 4.0). Source code is MIT licensed.
            </p>
            {commit && (
              <p className="mt-3 font-mono-ed text-[11px] text-ed-ink-4">
                Build {commit}
              </p>
            )}
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-ed-rule pt-6 font-mono-ed text-[11px] text-ed-ink-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <img
              src="/logos/horizontal-primary.webp"
              alt="BetterGov.ph"
              width={176}
              height={44}
              loading="lazy"
              className="h-8 w-auto object-contain"
            />
            <span>Community-built · Open source</span>
            <span>Not an official government website</span>
          </div>
          <a
            href="https://www.gov.ph/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ed-navy underline underline-offset-2 hover:text-ed-navy-ink"
          >
            Official government portal ↗
          </a>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
