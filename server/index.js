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
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, statSync, accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { brdToDocxBuffer } from './brdDocx.js';

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

// --- BRD Generator (spec 2.x) ------------------------------------------------

/** System prompt asking for strict JSON in the BRD document shape. */
const BRD_JSON_INSTRUCTIONS = `You are a senior business analyst. Produce a complete Business Requirements Document as STRICT JSON only — no prose, no markdown fences. Use exactly this shape:
{
  "executiveSummary": string,
  "businessObjectives": string[],
  "scope": { "inScope": string[], "outOfScope": string[] },
  "stakeholders": [{ "name": string, "role": string, "responsibility": string }],
  "functionalRequirements": [{ "id": string, "title": string, "description": string, "priority": string }],
  "nonFunctionalRequirements": [{ "category": string, "requirement": string, "target": string }],
  "dataModel": { "overview": string, "entities": [{ "name": string, "attributes": string[] }] },
  "integrations": [{ "system": string, "direction": string, "protocol": string, "description": string }],
  "assumptions": string[],
  "constraints": string[],
  "risks": [{ "risk": string, "impact": string, "likelihood": string, "mitigation": string }],
  "milestones": [{ "name": string, "targetDate": string, "deliverables": string[] }],
  "acceptanceCriteria": string[]
}`;

function parseJsonLoose(text) {
  if (typeof text !== 'string') return null;
  // Strip code fences if the model wrapped the JSON.
  const fenced = text.replace(/^```(?:json)?/i, '').replace(/```\s*$/i, '');
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Generate a structured BRD from the agent. Returns `{ source: 'ai', doc }` when
 * the AI service produced parseable JSON; otherwise `{ source: 'unavailable' }`
 * so the client falls back to its offline generator. Model name never leaks.
 */
app.post('/api/brd/generate', async (req, res) => {
  const { domain, requirement, comments } = req.body ?? {};
  if (typeof requirement !== 'string' || !requirement.trim()) {
    res.status(400).json({ error: 'requirement is required' });
    return;
  }

  if (!aiConfigured) {
    res.json({ source: 'unavailable', reason: 'not_configured' });
    return;
  }

  const commentLines = Object.entries(comments ?? {})
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const userPrompt = [
    `Domain: ${domain || 'general'}`,
    `Requirement:\n${requirement}`,
    commentLines ? `Reviewer comments to incorporate:\n${commentLines}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const upstream = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: BRD_JSON_INSTRUCTIONS },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      console.warn(`[brd] upstream returned ${upstream.status}`);
      res.json({ source: 'unavailable', reason: 'upstream_error' });
      return;
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const doc = parseJsonLoose(content);
    if (!doc) {
      res.json({ source: 'unavailable', reason: 'unparseable' });
      return;
    }
    res.json({ source: 'ai', doc });
  } catch (err) {
    console.warn(`[brd] request failed: ${err?.name ?? 'error'}`);
    res.json({ source: 'unavailable', reason: 'request_failed' });
  }
});

// --- Conceptual Data Modeler (spec 3.x) --------------------------------------

/** System prompt asking for a rigorous, grounded conceptual model as strict JSON. */
const MODEL_JSON_INSTRUCTIONS = `You are a Principal Data Modeler with 20+ years building conceptual, logical, and physical data models. Produce a RIGOROUS CONCEPTUAL DATA MODEL for the project described in the BRD below.

A conceptual model names business entities and relationships only — NO attributes-as-columns, NO physical types, NO table implementation. Stay at "what is this thing and how does it relate".

STRICT GROUNDING — NO HALLUCINATIONS:
1. Every entity must trace to the BRD (its data model, scope, objectives, KPIs, functional requirements, integrations, or stakeholders). Do not introduce entities the BRD doesn't mention or imply.
2. You MAY add industry-standard bridging entities (e.g. Order-Line, Encounter-Diagnosis) to connect the model; mark such an entity's description with "(derived from standard <domain> model — not explicitly in BRD)".
3. Use the domain's standard entity vocabulary (provided below) where it fits.
4. Relationships use cardinality "1:1" | "1:N" | "N:1" | "N:N" plus a short business label ("has", "submits", "covers", "diagnosed with").
5. Classify every entity as one of: Dimension | Fact | Bridge | Hierarchy | Reference | Event.
6. 3–7 conceptual key attributes per entity — business identifiers/descriptors in Title Case (no snake_case, no types, no lengths).
7. No Bronze/Silver/Gold layers (physical concern). No real person/organization names, no sample rows.

SIZE: 8–15 entities (aim 10–12); 10–20 relationships; no orphan entities; a 2–4 sentence overview; 1–2 sentence entity descriptions.

Return ONLY this JSON object (no prose, no markdown fences):
{
  "name": string,
  "domain": string,
  "version": string,
  "overview": string,
  "entities": [{ "name": string, "type": "Dimension|Fact|Bridge|Hierarchy|Reference|Event", "description": string, "keyAttributes": string[] }],
  "relationships": [{ "from": string, "to": string, "cardinality": "1:1|1:N|N:1|N:N", "label": string }]
}
Every relationship "from"/"to" MUST match an entity "name" exactly (validated downstream).`;

/**
 * Generate a conceptual data model from the agent. Returns `{ source: 'ai', doc }`
 * when the AI service produced parseable JSON; otherwise `{ source: 'unavailable' }`
 * so the client falls back to its offline, domain-aware generator.
 */
app.post('/api/model/generate', async (req, res) => {
  const { domainLabel, projectName, brdText, vocabularyHint, revisionNote } = req.body ?? {};
  if (typeof brdText !== 'string' || !brdText.trim()) {
    res.status(400).json({ error: 'brdText is required' });
    return;
  }

  if (!aiConfigured) {
    res.json({ source: 'unavailable', reason: 'not_configured' });
    return;
  }

  const vocab = Array.isArray(vocabularyHint)
    ? vocabularyHint.filter((v) => typeof v === 'string').join(', ')
    : '';

  const userPrompt = [
    `Domain: ${domainLabel || 'General'}`,
    projectName ? `Project name: ${projectName}` : '',
    vocab ? `Standard ${domainLabel || ''} entity vocabulary to draw on: ${vocab}` : '',
    `BRD (ground every entity in this):\n${brdText}`,
    typeof revisionNote === 'string' && revisionNote.trim()
      ? `Reviewer revision request to incorporate:\n${revisionNote}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const upstream = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: MODEL_JSON_INSTRUCTIONS },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      console.warn(`[model] upstream returned ${upstream.status}`);
      res.json({ source: 'unavailable', reason: 'upstream_error' });
      return;
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const doc = parseJsonLoose(content);
    if (!doc) {
      res.json({ source: 'unavailable', reason: 'unparseable' });
      return;
    }
    res.json({ source: 'ai', doc });
  } catch (err) {
    console.warn(`[model] request failed: ${err?.name ?? 'error'}`);
    res.json({ source: 'unavailable', reason: 'request_failed' });
  }
});

/** Expand a leading "~" to the user's home directory. */
function expandHome(p) {
  if (typeof p !== 'string' || !p) return '';
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(homedir(), p.slice(2));
  return p;
}

/**
 * Build the .docx, write it into the chosen output folder (creating it when
 * asked), and stream it back as a download. A bad/unwritable folder returns a
 * 400 with `{ error: 'folder' }` so the client can show a friendly banner
 * instead of crashing (spec 2.9).
 */
app.post('/api/brd/docx', async (req, res) => {
  const { doc, meta, fileName, outputFolder, createFolder } = req.body ?? {};
  if (!doc || typeof doc !== 'object') {
    res.status(400).json({ error: 'doc is required' });
    return;
  }

  const safeName =
    typeof fileName === 'string' && /\.docx$/i.test(fileName) ? fileName : 'BRD.docx';

  // Resolve the requested folder; fall back to the server data dir.
  let folder = expandHome(typeof outputFolder === 'string' ? outputFolder.trim() : '');
  if (!folder) folder = config.dataDir;
  folder = isAbsolute(folder) ? folder : resolve(process.cwd(), folder);

  let savedPath = '';
  try {
    if (!existsSync(folder)) {
      if (createFolder) {
        mkdirSync(folder, { recursive: true });
      } else {
        res.status(400).json({ error: 'folder', message: 'Folder does not exist.' });
        return;
      }
    } else if (!statSync(folder).isDirectory()) {
      res.status(400).json({ error: 'folder', message: 'Path is not a folder.' });
      return;
    }
    accessSync(folder, constants.W_OK);
    savedPath = join(folder, safeName);
  } catch {
    res.status(400).json({ error: 'folder', message: 'Folder is not writable.' });
    return;
  }

  try {
    const buffer = await brdToDocxBuffer(doc, meta ?? {});
    writeFileSync(savedPath, buffer);
    res.setHeader(
      'content-type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('content-disposition', `attachment; filename="${safeName}"`);
    res.setHeader('x-saved-path', savedPath);
    res.send(buffer);
  } catch (err) {
    console.warn(`[brd] docx build/write failed: ${err?.name ?? 'error'}`);
    res.status(500).json({ error: 'docx', message: 'Could not generate the document.' });
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
