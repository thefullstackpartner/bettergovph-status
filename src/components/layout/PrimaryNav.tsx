import { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container } from '../ui';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { label: 'Status Overview', href: '/' },
  { label: 'Incidents', href: '/incidents' },
  { label: 'About & Methodology', href: '/about' },
];

const PrimaryNav: FC = () => {
  const { pathname } = useLocation();

  return (
    <nav className="border-t border-ed-rule bg-white max-lg:hidden" aria-label="Primary">
      <Container className="flex flex-wrap items-stretch justify-start">
        {NAV_ITEMS.map(item => {
          const active =
            item.href === '/'
              ? pathname === '/' || pathname.startsWith('/monitors')
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'inline-flex items-center whitespace-nowrap px-5 py-3 font-serif-ed text-base font-semibold text-ed-ink-2 no-underline transition-colors hover:bg-ed-navy-tint hover:text-ed-navy',
                active && 'bg-ed-navy-tint text-ed-navy'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </Container>
    </nav>
  );
};

export default PrimaryNav;
