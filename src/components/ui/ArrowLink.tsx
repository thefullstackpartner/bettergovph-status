import { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type Props = {
  to: string;
  children: ReactNode;
  className?: string;
};

const ArrowLink: FC<Props> = ({ to, children, className }) => (
  <Link
    to={to}
    className={cn(
      'inline-flex items-center gap-1.5 font-sans-ed text-sm font-semibold text-ed-navy no-underline hover:underline hover:underline-offset-4',
      className
    )}
  >
    <span>{children}</span>
    <ArrowRightIcon size={14} />
  </Link>
);

export default ArrowLink;
