import type { Project } from '../store/types';

const EXPORT_VERSION = 1;

interface BackupFile {
  app: 'data-value-chain-agent-foundry';
  version: number;
  exportedAt: string;
  project: Project;
}

/** Download the current project as a JSON backup the user can keep off-device. */
export function downloadProjectBackup(project: Project): void {
  const payload: BackupFile = {
    app: 'data-value-chain-agent-foundry',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    project,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeName = (project.name || 'project').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const a = document.createElement('a');
  a.href = url;
  a.download = `dvcaf-${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse + lightly validate a backup file picked by the user. Throws on bad input. */
export async function readProjectBackup(file: File): Promise<Project> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<BackupFile>;
  if (parsed.app !== 'data-value-chain-agent-foundry' || !parsed.project) {
    throw new Error('This file is not a valid Agent Foundry backup.');
  }
  return parsed.project;
}
