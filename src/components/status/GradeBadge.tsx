import { FC } from 'react';
import { cn } from '../../lib/utils';
import type { ScorecardGrade } from '../../types';

const GRADE_STYLE: Record<ScorecardGrade, string> = {
  A: 'border-success-500/40 bg-success-50 text-success-700',
  B: 'border-emerald-400/50 bg-emerald-50 text-emerald-800',
  C: 'border-warning-500/40 bg-warning-50 text-warning-700',
  D: 'border-orange-400/50 bg-orange-50 text-orange-800',
  F: 'border-ed-red/40 bg-red-50 text-ed-red-ink',
  'N/A': 'border-ed-rule bg-ed-paper-2 text-ed-ink-4',
};

const GradeBadge: FC<{ grade: ScorecardGrade; score?: number | null }> = ({
  grade,
  score,
}) => (
  <span
    title={score !== null && score !== undefined ? `Composite score: ${score.toFixed(1)} / 100` : undefined}
    className={cn(
      'inline-flex min-w-[28px] items-center justify-center border px-1.5 py-0.5 font-mono-ed text-xs font-bold',
      GRADE_STYLE[grade]
    )}
  >
    {grade}
  </span>
);

export default GradeBadge;
