/**
 * Domain model for the Data Value Chain Agent Foundry.
 *
 * The workflow moves a project from raw business intent all the way to a
 * published dashboard. Each "stage" is owned by an AI agent. The shape here is
 * intentionally generous so individual features can extend it later without a
 * breaking persistence migration.
 */

export type StageId =
  | 'requirements'
  | 'sources'
  | 'engineering'
  | 'modeling'
  | 'dashboard'
  | 'publish';

export type StageStatus = 'not_started' | 'in_progress' | 'review' | 'complete';

export interface BusinessRequirements {
  objective: string;
  audience: string;
  keyQuestions: string;
  successMetrics: string;
}

export interface DataSource {
  id: string;
  name: string;
  kind: 'warehouse' | 'database' | 'api' | 'file' | 'stream';
  connection: string;
  notes: string;
}

export interface EngineeringPlan {
  ingestion: string;
  pipeline: string;
  schedule: string;
  quality: string;
}

export interface ModelingPlan {
  grain: string;
  dimensions: string;
  measures: string;
  transformations: string;
}

export interface DashboardPlan {
  title: string;
  layout: 'single' | 'grid' | 'narrative';
  widgets: string;
  notes: string;
}

export interface StageMeta {
  status: StageStatus;
  /** Free-form notes the owning agent / user leaves on the stage. */
  notes: string;
}

/** Where a generated result came from. */
export type ResultSource = 'ai' | 'fallback';

/**
 * A persisted agent result. Stored on the project so that "every result the AI
 * produced is still on screen after a refresh" (spec 1.7).
 */
export interface StageResult {
  output: string;
  source: ResultSource;
  at: number;
}

/**
 * --- BRD Generator (spec 2.x) ------------------------------------------------
 * The first feature tab. A structured Business Requirements Document is built
 * by the agent, revised through per-section reviewer comments, versioned, and
 * exported to .docx. Everything except the uploaded files is persisted so the
 * whole workspace survives a refresh (spec 2.8.3).
 */

/** Ordered, named sections of the rendered BRD (spec 2.6.2). */
export type BrdSectionId =
  | 'executiveSummary'
  | 'businessObjectives'
  | 'scope'
  | 'stakeholders'
  | 'functionalRequirements'
  | 'nonFunctionalRequirements'
  | 'dataModel'
  | 'integrations'
  | 'assumptionsConstraints'
  | 'risks'
  | 'timeline'
  | 'acceptanceCriteria';

export interface BrdStakeholder {
  name: string;
  role: string;
  responsibility: string;
}

export interface BrdFunctionalRequirement {
  id: string;
  title: string;
  description: string;
  priority: string;
}

export interface BrdNonFunctionalRequirement {
  category: string;
  requirement: string;
  target: string;
}

export interface BrdEntity {
  name: string;
  attributes: string[];
}

export interface BrdIntegration {
  system: string;
  direction: string;
  protocol: string;
  description: string;
}

export interface BrdRisk {
  risk: string;
  impact: string;
  likelihood: string;
  mitigation: string;
}

export interface BrdMilestone {
  name: string;
  targetDate: string;
  deliverables: string[];
}

/** The structured BRD content, one field per named section. */
export interface BrdDocument {
  executiveSummary: string;
  businessObjectives: string[];
  scope: { inScope: string[]; outOfScope: string[] };
  stakeholders: BrdStakeholder[];
  functionalRequirements: BrdFunctionalRequirement[];
  nonFunctionalRequirements: BrdNonFunctionalRequirement[];
  dataModel: { overview: string; entities: BrdEntity[] };
  integrations: BrdIntegration[];
  assumptions: string[];
  constraints: string[];
  risks: BrdRisk[];
  milestones: BrdMilestone[];
  acceptanceCriteria: string[];
}

/** A single generated revision, kept in history so any version can be revisited. */
export interface BrdVersion {
  /** Display label, e.g. "1.2". */
  label: string;
  major: number;
  minor: number;
  at: number;
  source: ResultSource;
  doc: BrdDocument;
}

/** All persisted BRD state for the tab (spec 2.8.3). */
export interface BrdState {
  domain: string;
  projectName: string;
  /** True once the user manually edits the name; stops domain auto-seed (2.8.2). */
  projectNameEdited: boolean;
  requirement: string;
  /** True once the user manually edits the requirement; stops domain auto-seed. */
  requirementEdited: boolean;
  outputFolder: string;
  createFolder: boolean;
  versions: BrdVersion[];
  /** Label of the version currently shown in the output column. */
  activeVersion: string | null;
  /** Per-section reviewer comments, keyed by section id (2.6.4). */
  comments: Partial<Record<BrdSectionId, string>>;
}

/**
 * --- Conceptual Data Modeler (spec 3.x) -------------------------------------
 * The second feature tab. The agent reads the generated BRD and produces a
 * RIGOROUS conceptual data model — business entities and their relationships,
 * with no physical/column detail — adapted to the project's domain. Everything
 * is versioned and persisted so the workspace survives a refresh.
 */

/** How an entity participates in the conceptual model. */
export type ModelEntityType =
  | 'Dimension'
  | 'Fact'
  | 'Bridge'
  | 'Hierarchy'
  | 'Reference'
  | 'Event';

/** Cardinality on a relationship between two entities. */
export type ModelCardinality = '1:1' | '1:N' | 'N:1' | 'N:N';

export interface ModelEntity {
  name: string;
  type: ModelEntityType;
  description: string;
  /** 3–7 conceptual key attributes in Title Case (no types/lengths). */
  keyAttributes: string[];
}

export interface ModelRelationship {
  /** Must match a `ModelEntity.name` exactly. */
  from: string;
  /** Must match a `ModelEntity.name` exactly. */
  to: string;
  cardinality: ModelCardinality;
  /** Short business label, e.g. "submits", "covers". */
  label: string;
}

/** A complete conceptual data model. */
export interface ConceptualModel {
  name: string;
  domain: string;
  version: string;
  overview: string;
  entities: ModelEntity[];
  relationships: ModelRelationship[];
}

/** A single generated revision of the model, kept in history. */
export interface ModelVersion {
  label: string;
  major: number;
  minor: number;
  at: number;
  source: ResultSource;
  doc: ConceptualModel;
}

/** All persisted Conceptual Data Modeler state for the tab. */
export interface ModelState {
  /** Domain used for vocabulary; defaults to the BRD domain, user-overridable. */
  domain: string;
  versions: ModelVersion[];
  /** Label of the version currently shown in the output column. */
  activeVersion: string | null;
  /** A free-form revision request fed into the next Regenerate. */
  revisionNote: string;
}

/**
 * --- Logical Data Modeler (spec 3.x, logical layer) -------------------------
 * Takes the BRD + the conceptual model and produces a RIGOROUS, platform-agnostic
 * logical model: typed attributes, explicit single-column PKs, and concrete
 * PK/FK relationships (N:N resolved into bridge tables). Versioned + persisted.
 */

/** Platform-agnostic logical data types. The `(p,s)`/`(n)` params live on the string. */
export type LogicalBaseType =
  | 'INTEGER'
  | 'BIGINT'
  | 'DECIMAL'
  | 'VARCHAR'
  | 'TEXT'
  | 'DATE'
  | 'TIME'
  | 'TIMESTAMP'
  | 'BOOLEAN'
  | 'UUID';

/** Normalization strategy for the logical layer. */
export type Normalization = '3NF' | 'Dimensional (Kimball)' | 'Hybrid';

export interface LogicalAttributeRef {
  /** Referenced `LogicalEntity.name`. */
  entity: string;
  /** Referenced `LogicalAttribute.name`. */
  attribute: string;
}

export interface LogicalAttribute {
  name: string;
  /** Concrete platform-agnostic type, e.g. "BIGINT", "VARCHAR(255)", "DECIMAL(12,2)". */
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  /** A natural/business key (e.g. claim_number, provider_npi). */
  isBusinessKey: boolean;
  isForeignKey: boolean;
  /** FK target; null unless `isForeignKey`. */
  references: LogicalAttributeRef | null;
  description: string;
}

export interface LogicalEntity {
  name: string;
  type: ModelEntityType;
  description: string;
  attributes: LogicalAttribute[];
}

export interface LogicalRelationship {
  /** Must match a `LogicalEntity.name` exactly. */
  from: string;
  /** Must match a `LogicalEntity.name` exactly. */
  to: string;
  /** FK column on `from` (or the parent key, depending on direction). */
  fromAttribute: string;
  /** Referenced column on `to`. */
  toAttribute: string;
  cardinality: ModelCardinality;
  /** Identifying (the FK is part of the child PK) vs non-identifying. */
  identifying: boolean;
  label: string;
}

/** A complete logical data model. */
export interface LogicalModel {
  name: string;
  domain: string;
  version: string;
  overview: string;
  normalization: Normalization;
  entities: LogicalEntity[];
  relationships: LogicalRelationship[];
}

export interface LogicalVersion {
  label: string;
  major: number;
  minor: number;
  at: number;
  source: ResultSource;
  doc: LogicalModel;
}

/** All persisted Logical Data Modeler state for the tab. */
export interface LogicalState {
  domain: string;
  versions: LogicalVersion[];
  activeVersion: string | null;
  revisionNote: string;
}

export interface Project {
  /** Stable id; lets us key persisted blobs and future multi-project support. */
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  requirements: BusinessRequirements;
  sources: DataSource[];
  engineering: EngineeringPlan;
  modeling: ModelingPlan;
  dashboard: DashboardPlan;
  stageMeta: Record<StageId, StageMeta>;
  /** Persisted agent output per stage, so results survive a refresh. */
  agentResults: Partial<Record<StageId, StageResult>>;
  /** BRD Generator workspace (spec 2.x). */
  brd: BrdState;
  /** Conceptual Data Modeler workspace (spec 3.x). */
  model: ModelState;
  /** Logical Data Modeler workspace (spec 3.x, logical layer). */
  logical: LogicalState;
}

export type ThemeMode = 'light' | 'dark';
