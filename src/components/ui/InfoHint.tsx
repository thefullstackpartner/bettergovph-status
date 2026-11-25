import { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HelpCircleIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type Props = {
  label: string;
  text: string;
  align?: 'left' | 'right';
  tone?: 'default' | 'onDark';
};

type TooltipCoords = {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
};

const VIEWPORT_MARGIN = 12;
const MAX_TOOLTIP_WIDTH = 240;
const ESTIMATED_HEIGHT = 120;

const InfoHint: FC<Props> = ({
  label,
  text,
  align = 'left',
  tone = 'default',
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const vw = window.innerWidth || 375;
      const vh = window.innerHeight || 667;
      const width = Math.min(MAX_TOOLTIP_WIDTH, vw - VIEWPORT_MARGIN * 2);

      const preferredLeft =
        align === 'right' ? rect.right - width : rect.left;
      const clampedLeft = Math.max(
        VIEWPORT_MARGIN,
        Math.min(preferredLeft, vw - width - VIEWPORT_MARGIN)
      );

      const openUpward =
        rect.bottom + ESTIMATED_HEIGHT > vh && rect.top > ESTIMATED_HEIGHT;

      setCoords(
        openUpward
          ? {
              left: clampedLeft,
              bottom: vh - rect.top + 6,
              width,
            }
          : {
              left: clampedLeft,
              top: rect.bottom + 6,
              width,
            }
      );
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
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
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={e => {
          e.stopPropagation();
          setOpen(prev => !prev);
        }}
        className={cn(
          'inline-flex cursor-pointer items-center p-0.5 transition-colors focus:outline-none',
          tone === 'onDark'
            ? 'text-white/70 hover:text-white focus:text-white'
            : 'text-ed-ink-4 hover:text-ed-navy focus:text-ed-navy'
        )}
      >
        <HelpCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && coords && (
        <span
          role="tooltip"
          style={{
            left: `${coords.left}px`,
            top: coords.top !== undefined ? `${coords.top}px` : undefined,
            bottom:
              coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
            width: `${coords.width}px`,
          }}
          className={cn(
            'fixed z-50 border border-ed-ink bg-white p-2.5 text-left font-sans-ed text-[11px] font-normal normal-case leading-relaxed tracking-normal text-ed-ink shadow-md'
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default InfoHint;
