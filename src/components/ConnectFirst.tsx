import { useRuntimeStore } from '../store/runtimeStore';

/**
 * Non-blocking "Connect first" notice (spec 1.10). When an external service
 * (e.g. the database) isn't configured, we tell the user clearly instead of
 * crashing — and they can keep working with sensible defaults in the meantime.
 */
export function ConnectFirst({ service, hint }: { service: string; hint: string }) {
  const ready = useRuntimeStore((s) => s.ready);
  const dbConfigured = useRuntimeStore((s) => s.config.database.configured);

  if (!ready || dbConfigured) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-medium">Connect first: {service} is not configured</p>
      <p className="mt-0.5 text-amber-700 dark:text-amber-300">{hint}</p>
    </div>
  );
}
