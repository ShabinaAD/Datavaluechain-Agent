import { cn } from '../../lib/cn';
import type { StageStatus } from '../../store/types';

const LABELS: Record<StageStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  review: 'In review',
  complete: 'Complete',
};

const STYLES: Record<StageStatus, string> = {
  not_started: 'bg-surface-muted text-content-muted',
  in_progress: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  review: 'bg-accent-400/20 text-accent-600 dark:text-accent-400',
  complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

export function StatusBadge({ status }: { status: StageStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        STYLES[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {LABELS[status]}
    </span>
  );
}
