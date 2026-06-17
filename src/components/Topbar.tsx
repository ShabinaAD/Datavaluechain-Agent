import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { SaveStatus } from './SaveStatus';
import { Button } from './ui/Button';
import { SunIcon, MoonIcon } from '../icons';

export function Topbar() {
  const name = useProjectStore((s) => s.project.name);
  const renameProject = useProjectStore((s) => s.renameProject);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/80 px-5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <input
          aria-label="Project name"
          value={name}
          onChange={(e) => renameProject(e.target.value)}
          className="min-w-0 max-w-md truncate rounded-md bg-transparent px-1 py-0.5 text-lg font-semibold text-content outline-none hover:bg-surface-muted focus:bg-surface-muted"
        />
      </div>

      <div className="flex items-center gap-2">
        <SaveStatus />
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
