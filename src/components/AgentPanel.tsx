import { useState } from 'react';
import type { StageId } from '../store/types';
import { useProjectStore } from '../store/projectStore';
import { useBannerStore } from '../store/bannerStore';
import { agentStatus, runStageAgent, sourceLabel } from '../lib/agent';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';

/**
 * Reusable "ask the Agent" panel for a stage (spec 1.8, 1.9).
 *   - Status copy only ever says "Agent …", never the model/vendor.
 *   - The result is persisted, so it survives a refresh (spec 1.7).
 *   - A small provenance label shows whether the result came from the AI service
 *     or the local offline fallback.
 */
export function AgentPanel({ stageId }: { stageId: StageId }) {
  const project = useProjectStore((s) => s.project);
  const result = useProjectStore((s) => s.project.agentResults[stageId]);
  const setStageResult = useProjectStore((s) => s.setStageResult);
  const clearStageResult = useProjectStore((s) => s.clearStageResult);
  const success = useBannerStore((s) => s.success);
  const error = useBannerStore((s) => s.error);

  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const r = await runStageAgent(stageId, project);
      setStageResult(stageId, { output: r.output, source: r.source, at: Date.now() });
      success(
        r.source === 'ai'
          ? 'Agent finished. Result added below.'
          : 'AI service unavailable — generated a local fallback result below.',
      );
    } catch {
      // runStageAgent is defensive, but never let a failure crash the page.
      error('The Agent could not complete that request. Please try again.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Agent assist"
        description="Let the Agent draft a starting point for this stage."
        action={
          <Button onClick={run} disabled={running} size="sm">
            {running ? 'Working…' : 'Generate with Agent'}
          </Button>
        }
      />
      <CardBody className="space-y-3">
        {running && (
          <p className="flex items-center gap-2 text-sm text-content-muted" role="status">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            {agentStatus(stageId)}
          </p>
        )}

        {!running && !result && (
          <p className="text-sm text-content-muted">
            No result yet. Click <span className="font-medium text-content">Generate with Agent</span>{' '}
            to create one.
          </p>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  result.source === 'ai'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    result.source === 'ai' ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                {sourceLabel(result.source)}
              </span>
              <button
                onClick={() => clearStageResult(stageId)}
                className="text-xs text-content-muted hover:text-content"
              >
                Clear
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-border bg-surface-muted/60 p-3 font-sans text-sm text-content">
              {result.output}
            </pre>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
