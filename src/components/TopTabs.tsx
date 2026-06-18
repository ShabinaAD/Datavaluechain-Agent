import { NavLink } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';
import { WORKFLOW_STAGES } from '../config/workflow';
import { useProjectStore } from '../store/projectStore';
import { cn } from '../lib/cn';
import {
  RequirementsIcon,
  SourcesIcon,
  EngineeringIcon,
  ModelingIcon,
  DashboardIcon,
  PublishIcon,
} from '../icons';
import type { StageId, StageStatus } from '../store/types';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const STAGE_ICONS: Record<StageId, IconComponent> = {
  requirements: RequirementsIcon,
  sources: SourcesIcon,
  engineering: EngineeringIcon,
  modeling: ModelingIcon,
  dashboard: DashboardIcon,
  publish: PublishIcon,
};

function statusDotColor(status: StageStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-500';
    case 'in_progress':
      return 'bg-brand-500';
    case 'review':
      return 'bg-accent-500';
    default:
      return 'bg-content-subtle/40';
  }
}

/**
 * Primary navigation: the six value-chain stages as tabs across the top
 * (spec 1.6, 1.12). Tabs are independent workspaces — switching never loses work
 * because all state lives in the stores. The active tab is always highlighted.
 */
export function TopTabs() {
  const stageMeta = useProjectStore((s) => s.project.stageMeta);

  return (
    <nav
      aria-label="Workflow stages"
      className="flex items-stretch gap-1 overflow-x-auto border-b border-border bg-surface px-3"
    >
      {WORKFLOW_STAGES.map((stage) => {
        const Icon = STAGE_ICONS[stage.id];
        const status = stageMeta[stage.id].status;
        return (
          <NavLink
            key={stage.id}
            to={`/stage/${stage.path}`}
            className={({ isActive }) =>
              cn(
                'group relative flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                  : 'border-transparent text-content-muted hover:border-border hover:text-content',
              )
            }
          >
            <Icon width={17} height={17} className="shrink-0" />
            <span>{stage.label}</span>
            <span
              aria-hidden
              className={cn('ml-1 h-1.5 w-1.5 rounded-full', statusDotColor(status))}
            />
          </NavLink>
        );
      })}
    </nav>
  );
}
