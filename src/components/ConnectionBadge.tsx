import { useRuntimeStore } from '../store/runtimeStore';
import { cn } from '../lib/cn';

/**
 * Compact runtime indicator (spec 1.9, 1.10). Shows whether the AI service is
 * connected; when it isn't, results come from the local fallback. It never
 * crashes and never names the underlying model — it only reports connectivity.
 */
export function ConnectionBadge() {
  const ready = useRuntimeStore((s) => s.ready);
  const aiConfigured = useRuntimeStore((s) => s.config.ai.configured);

  if (!ready) return null;

  const online = aiConfigured;
  return (
    <span
      title={online ? 'AI service connected' : 'AI service not connected — using offline fallback'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        online
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-amber-500')}
      />
      {online ? 'Agent online' : 'Offline fallback'}
    </span>
  );
}
