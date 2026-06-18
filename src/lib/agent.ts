import type { Project, ResultSource, StageId } from '../store/types';
import { requestAgent } from './api';

/**
 * The user only ever sees the word "Agent". The underlying model/vendor name is
 * never referenced here or anywhere on the client (spec 1.8, 1.11).
 */
export const AGENT_LABEL = 'Agent';

export interface AgentResult {
  output: string;
  source: ResultSource;
}

/** In-flight status copy per stage. Generic, never names the model. */
const STATUS: Record<StageId, string> = {
  requirements: 'Agent is drafting your requirements…',
  sources: 'Agent is reviewing your data sources…',
  engineering: 'Agent is designing your pipeline…',
  modeling: 'Agent is shaping your data model…',
  dashboard: 'Agent is building your dashboard…',
  publish: 'Agent is preparing your release…',
};

export function agentStatus(stage: StageId): string {
  return STATUS[stage] ?? 'Agent is thinking…';
}

/** Short, human label for a result's provenance. */
export function sourceLabel(source: ResultSource): string {
  return source === 'ai' ? 'AI' : 'Offline fallback';
}

function buildPrompt(stage: StageId, project: Project): string {
  const r = project.requirements;
  const base = `Project: ${project.name || 'Untitled'}\nObjective: ${r.objective || '(none yet)'}\nAudience: ${r.audience || '(none yet)'}`;
  switch (stage) {
    case 'requirements':
      return `${base}\n\nDraft a crisp business-requirements summary with objective, audience, key questions, and success metrics.`;
    case 'sources':
      return `${base}\n\nSuggest the data sources and connections needed to answer these questions.`;
    case 'engineering':
      return `${base}\n\nPropose an ingestion + transformation pipeline, a refresh schedule, and data-quality checks.`;
    case 'modeling':
      return `${base}\n\nPropose a data model: grain, dimensions, measures, and key transformations.`;
    case 'dashboard':
      return `${base}\n\nPropose a dashboard layout and the widgets that best answer the key questions.`;
    case 'publish':
      return `${base}\n\nWrite a short release checklist to validate and publish this dashboard.`;
    default:
      return base;
  }
}

/**
 * Deterministic local fallback for each stage. Always produces a reasonable
 * default so every tab works even when the AI service is unavailable (spec 1.9).
 */
function localFallback(stage: StageId, project: Project): string {
  const r = project.requirements;
  const objective = r.objective?.trim() || 'the stated business objective';
  const audience = r.audience?.trim() || 'the primary stakeholders';
  switch (stage) {
    case 'requirements':
      return [
        `Objective: ${objective}.`,
        `Audience: ${audience}.`,
        'Key questions: What is the current trend? Where are the outliers? What drives the change?',
        'Success metrics: a single agreed KPI, refreshed on a predictable schedule.',
      ].join('\n');
    case 'sources':
      return [
        'Suggested sources:',
        '- Core warehouse table(s) for the primary entity',
        '- A reference/lookup source for dimensions',
        '- An events or transactions feed for trends over time',
      ].join('\n');
    case 'engineering':
      return [
        'Ingestion: batch extract from each source into a raw schema.',
        'Pipeline: raw → staging (typed, deduped) → conformed marts.',
        'Schedule: hourly incremental, full reload nightly.',
        'Quality: not_null + unique on the primary key; row-count drift under 5%.',
      ].join('\n');
    case 'modeling':
      return [
        'Grain: one row per primary entity per day.',
        'Dimensions: date, segment, region.',
        'Measures: count, sum, and a period-over-period delta.',
        'Transformations: conform keys, derive the delta, aggregate to grain.',
      ].join('\n');
    case 'dashboard':
      return [
        `Title: ${project.name || 'Untitled'} overview`,
        'Layout: grid.',
        'Widgets: headline KPI, trend line, top-N breakdown, and a filterable detail table.',
        `Framed for ${audience}.`,
      ].join('\n');
    case 'publish':
      return [
        'Release checklist:',
        '1. Validate numbers against a known source of truth.',
        '2. Confirm refresh schedule and ownership.',
        '3. Share access with the intended audience.',
        '4. Capture sign-off.',
      ].join('\n');
    default:
      return 'A reasonable default for this stage.';
  }
}

/**
 * Runs the agent for a stage. Tries the server-backed AI service first; on any
 * failure (unconfigured, unreachable, error) it transparently uses the local
 * fallback. The caller can show `sourceLabel(result.source)` to indicate which
 * path produced the result.
 */
export async function runStageAgent(stage: StageId, project: Project): Promise<AgentResult> {
  const res = await requestAgent(stage, buildPrompt(stage, project));
  if (res.source === 'ai' && res.output && res.output.trim()) {
    return { output: res.output.trim(), source: 'ai' };
  }
  return { output: localFallback(stage, project), source: 'fallback' };
}
