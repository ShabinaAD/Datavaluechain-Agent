import { useEffect } from 'react';
import { fetchConfig, fetchHealth } from '../lib/api';
import { useRuntimeStore } from '../store/runtimeStore';
import { useProjectStore } from '../store/projectStore';

/** localStorage key holding the last server boot id this browser bound to. */
const BOOT_KEY = 'dvcaf.bootId';

/**
 * Implements the work-preservation lifecycle (spec 1.7, 1.13):
 *   - "survives refresh & reopen": persisted state is left untouched.
 *   - "dies with the server": when the server reports a NEW boot id (i.e. it was
 *     restarted), persisted work is reset to defaults — and only then.
 *
 * If the server is unreachable we never wipe: a missing server is not a restart,
 * and silently destroying hours of work would be the worst possible outcome.
 */
export function useBootstrap() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [health, config] = await Promise.all([fetchHealth(), fetchConfig()]);
      if (cancelled) return;

      if (health) {
        const stored = localStorage.getItem(BOOT_KEY);
        if (stored && stored !== health.bootId) {
          // Confirmed server restart → reset work to defaults.
          useProjectStore.getState().resetProject();
        }
        localStorage.setItem(BOOT_KEY, health.bootId);
      }

      useRuntimeStore.getState().setRuntime({ serverOnline: Boolean(health), config });
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
