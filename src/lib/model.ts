import type {
  BrdDocument,
  ConceptualModel,
  ModelCardinality,
  ModelEntity,
  ModelEntityType,
  ModelRelationship,
  ModelState,
} from '../store/types';
import { domainById } from '../config/domains';

/**
 * Conceptual Data Model engine (spec 3.x).
 *
 * Two ways a model is produced:
 *   1. The server-backed agent (AI) returns strict JSON, validated and repaired
 *      by `coerceConceptualModel` + `sanitizeModel` so a malformed or
 *      hallucinated payload can never crash the UI or leave dangling edges.
 *   2. A deterministic, domain-aware offline fallback (`localModelFallback`)
 *      that always produces a complete, grounded model with no AI at all. The
 *      result is labelled "Offline-generated".
 */

export const ENTITY_TYPES: ModelEntityType[] = [
  'Dimension',
  'Fact',
  'Bridge',
  'Hierarchy',
  'Reference',
  'Event',
];

const CARDINALITIES: ModelCardinality[] = ['1:1', '1:N', 'N:1', 'N:N'];

/** Tailwind classes for each entity type's badge — keeps the diagram + cards consistent. */
export const ENTITY_TYPE_STYLE: Record<ModelEntityType, { badge: string; node: string; dot: string }> =
  {
    Dimension: {
      badge: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200',
      node: '#6366f1',
      dot: 'bg-brand-500',
    },
    Fact: {
      badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
      node: '#10b981',
      dot: 'bg-emerald-500',
    },
    Bridge: {
      badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
      node: '#f59e0b',
      dot: 'bg-amber-500',
    },
    Hierarchy: {
      badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200',
      node: '#8b5cf6',
      dot: 'bg-violet-500',
    },
    Reference: {
      badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200',
      node: '#0ea5e9',
      dot: 'bg-sky-500',
    },
    Event: {
      badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
      node: '#f43f5e',
      dot: 'bg-rose-500',
    },
  };

/**
 * A regenerate is a "breaking" (major) bump when the revision note uses the word
 * "breaking" (mirrors the BRD rule); otherwise it's a normal minor bump.
 */
export function detectModelBump(revisionNote: string): 'minor' | 'major' {
  return /\bbreaking\b/i.test(revisionNote ?? '') ? 'major' : 'minor';
}

// --- defensive coercion of an AI/server payload ------------------------------

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

function asEntityType(v: unknown): ModelEntityType {
  return ENTITY_TYPES.includes(v as ModelEntityType) ? (v as ModelEntityType) : 'Dimension';
}

function asCardinality(v: unknown): ModelCardinality {
  return CARDINALITIES.includes(v as ModelCardinality) ? (v as ModelCardinality) : '1:N';
}

/**
 * Validate/normalise an unknown payload (e.g. from the AI service) into a
 * ConceptualModel. Missing or malformed fields fall back to safe values so
 * rendering never throws. Use `sanitizeModel` afterwards to drop dangling edges.
 */
export function coerceConceptualModel(raw: unknown): ConceptualModel {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    name: asString(o.name, 'Conceptual Model'),
    domain: asString(o.domain),
    version: asString(o.version),
    overview: asString(o.overview),
    entities: asRecordArray(o.entities).map((e) => ({
      name: asString(e.name),
      type: asEntityType(e.type),
      description: asString(e.description),
      keyAttributes: asStringArray(e.keyAttributes ?? e.key_attributes),
    })),
    relationships: asRecordArray(o.relationships).map((r) => ({
      from: asString(r.from),
      to: asString(r.to),
      cardinality: asCardinality(r.cardinality),
      label: asString(r.label),
    })),
  };
}

export interface ModelValidation {
  /** True when the model is well-formed enough to render confidently. */
  ok: boolean;
  warnings: string[];
}

/**
 * Drop empty/duplicate entities and any relationship whose `from`/`to` does not
 * match an entity name exactly (the spec's downstream validation), and report
 * what was removed so the UI can surface it.
 */
export function sanitizeModel(model: ConceptualModel): {
  model: ConceptualModel;
  validation: ModelValidation;
} {
  const warnings: string[] = [];

  // De-duplicate and drop unnamed entities.
  const seen = new Set<string>();
  const entities: ModelEntity[] = [];
  for (const e of model.entities) {
    const name = e.name.trim();
    if (!name) continue;
    if (seen.has(name)) {
      warnings.push(`Duplicate entity "${name}" removed.`);
      continue;
    }
    seen.add(name);
    entities.push({ ...e, name });
  }

  // Keep only relationships whose endpoints both exist.
  const names = new Set(entities.map((e) => e.name));
  const relationships: ModelRelationship[] = [];
  for (const r of model.relationships) {
    const from = r.from.trim();
    const to = r.to.trim();
    if (!names.has(from) || !names.has(to)) {
      warnings.push(`Relationship "${from} → ${to}" dropped (endpoint not an entity).`);
      continue;
    }
    relationships.push({ ...r, from, to });
  }

  // Flag orphans (entities with no relationship).
  const connected = new Set<string>();
  relationships.forEach((r) => {
    connected.add(r.from);
    connected.add(r.to);
  });
  const orphans = entities.filter((e) => !connected.has(e.name)).map((e) => e.name);
  if (orphans.length) warnings.push(`Orphan entities with no relationships: ${orphans.join(', ')}.`);

  if (entities.length < 8) warnings.push(`Only ${entities.length} entities (aim for 8–15).`);
  if (entities.length > 15) warnings.push(`${entities.length} entities (aim for 8–15).`);
  if (relationships.length < 10)
    warnings.push(`Only ${relationships.length} relationships (aim for 10–20).`);

  return {
    model: { ...model, entities, relationships },
    validation: { ok: entities.length > 0 && relationships.length > 0, warnings },
  };
}

// --- offline, deterministic fallback -----------------------------------------

function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const match = trimmed.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

/** Build a short text digest of the BRD to ground the model (offline + AI input). */
export function summarizeBrd(brd: { requirement: string }, latest?: BrdDocument | null): string {
  if (latest) {
    const lines = [
      latest.executiveSummary,
      latest.businessObjectives.length
        ? `Objectives: ${latest.businessObjectives.join('; ')}`
        : '',
      latest.scope.inScope.length ? `In scope: ${latest.scope.inScope.join('; ')}` : '',
      latest.dataModel.overview ? `Data model: ${latest.dataModel.overview}` : '',
      latest.dataModel.entities.length
        ? `BRD entities: ${latest.dataModel.entities.map((e) => e.name).join(', ')}`
        : '',
    ].filter(Boolean);
    if (lines.length) return lines.join('\n');
  }
  return brd.requirement ?? '';
}

/**
 * Build a complete, domain-aware conceptual model with no AI. Seeds come from the
 * domain's standard vocabulary; the revision note is folded in as a Reference
 * entity so a regenerate produces a visible, grounded change.
 */
export function localModelFallback(model: ModelState, projectName: string): ConceptualModel {
  const domain = domainById(model.domain);
  const seed = domain?.modelSeed;
  const domainLabel = domain?.label ?? 'General';

  const entities: ModelEntity[] = seed
    ? seed.entities.map((e) => ({ ...e, keyAttributes: [...e.keyAttributes] }))
    : [
        {
          name: 'Entity',
          type: 'Dimension',
          description: 'A core business entity.',
          keyAttributes: ['Entity Identifier', 'Name', 'Status'],
        },
        {
          name: 'Event',
          type: 'Event',
          description: 'A business event involving an entity.',
          keyAttributes: ['Event Identifier', 'Type', 'Occurred At'],
        },
        {
          name: 'Reference',
          type: 'Reference',
          description: 'A controlled reference / lookup.',
          keyAttributes: ['Code', 'Label', 'Category'],
        },
      ];
  const relationships: ModelRelationship[] = seed
    ? seed.relationships.map((r) => ({ ...r }))
    : [
        { from: 'Entity', to: 'Event', cardinality: '1:N', label: 'has' },
        { from: 'Event', to: 'Reference', cardinality: 'N:1', label: 'classified as' },
      ];

  const note = model.revisionNote?.trim();
  if (note) {
    const reviewerEntity = 'Reviewer Annotation';
    if (!entities.some((e) => e.name === reviewerEntity)) {
      entities.push({
        name: reviewerEntity,
        type: 'Reference',
        description: `Reviewer note applied: ${note}`,
        keyAttributes: ['Annotation Identifier', 'Note', 'Raised At'],
      });
      relationships.push({
        from: entities[0].name,
        to: reviewerEntity,
        cardinality: '1:N',
        label: 'annotated by',
      });
    }
  }

  const intent =
    firstSentence(seed?.overview ?? '') ||
    `A conceptual data model for ${projectName || domainLabel}.`;

  return {
    name: `${projectName || domainLabel} Conceptual Model`,
    domain: domainLabel,
    version: '',
    overview:
      seed?.overview ??
      `${intent} It names the core business entities and their relationships at the conceptual ` +
        'level, with no physical or column-level detail.',
    entities,
    relationships,
  };
}
