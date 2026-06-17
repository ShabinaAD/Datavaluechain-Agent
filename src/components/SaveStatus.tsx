import { useProjectStore } from '../store/projectStore';
import { useNow } from '../hooks/useNow';
import { formatRelativeTime } from '../lib/format';
import { ShieldCheckIcon } from '../icons';
import { cn } from '../lib/cn';

/**
 * The trust signal. Tells the user — at all times — that their work is safely
 * persisted to this device and when it was last saved. Updates live.
 */
export function SaveStatus({ className }: { className?: string }) {
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const now = useNow(10_000);

  const saved = lastSavedAt !== null;
  const relative = formatRelativeTime(lastSavedAt, now);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs',
        className,
      )}
      title={saved ? 'Your work is saved to this browser and survives refreshes' : undefined}
    >
      <ShieldCheckIcon
        width={15}
        height={15}
        className={saved ? 'text-emerald-500' : 'text-content-subtle'}
      />
      <span className="text-content-muted">
        {saved ? (
          <>
            <span className="font-medium text-content">All changes saved</span>
            <span className="hidden sm:inline"> · {relative}</span>
          </>
        ) : (
          'No changes yet'
        )}
      </span>
    </div>
  );
}
