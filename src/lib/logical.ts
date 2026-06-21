import type {
  ConceptualModel,
  LogicalAttribute,
  LogicalEntity,
  LogicalModel,
  LogicalRelationship,
  ModelCardinality,
  ModelEntityType,
  Normalization,
} from '../store/types';
import { ENTITY_TYPES } from './model';

/**
 * Logical Data Model engine (spec 3.x, logical layer).
 *
 * Two ways a logical model is produced:
 *   1. The server-backed agent (AI) returns strict JSON, validated and repaired
 *      by `coerceLogicalModel` + `sanitizeLogicalModel` so a malformed payload
 *      can never crash the UI, leave a table without a primary key, or emit a
 *      dangling foreign key.
 *   2. A deterministic offline fallback (`localLogicalFallback`) that derives a
 *      valid 3NF model straight from the authoritative conceptual model — every
 *      entity gets a surrogate PK, relationships become real FKs, and N:N edges
 *      are resolved into bridge tables. Labelled "Offline-generated".
 */

const CARDINALITIES: ModelCardinality[] = ['1:1', '1:N', 'N:1', 'N:N'];

export const NORMALIZATIONS: Normalization[] = ['3NF', 'Dimensional (Kimball)', 'Hybrid'];

/** Platform-agnostic base types the logical layer is allowed to use. */
export const LOGICAL_BASE_TYPES = [
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'VARCHAR',
  'TEXT',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'BOOLEAN',
  'UUID',
] as const;

export function detectLogicalBump(revisionNote: string): 'minor' | 'major' {
  return /\bbreaking\b/i.test(revisionNote ?? '') ? 'major' : 'minor';
}

/** Title Case / PascalCase / camelCase → snake_case. */
export function toSnake(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

// --- defensive coercion of an AI/server payload ------------------------------

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

function asEntityType(v: unknown): ModelEntityType {
  return ENTITY_TYPES.includes(v as ModelEntityType) ? (v as ModelEntityType) : 'Dimension';
}

function asCardinality(v: unknown): ModelCardinality {
  return CARDINALITIES.includes(v as ModelCardinality) ? (v as ModelCardinality) : 'N:1';
}

function asNormalization(v: unknown): Normalization {
  return NORMALIZATIONS.includes(v as Normalization) ? (v as Normalization) : '3NF';
}

function coerceReference(v: unknown): { entity: string; attribute: string } | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const entity = asString(o.entity);
  const attribute = asString(o.attribute);
  if (!entity || !attribute) return null;
  return { entity, attribute };
}

function coerceAttribute(raw: Record<string, unknown>): LogicalAttribute {
  const isForeignKey = asBool(raw.isForeignKey ?? raw.is_foreign_key);
  const references = coerceReference(raw.references);
  return {
    name: asString(raw.name),
    dataType: asString(raw.dataType ?? raw.data_type, 'VARCHAR(255)'),
    nullable: asBool(raw.nullable, true),
    isPrimaryKey: asBool(raw.isPrimaryKey ?? raw.is_primary_key),
    isBusinessKey: asBool(raw.isBusinessKey ?? raw.is_business_key),
    isForeignKey: isForeignKey || references !== null,
    references,
    description: asString(raw.description),
  };
}

/** Validate/normalise an unknown payload into a LogicalModel (handles snake_case keys). */
export function coerceLogicalModel(raw: unknown): LogicalModel {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    name: asString(o.name, 'Logical Model'),
    domain: asString(o.domain),
    version: asString(o.version),
    overview: asString(o.overview),
    normalization: asNormalization(o.normalization),
    entities: asRecordArray(o.entities).map((e) => ({
      name: asString(e.name),
      type: asEntityType(e.type),
      description: asString(e.description),
      attributes: asRecordArray(e.attributes).map(coerceAttribute),
    })),
    relationships: asRecordArray(o.relationships).map((r) => ({
      from: asString(r.from),
      to: asString(r.to),
      fromAttribute: asString(r.fromAttribute ?? r.from_attribute),
      toAttribute: asString(r.toAttribute ?? r.to_attribute),
      cardinality: asCardinality(r.cardinality),
      identifying: asBool(r.identifying),
      label: asString(r.label),
    })),
  };
}

export interface LogicalValidation {
  ok: boolean;
  warnings: string[];
}

/**
 * Repair a logical model so it always renders and is structurally valid:
 *   - every entity has exactly one primary key (a surrogate is added if missing);
 *   - foreign keys that don't resolve to a real entity+attribute are demoted to
 *     plain columns and reported;
 *   - relationships with non-existent endpoints/attributes are dropped;
 *   - size and type sanity is reported as warnings.
 */
export function sanitizeLogicalModel(model: LogicalModel): {
  model: LogicalModel;
  validation: LogicalValidation;
} {
  const warnings: string[] = [];

  // De-duplicate and clean entities, guaranteeing one PK each.
  const seen = new Set<string>();
  const entities: LogicalEntity[] = [];
  for (const e of model.entities) {
    const name = e.name.trim();
    if (!name) continue;
    if (seen.has(name)) {
      warnings.push(`Duplicate entity "${name}" removed.`);
      continue;
    }
    seen.add(name);

    let attributes = e.attributes.filter((a) => a.name.trim());
    const pks = attributes.filter((a) => a.isPrimaryKey);
    if (pks.length === 0) {
      attributes = [
        {
          name: `${toSnake(name)}_id`,
          dataType: 'BIGINT',
          nullable: false,
          isPrimaryKey: true,
          isBusinessKey: false,
          isForeignKey: false,
          references: null,
          description: 'Surrogate primary key (standard — added to ensure a single PK).',
        },
        ...attributes,
      ];
      warnings.push(`Entity "${name}" had no primary key; a surrogate was added.`);
    } else if (pks.length > 1) {
      // Keep the first PK, demote the rest to business keys.
      let kept = false;
      attributes = attributes.map((a) => {
        if (!a.isPrimaryKey) return a;
        if (!kept) {
          kept = true;
          return a;
        }
        return { ...a, isPrimaryKey: false, isBusinessKey: true };
      });
      warnings.push(`Entity "${name}" had multiple primary keys; kept one, demoted the rest.`);
    }
    entities.push({ ...e, name, attributes });
  }

  // Build a lookup of valid entity → attribute names and each entity's PK.
  const attrIndex = new Map<string, Set<string>>();
  const pkOf = new Map<string, string>();
  for (const e of entities) {
    attrIndex.set(e.name, new Set(e.attributes.map((a) => a.name)));
    const pk = e.attributes.find((a) => a.isPrimaryKey);
    if (pk) pkOf.set(e.name, pk.name);
  }

  // Demote foreign keys that don't resolve.
  for (const e of entities) {
    for (const a of e.attributes) {
      if (!a.isForeignKey) continue;
      const ref = a.references;
      if (!ref || !attrIndex.get(ref.entity)?.has(ref.attribute)) {
        warnings.push(`FK "${e.name}.${a.name}" had no valid target; demoted to a plain column.`);
        a.isForeignKey = false;
        a.references = null;
      }
    }
  }

  // Keep only relationships whose endpoints (and attributes) exist.
  const relationships: LogicalRelationship[] = [];
  for (const r of model.relationships) {
    const from = r.from.trim();
    const to = r.to.trim();
    if (!attrIndex.has(from) || !attrIndex.has(to)) {
      warnings.push(`Relationship "${from} → ${to}" dropped (endpoint not an entity).`);
      continue;
    }
    if (r.cardinality === 'N:N') {
      warnings.push(`Relationship "${from} → ${to}" is N:N — resolve into a bridge table.`);
    }
    relationships.push({ ...r, from, to });
  }

  if (entities.length < 10) warnings.push(`Only ${entities.length} entities (aim for 10–25).`);
  if (entities.length > 25) warnings.push(`${entities.length} entities (aim for 10–25).`);
  if (relationships.length < 15)
    warnings.push(`Only ${relationships.length} relationships (aim for 15–40).`);

  return {
    model: { ...model, entities, relationships },
    validation: { ok: entities.length > 0, warnings },
  };
}

// --- offline, deterministic derivation from the conceptual model -------------

/** Infer a platform-agnostic type from a conceptual key-attribute name. */
function inferType(attr: string): { dataType: string; isBusinessKey: boolean } {
  const a = attr.toLowerCase();
  if (/identifier|number|\bnpi\b|\bid\b/.test(a)) return { dataType: 'VARCHAR(64)', isBusinessKey: true };
  if (/code/.test(a)) return { dataType: 'VARCHAR(32)', isBusinessKey: true };
  if (/(^|\b)(is|has|flag|active|enabled)\b/.test(a)) return { dataType: 'BOOLEAN', isBusinessKey: false };
  if (/timestamp|datetime|_ts\b|\bat\b|occurred/.test(a)) return { dataType: 'TIMESTAMP', isBusinessKey: false };
  if (/date/.test(a)) return { dataType: 'DATE', isBusinessKey: false };
  if (/time/.test(a)) return { dataType: 'TIME', isBusinessKey: false };
  if (/amount|cost|price|value|rate|total|balance/.test(a)) return { dataType: 'DECIMAL(12,2)', isBusinessKey: false };
  if (/count|quantity|qty|age/.test(a)) return { dataType: 'INTEGER', isBusinessKey: false };
  return { dataType: 'VARCHAR(255)', isBusinessKey: false };
}

function auditColumns(): LogicalAttribute[] {
  return [
    {
      name: 'created_ts',
      dataType: 'TIMESTAMP',
      nullable: false,
      isPrimaryKey: false,
      isBusinessKey: false,
      isForeignKey: false,
      references: null,
      description: 'Row creation time (standard audit column — not explicitly in BRD).',
    },
    {
      name: 'updated_ts',
      dataType: 'TIMESTAMP',
      nullable: true,
      isPrimaryKey: false,
      isBusinessKey: false,
      isForeignKey: false,
      references: null,
      description: 'Last update time (standard audit column — not explicitly in BRD).',
    },
  ];
}

/**
 * Derive a valid 3NF logical model directly from the conceptual model. Each
 * conceptual entity becomes a table with a surrogate PK and typed business
 * columns; conceptual relationships become real foreign keys (N:N resolved into
 * a bridge table). The result passes `sanitizeLogicalModel` by construction.
 */
export function deriveLogicalFromConceptual(
  conceptual: ConceptualModel,
  projectName: string,
  revisionNote: string,
): LogicalModel {
  const entityByName = new Map<string, LogicalEntity>();
  const order: string[] = [];

  function pkName(entity: string): string {
    return `${toSnake(entity)}_id`;
  }

  function ensureEntity(
    name: string,
    type: ModelEntityType,
    description: string,
    extraAttrs: LogicalAttribute[] = [],
  ): LogicalEntity {
    const existing = entityByName.get(name);
    if (existing) return existing;
    const entity: LogicalEntity = {
      name,
      type,
      description,
      attributes: [
        {
          name: pkName(name),
          dataType: 'BIGINT',
          nullable: false,
          isPrimaryKey: true,
          isBusinessKey: false,
          isForeignKey: false,
          references: null,
          description: `Surrogate primary key for ${name}.`,
        },
        ...extraAttrs,
        ...auditColumns(),
      ],
    };
    entityByName.set(name, entity);
    order.push(name);
    return entity;
  }

  // 1) One logical table per conceptual entity.
  for (const ce of conceptual.entities) {
    const cols: LogicalAttribute[] = ce.keyAttributes.map((ka) => {
      const { dataType, isBusinessKey } = inferType(ka);
      return {
        name: toSnake(ka),
        dataType,
        nullable: !isBusinessKey,
        isPrimaryKey: false,
        isBusinessKey,
        isForeignKey: false,
        references: null,
        description: ka,
      };
    });
    ensureEntity(ce.name, ce.type, ce.description, cols);
  }

  const relationships: LogicalRelationship[] = [];

  function addFk(childName: string, parentName: string, identifying: boolean, label: string) {
    const child = entityByName.get(childName);
    const parent = entityByName.get(parentName);
    if (!child || !parent) return;
    const fk = `${toSnake(parentName)}_id`;
    if (!child.attributes.some((a) => a.name === fk)) {
      // Insert FK right after the PK for readability.
      child.attributes.splice(1, 0, {
        name: fk,
        dataType: 'BIGINT',
        nullable: !identifying,
        isPrimaryKey: false,
        isBusinessKey: false,
        isForeignKey: true,
        references: { entity: parentName, attribute: pkName(parentName) },
        description: `References ${parentName}.`,
      });
    }
    relationships.push({
      from: childName,
      to: parentName,
      fromAttribute: fk,
      toAttribute: pkName(parentName),
      cardinality: 'N:1',
      identifying,
      label,
    });
  }

  // 2) Conceptual relationships → FKs (N:N becomes a bridge with two FKs).
  for (const r of conceptual.relationships) {
    if (!entityByName.has(r.from) || !entityByName.has(r.to)) continue;
    if (r.cardinality === 'N:N') {
      const bridgeName = `${r.from}${r.to}`;
      ensureEntity(
        bridgeName,
        'Bridge',
        `Associative table resolving the many-to-many between ${r.from} and ${r.to} (derived from standard model — not explicitly in BRD).`,
      );
      addFk(bridgeName, r.from, true, r.label);
      addFk(bridgeName, r.to, true, r.label);
      continue;
    }
    // Parent = the "one" side; child holds the FK.
    const parent = r.cardinality === 'N:1' ? r.to : r.from;
    const child = r.cardinality === 'N:1' ? r.from : r.to;
    addFk(child, parent, false, r.label);
  }

  // 3) Fold a revision note in as a grounded, visible change.
  const note = revisionNote?.trim();
  if (note) {
    const name = 'ReviewerAnnotation';
    if (!entityByName.has(name)) {
      ensureEntity(name, 'Reference', `Reviewer note applied: ${note}`, [
        {
          name: 'note',
          dataType: 'TEXT',
          nullable: false,
          isPrimaryKey: false,
          isBusinessKey: false,
          isForeignKey: false,
          references: null,
          description: note,
        },
      ]);
      if (order.length > 1) addFk(name, order[0], false, 'annotates');
    }
  }

  const entities = order.map((n) => entityByName.get(n)!);

  return {
    name: `${projectName || conceptual.name} Logical Model`,
    domain: conceptual.domain,
    version: '',
    overview:
      `Platform-agnostic 3NF logical model derived from the conceptual model. ` +
      `${conceptual.overview} Each business entity becomes a table with a surrogate primary key and ` +
      `typed columns, and every relationship is expressed as an explicit foreign key (many-to-many ` +
      `links are resolved into bridge tables).`,
    normalization: '3NF',
    entities,
    relationships,
  };
}

/** Offline fallback: a valid logical model with no AI, grounded in the conceptual model. */
export function localLogicalFallback(
  conceptual: ConceptualModel,
  projectName: string,
  revisionNote: string,
): LogicalModel {
  return deriveLogicalFromConceptual(conceptual, projectName, revisionNote);
}

/** Compact JSON digest of the conceptual model to ground the AI prompt. */
export function summarizeConceptual(model: ConceptualModel): string {
  return JSON.stringify(
    {
      name: model.name,
      domain: model.domain,
      overview: model.overview,
      entities: model.entities.map((e) => ({
        name: e.name,
        type: e.type,
        key_attributes: e.keyAttributes,
      })),
      relationships: model.relationships,
    },
    null,
    2,
  );
}
