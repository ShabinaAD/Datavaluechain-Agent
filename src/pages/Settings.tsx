import { useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { downloadProjectBackup, readProjectBackup } from '../lib/backup';
import { formatTimestamp } from '../lib/format';
import { SunIcon, MoonIcon, ShieldCheckIcon } from '../icons';

export function Settings() {
  const project = useProjectStore((s) => s.project);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const resetProject = useProjectStore((s) => s.resetProject);
  const replaceProject = useProjectStore((s) => s.replaceProject);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImport(file: File) {
    setImportError(null);
    try {
      const imported = await readProjectBackup(file);
      replaceProject(imported);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import that file.');
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Appearance and the safety controls that protect your work."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Appearance" description="Choose how the studio looks. Saved per device." />
          <CardBody className="flex gap-3">
            <Button
              variant={theme === 'light' ? 'primary' : 'secondary'}
              onClick={() => setTheme('light')}
              leftIcon={<SunIcon width={16} height={16} />}
            >
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'secondary'}
              onClick={() => setTheme('dark')}
              leftIcon={<MoonIcon width={16} height={16} />}
            >
              Dark
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Data & resilience"
            description="Your work is autosaved to this browser and survives refreshes."
          />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-surface-muted px-4 py-3">
              <ShieldCheckIcon width={20} height={20} className="shrink-0 text-emerald-500" />
              <div className="text-sm">
                <p className="font-medium text-content">Autosave is on</p>
                <p className="text-content-muted">
                  Last saved {formatTimestamp(lastSavedAt)} · stored locally in this browser.
                </p>
              </div>
            </div>
            <p className="text-sm text-content-muted">
              For an off-device backup, export a snapshot you can re-import later or on another
              machine.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => downloadProjectBackup(project)}>
                Export backup (.json)
              </Button>
              <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                Import backup
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImport(file);
                  e.target.value = '';
                }}
              />
            </div>
            {importError && <p className="text-sm text-red-600">{importError}</p>}
          </CardBody>
        </Card>

        <Card className="border-red-200 dark:border-red-900/60">
          <CardHeader
            title="Danger zone"
            description="Start over with a blank project. This cannot be undone."
          />
          <CardBody>
            <Button
              variant="danger"
              onClick={() => {
                if (
                  window.confirm(
                    'Reset the workspace? Your current project will be permanently cleared from this browser.',
                  )
                ) {
                  resetProject();
                }
              }}
            >
              Reset workspace
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
