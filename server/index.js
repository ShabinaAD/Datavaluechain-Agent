// @ts-nocheck
/**
 * Data Value Chain Agent Foundry — application server.
 *
 * Responsibilities (spec 1.7, 1.9, 1.10, 1.11):
 *   - Expose a per-process boot id so the client can implement the
 *     "state survives refresh & reopen, but dies when the server restarts" rule.
 *   - Read all external configuration from environment variables, with working
 *     defaults so the app boots even when nothing is configured.
 *   - Proxy AI requests so service keys stay server-side and the underlying
 *     model/vendor name is never exposed to the client or its logs.
 *   - Report connection status for AI and the database so the UI can show a
 *     "Connect first" message instead of crashing.
 *   - Serve the built SPA in production.
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// A new id every time the process starts. This is the *only* signal the client
// uses to decide whether to wipe persisted work, so it must change on restart.
const BOOT_ID = randomUUID();
const STARTED_AT = Date.now();

const PORT = Number(process.env.PORT) || 8787;

// --- configuration (all optional; everything has a working default) ----------
const config = {
  // Folder path for generated artifacts. Not a secret.
  dataDir: process.env.DATA_DIR || join(process.cwd(), 'data'),
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    // The model name is intentionally kept server-side only. It must never be
    // returned to the client or written to a client-visible log (spec 1.11).
    model: process.env.AI_MODEL || 'gpt-4o-mini',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
};

const aiConfigured = Boolean(config.ai.apiKey);
const dbConfigured = Boolean(config.database.url);

const app = express();
app.use(express.json({ limit: '2mb' }));

/** Liveness + the boot id that drives the wipe-on-restart behaviour. */
app.get('/api/health', (_req, res) => {
  res.json({ bootId: BOOT_ID, startedAt: STARTED_AT, uptimeMs: Date.now() - STARTED_AT });
});

/**
 * Safe, non-secret view of what's configured. Never returns keys, credentials,
 * or the AI model name.
 */
app.get('/api/config', (_req, res) => {
  res.json({
    ai: { configured: aiConfigured },
    database: { configured: dbConfigured },
    storage: { dataDir: config.dataDir },
  });
});

/**
 * Run a stage agent. Returns `{ source: 'ai', output }` when the AI service is
 * configured and reachable; otherwise `{ source: 'unavailable' }` so the client
 * can fall back locally and label the result accordingly. The model name is
 * never included in the response or the logs.
 */
app.post('/api/agent/run', async (req, res) => {
  const { stage, prompt } = req.body ?? {};
  if (typeof stage !== 'string' || typeof prompt !== 'string') {
    res.status(400).json({ error: 'stage and prompt are required' });
    return;
  }

  if (!aiConfigured) {
    res.json({ source: 'unavailable', reason: 'not_configured' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const upstream = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior data-and-analytics agent helping build a data value chain. Be concise and practical.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      // Do not surface upstream provider details to the client.
      console.warn(`[agent] upstream returned ${upstream.status} for stage "${stage}"`);
      res.json({ source: 'unavailable', reason: 'upstream_error' });
      return;
    }

    const data = await upstream.json();
    const output = data?.choices?.[0]?.message?.content ?? '';
    // Only the text is returned — never the model, usage, or provider metadata.
    res.json({ source: 'ai', output });
  } catch (err) {
    console.warn(`[agent] request failed for stage "${stage}": ${err?.name ?? 'error'}`);
    res.json({ source: 'unavailable', reason: 'request_failed' });
  }
});

// --- static SPA (production) --------------------------------------------------
const distDir = join(__dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: any non-API route returns index.html so deep links work.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] boot id ${BOOT_ID}`);
  console.log(`[server] ai ${aiConfigured ? 'configured' : 'not configured (offline fallback)'}`);
  console.log(`[server] database ${dbConfigured ? 'configured' : 'not configured (connect first)'}`);
});
