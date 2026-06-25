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

// --- Logical Data Modeler (spec 3.x, logical layer) --------------------------

/** System prompt asking for a rigorous, platform-agnostic logical model as strict JSON. */
const LOGICAL_JSON_INSTRUCTIONS = `You are a Principal Data Modeler with 20+ years across multiple industries. You know Kimball dimensional and Inmon 3NF cold; you default to 3NF for the logical layer and note where dimensional patterns fit better.

Produce a RIGOROUS LOGICAL DATA MODEL from the BRD + the attached Conceptual Model. Name entities, typed attributes, and explicit PK/FK relationships — but PLATFORM-AGNOSTIC (no VARIANT/STRUCT/GEOGRAPHY, no partitioning/clustering).

STRICT GROUNDING. Inputs: BRD FULL TEXT + CONCEPTUAL MODEL (authoritative entity set).
1. EVERY conceptual entity appears in the logical model; you may split one conceptual entity into multiple 3NF tables (e.g. Patient → Patient, Patient_Address, Patient_Insurance) but never drop/rename without a counterpart.
2. Attributes/types/relationships trace to the BRD body or the Conceptual key attributes. Standard audit columns allowed, marked "(standard audit column — not explicitly in BRD)".
3. Platform-agnostic types ONLY: INTEGER, BIGINT, DECIMAL(p,s), VARCHAR(n), TEXT, DATE, TIME, TIMESTAMP, BOOLEAN, UUID. No NUMBER/NVARCHAR2/CLOB/STRUCT/VARIANT/GEOGRAPHY.
4. Every table has exactly ONE primary key (surrogate <table_snake>_id BIGINT by default); flag natural keys with is_business_key:true.
5. Every foreign key references a real attribute in another table — no dangling FKs.
6. Domain-appropriate attribute naming; snake_case attributes, PascalCase entities.
7. NO Bronze/Silver/Gold layers here.

ENTITY TYPES: Dimension|Fact|Bridge|Hierarchy|Reference|Event. Relationships: cardinality 1:1|1:N|N:1|N:N + identifying:true/false. For N:N create a Bridge table and emit two 1:N edges (never a direct N:N). Every FK column has a matching relationship with concrete from_attribute/to_attribute.

SIZE: 10–25 entities (1.5–2x conceptual for 3NF splits/bridges); 5–15 attributes each; 15–40 relationships; no orphans (lookups may stand alone); 2–4 sentence overview.

Return ONLY this JSON object (no prose, no markdown fences):
{ "name", "domain", "version", "overview", "normalization":"3NF|Dimensional (Kimball)|Hybrid",
  "entities":[{"name","type","description",
    "attributes":[{"name","data_type","nullable","is_primary_key","is_business_key","is_foreign_key",
                   "references":{"entity","attribute"}|null,"description"}]}],
  "relationships":[{"from","to","from_attribute","to_attribute","cardinality","identifying","label"}] }
Every relationship from/to MUST match an entity name exactly, and every from_attribute/to_attribute MUST match a real attribute (validated downstream).`;

/**
 * Generate a logical data model from the agent (same AI config as the BRD +
 * conceptual endpoints). Returns `{ source: 'ai', doc }` when the AI produced
 * parseable JSON; otherwise `{ source: 'unavailable' }` so the client falls back
 * to its offline derivation from the conceptual model.
 */
app.post('/api/logical/generate', async (req, res) => {
  const { domainLabel, projectName, brdText, conceptualModel, revisionNote } = req.body ?? {};
  if (typeof conceptualModel !== 'string' || !conceptualModel.trim()) {
    res.status(400).json({ error: 'conceptualModel is required' });
    return;
  }

  if (!aiConfigured) {
    res.json({ source: 'unavailable', reason: 'not_configured' });
    return;
  }

  const userPrompt = [
    `Domain: ${domainLabel || 'General'}`,
    projectName ? `Project name: ${projectName}` : '',
    typeof brdText === 'string' && brdText.trim() ? `BRD:\n${brdText}` : '',
    `Conceptual model (authoritative entity set):\n${conceptualModel}`,
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
          { role: 'system', content: LOGICAL_JSON_INSTRUCTIONS },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      console.warn(`[logical] upstream returned ${upstream.status}`);
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
    console.warn(`[logical] request failed: ${err?.name ?? 'error'}`);
    res.json({ source: 'unavailable', reason: 'request_failed' });
  }
});

// --- Physical Model / DDL (spec 2.3) -----------------------------------------

const PHYSICAL_JSON_INSTRUCTIONS = `You are a Principal Data Modeler AND Platform Engineer with 20+ years across Snowflake, Databricks (Delta Lake), Amazon Redshift, Google BigQuery, and Azure Synapse — you know each dialect, partitioning/clustering model, and type system cold.

Produce a RIGOROUS PHYSICAL DATA MODEL from the BRD + Logical Model: runnable CREATE TABLE DDL for the target platform with concrete types, NOT NULL/PK/FK constraints, partition/cluster/distribution hints, and comments tracing back to the logical entity. TWO LAYERS (Medallion):
  SILVER : cleansed, conformed, source-aligned (~1:1 with logical entities + audit cols + DQ via NOT NULL/CHECK + platform-native types). The single source of truth.
  GOLD   : dimensional star/snowflake from Silver — dim_* / fact_* / bridge_* ; SCD Type 2 where history matters.

1. EVERY logical entity appears in SILVER (silver_<entity_snake>; may add _hist tables, never drop an entity).
2. GOLD dimensional: descriptive→dim_*, event/transaction→fact_*, N:N→bridge_*, history→SCD2 (<dim>_sk + effective_start_date/effective_end_date/current_flag).
3. Every table: surrogate PK using the platform's monotonic-id type; Silver audit cols ingestion_ts/source_system/record_hash; NOT NULL on PK/FK/business keys; explicit FOREIGN KEY constraints.
4. Platform-specific DDL dialect — emit valid, pasteable CREATE TABLE for the requested platform.

Return ONLY this JSON object (no prose, no markdown fences):
{ "name", "domain", "platform", "version", "overview",
  "silver":[{"name","logical_entity","table_type","description","columns":[{"name","data_type","nullable","is_primary_key","is_foreign_key","references":{"entity","attribute"}|null,"description","tags":[]}],"ddl":"CREATE TABLE ..."}],
  "gold":[...same shape...] }`;

app.post('/api/physical/generate', async (req, res) => {
  const { domainLabel, projectName, brdText, logicalModel, platform, revisionNote } = req.body ?? {};
  if (typeof logicalModel !== 'string' || !logicalModel.trim()) {
    res.status(400).json({ error: 'logicalModel is required' });
    return;
  }
  if (!aiConfigured) {
    res.json({ source: 'unavailable', reason: 'not_configured' });
    return;
  }

  const userPrompt = [
    `Domain: ${domainLabel || 'General'}`,
    `Target platform: ${platform || 'Snowflake'}`,
    projectName ? `Project name: ${projectName}` : '',
    typeof brdText === 'string' && brdText.trim() ? `BRD:\n${brdText}` : '',
    `Logical model:\n${logicalModel}`,
    typeof revisionNote === 'string' && revisionNote.trim()
      ? `Revision request:\n${revisionNote}`
      : '',
  ].filter(Boolean).join('\n\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const upstream = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.ai.apiKey}` },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: PHYSICAL_JSON_INSTRUCTIONS },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!upstream.ok) { res.json({ source: 'unavailable', reason: 'upstream_error' }); return; }
    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const doc = parseJsonLoose(content);
    if (!doc) { res.json({ source: 'unavailable', reason: 'unparseable' }); return; }
    res.json({ source: 'ai', doc });
  } catch (err) {
    console.warn(`[physical] request failed: ${err?.name ?? 'error'}`);
    res.json({ source: 'unavailable', reason: 'request_failed' });
  }
});

// --- Code Gen (spec 3) -------------------------------------------------------

const CODEGEN_INSTRUCTIONS = `You are a Senior ETL Engineer with 15+ years on Snowflake, Databricks (Delta Lake/DLT), Amazon Redshift, Google BigQuery, Azure Synapse, AWS Glue. You ship pipeline code juniors can read, reviewers can approve, and on-call can debug at 2am. You write idiomatic code per platform.

STRICT OUTPUT RULES:
1. Output ONLY the runnable code file body. No markdown fences, no preamble.
2. Begin with a banner comment: flow name, target platform+language, source/target tables, load strategy, idempotency instructions.
3. Every transformation/MERGE/UPSERT block is preceded by a comment citing the business rule and the DQ rule. Comment density is a requirement.
4. Runnable with minimal edits: parameterise via a labelled config block.
5. Implement every target column — no gaps. Surrogate keys via IDENTITY/SEQUENCE/ROW_NUMBER; SCD Type 2 via standard mechanics.
6. DQ rules become real checks: SQL CHECK constraints or INSERT…WHERE guards.

Produce production-grade, idiomatic, fully-commented code for the requested stage, platform, and language only.`;

app.post('/api/codegen/generate', async (req, res) => {
  const { stage, platform, language, physicalModel, revisionNote } = req.body ?? {};
  if (typeof physicalModel !== 'string' || !physicalModel.trim()) {
    res.status(400).json({ error: 'physicalModel is required' });
    return;
  }
  if (!aiConfigured) {
    res.json({ source: 'unavailable', reason: 'not_configured' });
    return;
  }

  const userPrompt = [
    `Stage: ${stage || 'bronze-to-silver'}`,
    `Platform: ${platform || 'Snowflake'}`,
    `Language: ${language || 'SQL'}`,
    `Physical model:\n${physicalModel}`,
    typeof revisionNote === 'string' && revisionNote.trim() ? `Notes:\n${revisionNote}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const upstream = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.ai.apiKey}` },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: CODEGEN_INSTRUCTIONS },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!upstream.ok) { res.json({ source: 'unavailable', reason: 'upstream_error' }); return; }
    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) { res.json({ source: 'unavailable', reason: 'empty' }); return; }
    // Strip markdown fences if present
    const code = content.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
    res.json({ source: 'ai', code });
  } catch (err) {
    console.warn(`[codegen] request failed: ${err?.name ?? 'error'}`);
    res.json({ source: 'unavailable', reason: 'request_failed' });
  }
});

// --- Viz Gen / Dashboard Design (spec 6) ------------------------------------

const VIZ_JSON_INSTRUCTIONS = `You are a Principal Data Visualization Architect. You design dashboard specifications from physical data models.

Given the physical model (Silver + Gold tables with their columns), produce a dashboard specification with KPI cards and visualization widgets.

Return ONLY this JSON object:
{ "name", "domain", "version", "overview", "layout":"single|grid|narrative",
  "widgets":[{"id","type":"kpi|bar|line|area|pie|table|scatter",
    "title","description","data_source","config":"..."}] }

Rules:
1. 3-5 KPI cards showing key metrics from fact tables.
2. 3-5 chart widgets (mix of bar, line, pie, table) grounded in the Gold layer tables.
3. Each widget's data_source must reference a real table from the physical model.
4. config is a JSON string with chart-specific settings (x, y, aggregation, etc.).
5. Overview: 2-3 sentences describing the dashboard's purpose.`;

app.post('/api/viz/generate', async (req, res) => {
  const { domain, projectName, physicalModel, revisionNote } = req.body ?? {};
  if (typeof physicalModel !== 'string' || !physicalModel.trim()) {
    res.status(400).json({ error: 'physicalModel is required' });
    return;
  }
  if (!aiConfigured) {
    res.json({ source: 'unavailable', reason: 'not_configured' });
    return;
  }

  const userPrompt = [
    `Domain: ${domain || 'General'}`,
    projectName ? `Project: ${projectName}` : '',
    `Physical model:\n${physicalModel}`,
    typeof revisionNote === 'string' && revisionNote.trim() ? `Notes:\n${revisionNote}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const upstream = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.ai.apiKey}` },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: VIZ_JSON_INSTRUCTIONS },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!upstream.ok) { res.json({ source: 'unavailable', reason: 'upstream_error' }); return; }
    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const doc = parseJsonLoose(content);
    if (!doc) { res.json({ source: 'unavailable', reason: 'unparseable' }); return; }
    res.json({ source: 'ai', doc });
  } catch (err) {
    console.warn(`[viz] request failed: ${err?.name ?? 'error'}`);
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
