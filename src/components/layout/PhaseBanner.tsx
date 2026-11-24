import { FC } from 'react';
import { Container, Flag } from '../ui';

const PhaseBanner: FC = () => (
  <div className="bg-ed-navy-2 text-white">
    <Container className="flex items-start gap-3 py-2 font-sans-ed text-[13px] leading-snug md:items-center max-md:text-[12px]">
      <Flag className="shrink-0 border-white bg-white font-semibold text-ed-navy-2">
        Beta
      </Flag>
      <p className="m-0">
        BetterGovPH Status is an independent, volunteer-run uptime monitor for
        Philippine government online services.{' '}
        <a
          href="/about"
          className="ml-1 inline-block whitespace-nowrap bg-ed-navy-ink px-2 py-0.5 font-semibold text-white no-underline hover:underline hover:underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Methodology &amp; opt-out
        </a>
      </p>
    </Container>
  </div>
);

export default PhaseBanner;
