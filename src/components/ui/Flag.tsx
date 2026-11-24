import { FC, HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const Flag: FC<HTMLAttributes<HTMLSpanElement>> = ({ className, ...rest }) => (
  <span
    className={cn(
      'inline-block border border-ed-rule-strong px-2 py-0.5 font-mono-ed text-[10px] uppercase tracking-[0.12em]',
      className
    )}
    {...rest}
  />
);

export default Flag;
