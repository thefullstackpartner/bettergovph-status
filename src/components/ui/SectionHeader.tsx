import { FC, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Props = {
  label: ReactNode;
  meta?: ReactNode;
  onDark?: boolean;
  className?: string;
};

const SectionHeader: FC<Props> = ({ label, meta, onDark, className }) => (
  <div
    className={cn(
      'mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 max-md:mb-3',
      className
    )}
  >
    <h2
      className={cn(
        'font-serif-ed text-[24px] font-semibold leading-tight tracking-[-0.01em] max-md:text-[19px]',
        onDark ? 'text-white' : 'text-ed-ink'
      )}
    >
      {label}
    </h2>
    {meta != null && (
      <span
        className={cn(
          'font-sans-ed text-[13px] md:ml-auto max-md:w-full max-md:text-xs',
          onDark ? 'text-white/80' : 'text-ed-ink-3'
        )}
      >
        {meta}
      </span>
    )}
  </div>
);

export default SectionHeader;
