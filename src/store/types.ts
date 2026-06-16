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

export interface Project {
  /** Stable id; lets us key persisted blobs and future multi-project support. */
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  requirements: BusinessRequirements;
  sources: DataSource[];
  modeling: ModelingPlan;
  dashboard: DashboardPlan;
  stageMeta: Record<StageId, StageMeta>;
}

export type ThemeMode = 'light' | 'dark';
