import { useNavigate } from 'react-router-dom';
import { WORKFLOW_STAGES, stageIndex } from '../config/workflow';
import type { StageId, StageStatus } from '../store/types';
import { useProjectStore } from '../store/projectStore';
import { Button } from './ui/Button';
import { Select } from './ui/Field';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

const STATUS_OPTIONS: { value: StageStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'review', label: 'In review' },
  { value: 'complete', label: 'Complete' },
];

/** Footer for each stage page: set status + move through the value chain. */
export function StageNav({ stageId }: { stageId: StageId }) {
  const navigate = useNavigate();
  const status = useProjectStore((s) => s.project.stageMeta[stageId].status);
  const setStageStatus = useProjectStore((s) => s.setStageStatus);

  const index = stageIndex(stageId);
  const prev = index > 0 ? WORKFLOW_STAGES[index - 1] : null;
  const next = index < WORKFLOW_STAGES.length - 1 ? WORKFLOW_STAGES[index + 1] : null;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
      <div className="flex items-end gap-3">
        <Select
          label="Stage status"
          value={status}
          onChange={(e) => setStageStatus(stageId, e.target.value as StageStatus)}
          className="w-44"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={!prev}
          onClick={() => prev && navigate(`/stage/${prev.path}`)}
          leftIcon={<ChevronLeftIcon width={16} height={16} />}
        >
          {prev ? prev.label : 'Back'}
        </Button>
        <Button
          disabled={!next}
          onClick={() => next && navigate(`/stage/${next.path}`)}
        >
          {next ? next.label : 'Final stage'}
          {next && <ChevronRightIcon width={16} height={16} />}
        </Button>
      </div>
    </div>
  );
}
