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

// --- BRD Generator (spec 2.x) ------------------------------------------------

export interface BrdGeneratePayload {
  domain: string;
  requirement: string;
  comments: Record<string, string>;
}

export interface BrdGenerateResponse {
  source: 'ai' | 'unavailable';
  /** Raw, unvalidated document; the caller coerces it into a BrdDocument. */
  doc?: unknown;
  reason?: string;
}

/**
 * Ask the server to generate a structured BRD. Resolves to
 * `{ source: 'unavailable' }` on any failure so the caller can fall back to the
 * offline generator. Never throws.
 */
export async function requestBrd(payload: BrdGeneratePayload): Promise<BrdGenerateResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 32_000);
    const res = await fetch('/api/brd/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { source: 'unavailable', reason: `http_${res.status}` };
    return (await res.json()) as BrdGenerateResponse;
  } catch {
    return { source: 'unavailable', reason: 'network' };
  }
}

// --- Conceptual Data Modeler (spec 3.x) --------------------------------------

export interface ModelGeneratePayload {
  domain: string;
  /** Domain label shown in the model (e.g. "Healthcare"). */
  domainLabel: string;
  projectName: string;
  /** A digest of the BRD the model must be grounded in. */
  brdText: string;
  /** Standard entity vocabulary for the domain, to steer the agent. */
  vocabularyHint: string[];
  revisionNote: string;
}

export interface ModelGenerateResponse {
  source: 'ai' | 'unavailable';
  /** Raw, unvalidated model; the caller coerces it into a ConceptualModel. */
  doc?: unknown;
  reason?: string;
}

/**
 * Ask the server to generate a conceptual data model. Resolves to
 * `{ source: 'unavailable' }` on any failure so the caller can fall back to the
 * offline generator. Never throws.
 */
export async function requestModel(
  payload: ModelGeneratePayload,
): Promise<ModelGenerateResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 32_000);
    const res = await fetch('/api/model/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { source: 'unavailable', reason: `http_${res.status}` };
    return (await res.json()) as ModelGenerateResponse;
  } catch {
    return { source: 'unavailable', reason: 'network' };
  }
}

export interface DocxPayload {
  doc: unknown;
  meta: Record<string, unknown>;
  fileName: string;
  outputFolder: string;
  createFolder: boolean;
}

export type DocxResult =
  | { status: 'ok'; blob: Blob; savedPath: string | null }
  | { status: 'folder_error'; message: string }
  | { status: 'server_unavailable' }
  | { status: 'error'; message: string };

/**
 * Ask the server to build the .docx, save it to the chosen folder, and return
 * the file bytes. Distinguishes a friendly folder problem (so the UI can warn)
 * from the server simply being unreachable (so the UI can build the file
 * client-side as an offline fallback).
 */
export async function downloadDocxOnServer(payload: DocxPayload): Promise<DocxResult> {
  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    res = await fetch('/api/brd/docx', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    return { status: 'server_unavailable' };
  }

  if (res.ok) {
    const blob = await res.blob();
    return { status: 'ok', blob, savedPath: res.headers.get('x-saved-path') };
  }
  // A 400 with a folder error is a friendly, expected case (spec 2.9).
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body.error === 'folder') {
      return { status: 'folder_error', message: body.message ?? 'Folder is not usable.' };
    }
    return { status: 'error', message: body.message ?? `Server error (${res.status}).` };
  } catch {
    return { status: 'error', message: `Server error (${res.status}).` };
  }
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
