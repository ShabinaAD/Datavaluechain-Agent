import type { ReactNode } from 'react';
import { STAGE_BY_ID, stageIndex, WORKFLOW_STAGES } from '../config/workflow';
import type { StageId } from '../store/types';
import { PageHeader } from './PageHeader';
import { StageNav } from './StageNav';
import { AgentPanel } from './AgentPanel';
import { StatusBadge } from './ui/StatusBadge';
import { useProjectStore } from '../store/projectStore';

/** Shared frame for every value-chain stage page. */
export function StagePage({ stageId, children }: { stageId: StageId; children: ReactNode }) {
  const stage = STAGE_BY_ID[stageId];
  const status = useProjectStore((s) => s.project.stageMeta[stageId].status);
  const position = stageIndex(stageId) + 1;

  return (
    <div>
      <PageHeader
        eyebrow={`Stage ${position} of ${WORKFLOW_STAGES.length} · ${stage.agent}`}
        title={stage.label}
        description={stage.blurb}
        actions={<StatusBadge status={status} />}
      />
      <div className="space-y-6">
        {children}
        <AgentPanel stageId={stageId} />
      </div>
      <StageNav stageId={stageId} />
    </div>
  );
}
