import { FC, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Props = {
  tone?: 'info' | 'warning' | 'error';
  children: ReactNode;
  className?: string;
};

const toneClasses = {
  info: 'border-ed-navy bg-ed-navy-tint text-ed-ink',
  warning: 'border-warning-500 bg-warning-50 text-ed-ink',
  error: 'border-ed-red bg-red-50 text-ed-red-ink',
};

const Notice: FC<Props> = ({ tone = 'info', children, className }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={cn(
      'border-l-4 px-4 py-3 font-sans-ed text-sm leading-relaxed',
      toneClasses[tone],
      className
    )}
  >
    {children}
  </div>
);

export default Notice;
