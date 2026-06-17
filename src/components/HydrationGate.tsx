import type { ReactNode } from 'react';
import { useProjectStore } from '../store/projectStore';
import { FoundryMark } from '../icons';

/**
 * Holds back the app until persisted state has been read from localStorage.
 * Without this gate, the first render would mount with empty defaults and could
 * race the rehydration — the exact "refresh wiped my work" failure we must
 * prevent. The splash is intentionally minimal and brand-consistent.
 */
export function HydrationGate({ children }: { children: ReactNode }) {
  const hasHydrated = useProjectStore((s) => s._hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3 text-content-muted">
          <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-brand-600 text-white">
            <FoundryMark width={26} height={26} />
          </span>
          <p className="text-sm">Restoring your workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
