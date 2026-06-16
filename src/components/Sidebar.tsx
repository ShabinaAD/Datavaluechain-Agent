import { NavLink } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';
import { WORKFLOW_STAGES } from '../config/workflow';
import { useProjectStore, stageCompletion } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { cn } from '../lib/cn';
import {
  FoundryMark,
  OverviewIcon,
  RequirementsIcon,
  SourcesIcon,
  EngineeringIcon,
  ModelingIcon,
  DashboardIcon,
  PublishIcon,
  SettingsIcon,
  ChevronLeftIcon,
  CheckIcon,
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

function StatusDot({ status }: { status: StageStatus }) {
  if (status === 'complete') {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
        <CheckIcon width={11} height={11} strokeWidth={3} />
      </span>
    );
  }
  const color =
    status === 'in_progress'
      ? 'bg-brand-500'
      : status === 'review'
        ? 'bg-accent-500'
        : 'bg-content-subtle/40';
  return <span className={cn('h-2 w-2 rounded-full', color)} />;
}

function NavRow({
  to,
  end,
  icon: Icon,
  label,
  collapsed,
  trailing,
}: {
  to: string;
  end?: boolean;
  icon: IconComponent;
  label: string;
  collapsed: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-content-muted hover:bg-surface-muted hover:text-content',
        )
      }
    >
      <Icon width={18} height={18} className="shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && trailing}
    </NavLink>
  );
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const project = useProjectStore((s) => s.project);
  const completion = stageCompletion(project);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-4 py-4', collapsed && 'justify-center px-0')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
          <FoundryMark width={22} height={22} />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-content">
              Agent Foundry
            </p>
            <p className="truncate text-xs text-content-muted">Data Value Chain</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <NavRow to="/" end icon={OverviewIcon} label="Overview" collapsed={collapsed} />

        {!collapsed && (
          <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-content-subtle">
            Value Chain
          </p>
        )}

        {WORKFLOW_STAGES.map((stage) => (
          <NavRow
            key={stage.id}
            to={`/stage/${stage.path}`}
            icon={STAGE_ICONS[stage.id]}
            label={stage.label}
            collapsed={collapsed}
            trailing={<StatusDot status={project.stageMeta[stage.id].status} />}
          />
        ))}
      </nav>

      <div className="space-y-2 border-t border-border px-3 py-3">
        {!collapsed && (
          <div className="px-2">
            <div className="mb-1 flex items-center justify-between text-xs text-content-muted">
              <span>Progress</span>
              <span className="font-medium text-content">{completion}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        )}
        <NavRow to="/settings" icon={SettingsIcon} label="Settings" collapsed={collapsed} />
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-muted hover:text-content',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeftIcon
            width={18}
            height={18}
            className={cn('shrink-0 transition-transform', collapsed && 'rotate-180')}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
