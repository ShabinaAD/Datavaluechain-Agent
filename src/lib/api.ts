/**
 * Thin client for the application server. Every call is defensive: if the server
 * is unreachable (e.g. the static GitHub Pages preview, or a transient blip) the
 * helpers resolve to a safe "offline" shape instead of throwing, so the UI never
 * crashes and can fall back locally.
 */

export interface HealthInfo {
  bootId: string;
  startedAt: number;
}

export interface ConfigInfo {
  ai: { configured: boolean };
  database: { configured: boolean };
  storage: { dataDir: string };
}

/** Config used when the server can't be reached: nothing configured, all defaults. */
export const OFFLINE_CONFIG: ConfigInfo = {
  ai: { configured: false },
  database: { configured: false },
  storage: { dataDir: '' },
};

async function getJSON<T>(path: string, timeoutMs = 4000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, { signal: controller.signal });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the server boot id, or `null` when the server is unreachable. A null
 * result means "no server session to bind to" — the caller must NOT wipe state
 * in that case (we only wipe on a *confirmed* boot-id change).
 */
export async function fetchHealth(): Promise<HealthInfo | null> {
  try {
    return await getJSON<HealthInfo>('/api/health');
  } catch {
    return null;
  }
}

/** Returns server config, or the offline defaults when unreachable. */
export async function fetchConfig(): Promise<ConfigInfo> {
  try {
    return await getJSON<ConfigInfo>('/api/config');
  } catch {
    return OFFLINE_CONFIG;
  }
}

export interface AgentResponse {
  source: 'ai' | 'unavailable';
  output?: string;
  reason?: string;
}

/**
 * Asks the server to run an agent. Resolves to `{ source: 'unavailable' }` on any
 * failure so the caller can use a local fallback. Never throws.
 */
export async function requestAgent(stage: string, prompt: string): Promise<AgentResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22_000);
    const res = await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage, prompt }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { source: 'unavailable', reason: `http_${res.status}` };
    return (await res.json()) as AgentResponse;
  } catch {
    return { source: 'unavailable', reason: 'network' };
  }
}
