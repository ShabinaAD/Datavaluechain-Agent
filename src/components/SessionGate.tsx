import type { ReactNode } from 'react';
import { useBootstrap } from '../hooks/useBootstrap';
import { useRuntimeStore } from '../store/runtimeStore';
import { FoundryMark } from '../icons';

/**
 * Runs the server probe (boot-id + config) and holds the app back until it
 * completes, so the "dies with the server" wipe (spec 1.7) happens before any
 * stale work is shown or editable. The probe is fast and falls back to offline
 * defaults if the server is unreachable, so this never blocks indefinitely.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  useBootstrap();
  const ready = useRuntimeStore((s) => s.ready);

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3 text-content-muted">
          <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-brand-600 text-white">
            <FoundryMark width={26} height={26} />
          </span>
          <p className="text-sm">Connecting to your workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
