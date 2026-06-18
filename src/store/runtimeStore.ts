import { create } from 'zustand';
import type { ConfigInfo } from '../lib/api';
import { OFFLINE_CONFIG } from '../lib/api';

/**
 * Runtime (non-persisted) view of the server: whether we have a live server
 * session and what's configured. Drives the connection indicator and the
 * "Connect first" messaging (spec 1.10).
 */
interface RuntimeState {
  /** True once the initial server probe has completed (success or offline). */
  ready: boolean;
  /** True when the application server responded to the health check. */
  serverOnline: boolean;
  config: ConfigInfo;
  setRuntime: (next: { serverOnline: boolean; config: ConfigInfo }) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  ready: false,
  serverOnline: false,
  config: OFFLINE_CONFIG,
  setRuntime: ({ serverOnline, config }) => set({ ready: true, serverOnline, config }),
}));
