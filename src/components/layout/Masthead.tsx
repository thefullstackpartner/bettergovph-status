import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { MenuIcon, XIcon } from 'lucide-react';
import { Button, Container } from '../ui';
import PrimaryNav from './PrimaryNav';
import MobileMenu from './MobileMenu';

const Masthead: FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b-2 border-b-blue-950 bg-white font-sans-ed text-ed-ink antialiased shadow-sm">
      <Container>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-8 py-5 max-md:grid-cols-[auto_auto] max-md:justify-between max-md:gap-3 max-md:py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-3 text-ed-ink no-underline"
          >
            <img
              src="/logos/emblem-primary.webp"
              alt="BetterGov.ph emblem"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className="flex flex-col">
              <span className="font-serif-ed text-xl font-bold tracking-tight text-ed-ink max-md:text-lg">
                BetterGovPH <span className="text-ed-navy">Status</span>
              </span>
              <span className="font-mono-ed text-[10px] uppercase tracking-[0.14em] text-ed-ink-4">
                Civic Uptime Monitor
              </span>
            </span>
          </Link>

          <div className="max-w-[340px] border-l border-ed-rule pl-6 font-mono-ed text-[10px] uppercase leading-tight tracking-[0.16em] text-ed-ink-3 max-xl:hidden">
            Monitoring Philippine government online portals and services from
            the edge
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              className="lg:hidden"
            >
              {mobileOpen ? <XIcon size={16} /> : <MenuIcon size={16} />}
              <span>Menu</span>
            </Button>
          </div>
        </div>
      </Container>
      <PrimaryNav />
      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}
    </header>
  );
};

export default Masthead;
