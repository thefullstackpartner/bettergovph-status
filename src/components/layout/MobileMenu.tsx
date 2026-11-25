import { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container } from '../ui';
import { cn } from '../../lib/utils';

type Props = {
  onClose: () => void;
};

const LINKS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Status Overview', href: '/status' },
  { label: 'Incidents', href: '/incidents' },
  { label: 'Scorecards', href: '/scorecards' },
  { label: 'About & Methodology', href: '/about' },
];

const MobileMenu: FC<Props> = ({ onClose }) => {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Mobile"
      className="border-t border-ed-rule bg-ed-paper-2 py-3 lg:hidden"
    >
      <Container className="flex flex-col gap-1">
        {LINKS.map(item => {
          const active =
            item.href === '/'
              ? pathname === '/' || pathname === '/dashboard'
              : item.href === '/status'
                ? pathname === '/status' || pathname.startsWith('/monitors')
                : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={cn(
                'px-3 py-2.5 font-serif-ed text-base font-semibold text-ed-ink-2 no-underline hover:bg-ed-navy-tint hover:text-ed-navy',
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

export default MobileMenu;
