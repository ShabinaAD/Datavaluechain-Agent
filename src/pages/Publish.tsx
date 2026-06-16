import { StagePage } from '../components/StagePage';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { TextArea } from '../components/ui/Field';
import { StatusBadge } from '../components/ui/StatusBadge';
import { WORKFLOW_STAGES } from '../config/workflow';
import { useProjectStore, stageCompletion } from '../store/projectStore';
import { CheckIcon } from '../icons';

export function Publish() {
  const project = useProjectStore((s) => s.project);
  const setStageNotes = useProjectStore((s) => s.setStageNotes);
  const completion = stageCompletion(project);

  // The publish stage itself doesn't count toward "ready" — only the build stages.
  const buildStages = WORKFLOW_STAGES.filter((s) => s.id !== 'publish');
  const ready = buildStages.every((s) => project.stageMeta[s.id].status === 'complete');

  return (
    <StagePage stageId="publish">
      <Card className={ready ? 'border-emerald-300 dark:border-emerald-700' : undefined}>
        <CardBody className="flex items-center gap-4">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              ready ? 'bg-emerald-500 text-white' : 'bg-surface-muted text-content-subtle'
            }`}
          >
            <CheckIcon width={24} height={24} strokeWidth={2.5} />
          </span>
          <div>
            <p className="font-semibold text-content">
              {ready ? 'Ready to publish' : 'Not ready to publish'}
            </p>
            <p className="text-sm text-content-muted">
              {ready
                ? 'Every build stage is complete. Ship the dashboard with confidence.'
                : `Value chain is ${completion}% complete. Finish all build stages to publish.`}
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader title="Stage checklist" description="Status across the full value chain." />
          <CardBody className="divide-y divide-border p-0">
            {WORKFLOW_STAGES.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-content">{stage.label}</p>
                  <p className="text-xs text-content-subtle">{stage.agent}</p>
                </div>
                <StatusBadge status={project.stageMeta[stage.id].status} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardBody>
            <TextArea
              label="Release notes"
              placeholder="Summary of what's shipping, known limitations, sign-off…"
              value={project.stageMeta.publish.notes}
              onChange={(e) => setStageNotes('publish', e.target.value)}
              rows={4}
            />
          </CardBody>
        </Card>
      </div>
    </StagePage>
  );
}
