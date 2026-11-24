import { FC, useEffect, useRef, useState } from 'react';
import { HelpCircleIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type Props = {
  label: string;
  text: string;
  align?: 'left' | 'right';
};

const InfoHint: FC<Props> = ({ label, text, align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={e => {
          e.stopPropagation();
          setOpen(prev => !prev);
        }}
        className="inline-flex cursor-pointer items-center p-0.5 text-ed-ink-4 transition-colors hover:text-ed-navy focus:text-ed-navy focus:outline-none"
      >
        <HelpCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={cn(
            'absolute top-full z-30 mt-1.5 w-60 max-w-[calc(100vw-2rem)] border border-ed-ink bg-white p-2.5 text-left font-sans-ed text-[11px] font-normal normal-case leading-relaxed tracking-normal text-ed-ink shadow-md',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default InfoHint;
