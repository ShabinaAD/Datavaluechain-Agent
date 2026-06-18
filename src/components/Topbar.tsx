import { Link } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { SaveStatus } from './SaveStatus';
import { ConnectionBadge } from './ConnectionBadge';
import { Button } from './ui/Button';
import { FoundryMark, SunIcon, MoonIcon, SettingsIcon, OverviewIcon } from '../icons';

export function Topbar() {
  const name = useProjectStore((s) => s.project.name);
  const renameProject = useProjectStore((s) => s.renameProject);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/80 px-5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          aria-label="Overview"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <FoundryMark width={22} height={22} />
        </Link>
        <input
          aria-label="Project name"
          value={name}
          onChange={(e) => renameProject(e.target.value)}
          className="min-w-0 max-w-md truncate rounded-md bg-transparent px-1 py-0.5 text-lg font-semibold text-content outline-none hover:bg-surface-muted focus:bg-surface-muted"
        />
      </div>

      <div className="flex items-center gap-2">
        <ConnectionBadge />
        <SaveStatus />
        <Link to="/" aria-label="Overview" title="Overview">
          <Button variant="ghost" size="sm" className="px-2">
            <OverviewIcon width={18} height={18} />
          </Button>
        </Link>
        <Link to="/settings" aria-label="Settings" title="Settings">
          <Button variant="ghost" size="sm" className="px-2">
            <SettingsIcon width={18} height={18} />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="px-2"
        >
          {theme === 'dark' ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
        </Button>
      </div>
    </header>
  );
}
