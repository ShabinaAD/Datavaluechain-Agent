import type { StageId } from '../store/types';

export interface StageDefinition {
  id: StageId;
  /** Route path segment under /project. */
  path: string;
  label: string;
  /** The AI agent that owns this stage of the value chain. */
  agent: string;
  /** One-line description for the sidebar / overview cards. */
  blurb: string;
}

/**
 * Single source of truth for the ordered value-chain stages.
 * Navigation, the stepper, and the overview all derive from this list, so
 * adding a stage is a one-line change here.
 */
export const WORKFLOW_STAGES: StageDefinition[] = [
  {
    id: 'requirements',
    path: 'requirements',
    label: 'Business Requirements',
    agent: 'Business Analyst Agent',
    blurb: 'Capture the objective, audience, and the questions the data must answer.',
  },
  {
    id: 'sources',
    path: 'sources',
    label: 'Data Sources',
    agent: 'Data Engineer Agent',
    blurb: 'Identify and connect the source systems that feed the value chain.',
  },
  {
    id: 'engineering',
    path: 'engineering',
    label: 'Data Engineering',
    agent: 'Data Engineer Agent',
    blurb: 'Build the ingestion and transformation pipelines that power the model.',
  },
  {
    id: 'modeling',
    path: 'modeling',
    label: 'Data Modeling',
    agent: 'Analytics Engineer Agent',
    blurb: 'Define the grain, dimensions, measures, and transformations.',
  },
  {
    id: 'dashboard',
    path: 'dashboard',
    label: 'Dashboard Design',
    agent: 'BI Developer Agent',
    blurb: 'Lay out the visuals and narrative that deliver the insight.',
  },
  {
    id: 'publish',
    path: 'publish',
    label: 'Review & Publish',
    agent: 'Delivery Agent',
    blurb: 'Validate the end-to-end chain and ship the dashboard.',
  },
];

export const STAGE_BY_ID: Record<StageId, StageDefinition> = Object.fromEntries(
  WORKFLOW_STAGES.map((s) => [s.id, s]),
) as Record<StageId, StageDefinition>;

export function stageIndex(id: StageId): number {
  return WORKFLOW_STAGES.findIndex((s) => s.id === id);
}
