import { Link } from 'react-router-dom';
import { WORKFLOW_STAGES } from '../config/workflow';
import { useProjectStore, stageCompletion } from '../store/projectStore';
import { PageHeader } from '../components/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { TextArea } from '../components/ui/Field';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatTimestamp } from '../lib/format';
import { ChevronRightIcon } from '../icons';

export function Overview() {
  const project = useProjectStore((s) => s.project);
  const setDescription = useProjectStore((s) => s.setDescription);
  const completion = stageCompletion(project);

  return (
    <div>
      <PageHeader
        eyebrow="Project Overview"
        title={project.name || 'Untitled Project'}
        description="Move from business requirements to a published dashboard — each stage handed off to a dedicated AI agent."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-content-muted">Completion</p>
            <p className="mt-1 text-3xl font-semibold text-content">{completion}%</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${completion}%` }} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-content-muted">Data sources</p>
            <p className="mt-1 text-3xl font-semibold text-content">{project.sources.length}</p>
            <p className="mt-3 text-xs text-content-subtle">Connected to the value chain</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-content-muted">Last updated</p>
            <p className="mt-1 text-lg font-semibold text-content">
              {formatTimestamp(project.updatedAt)}
            </p>
            <p className="mt-3 text-xs text-content-subtle">Autosaved to this browser</p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardBody>
            <TextArea
              label="Project brief"
              hint="A short summary of what this project delivers. Saved automatically."
              placeholder="e.g. A board-level revenue dashboard combining CRM and billing data…"
              value={project.description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-content-subtle">
        Value chain stages
      </h2>
      <div className="space-y-3">
        {WORKFLOW_STAGES.map((stage, i) => (
          <Link
            key={stage.id}
            to={`/stage/${stage.path}`}
            className="group flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-card transition-colors hover:border-brand-400 hover:bg-surface-muted"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-content-muted group-hover:bg-brand-600 group-hover:text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-content">{stage.label}</p>
                <span className="hidden text-xs text-content-subtle sm:inline">· {stage.agent}</span>
              </div>
              <p className="truncate text-sm text-content-muted">{stage.blurb}</p>
            </div>
            <StatusBadge status={project.stageMeta[stage.id].status} />
            <ChevronRightIcon
              width={18}
              height={18}
              className="shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-content"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
