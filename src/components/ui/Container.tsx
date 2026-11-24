import { FC, HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Props = HTMLAttributes<HTMLDivElement> & {
  narrow?: boolean;
};

/**
 * Standard page container. Widths come from --container-page tokens in index.css.
 */
const Container: FC<Props> = ({ narrow, className, ...rest }) => (
  <div
    className={cn(
      'mx-auto w-full px-4 md:px-6 xl:px-8',
      narrow ? 'max-w-page-narrow' : 'max-w-page',
      className
    )}
    {...rest}
  />
);

export default Container;
