import { StagePage } from '../components/StagePage';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TextInput, Select, TextArea } from '../components/ui/Field';
import { ConnectFirst } from '../components/ConnectFirst';
import { FileUpload } from '../components/FileUpload';
import { useProjectStore } from '../store/projectStore';
import type { DataSource } from '../store/types';
import { PlusIcon, TrashIcon, SourcesIcon } from '../icons';

/** Turn a sample file's first line into a readable "columns" summary. */
function deriveColumns(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const cols = firstLine
    .split(/[,\t]/)
    .map((c) => c.trim())
    .filter(Boolean);
  return cols.length ? `Columns: ${cols.join(', ')}` : 'Imported sample file.';
}

const KINDS: { value: DataSource['kind']; label: string }[] = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'database', label: 'Database' },
  { value: 'api', label: 'API' },
  { value: 'file', label: 'File' },
  { value: 'stream', label: 'Stream' },
];

export function Sources() {
  const sources = useProjectStore((s) => s.project.sources);
  const addSource = useProjectStore((s) => s.addSource);
  const importSource = useProjectStore((s) => s.importSource);
  const updateSource = useProjectStore((s) => s.updateSource);
  const removeSource = useProjectStore((s) => s.removeSource);

  return (
    <StagePage stageId="sources">
      <div className="mb-4 space-y-4">
        <ConnectFirst
          service="Database"
          hint="Set DATABASE_URL on the server to enable live connections. You can keep designing your sources now — your work is saved."
        />
        <FileUpload
          uploadKey="sources"
          onDerive={({ name, text }) =>
            importSource({ name, kind: 'file', connection: name, notes: deriveColumns(text) })
          }
        />
        <div className="flex justify-end">
          <Button onClick={addSource} leftIcon={<PlusIcon width={16} height={16} />}>
            Add source
          </Button>
        </div>
      </div>

      {sources.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted text-content-subtle">
              <SourcesIcon width={24} height={24} />
            </span>
            <div>
              <p className="font-medium text-content">No data sources yet</p>
              <p className="text-sm text-content-muted">
                Add the systems that feed this value chain to get started.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={addSource}
              leftIcon={<PlusIcon width={16} height={16} />}
            >
              Add your first source
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {sources.map((source, i) => (
            <Card key={source.id}>
              <CardHeader
                title={source.name || `Source ${i + 1}`}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSource(source.id)}
                    aria-label="Remove source"
                    className="px-2 text-content-muted hover:text-red-600"
                  >
                    <TrashIcon width={16} height={16} />
                  </Button>
                }
              />
              <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  label="Name"
                  placeholder="e.g. Salesforce CRM"
                  value={source.name}
                  onChange={(e) => updateSource(source.id, { name: e.target.value })}
                />
                <Select
                  label="Type"
                  value={source.kind}
                  onChange={(e) =>
                    updateSource(source.id, { kind: e.target.value as DataSource['kind'] })
                  }
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </Select>
                <div className="sm:col-span-2">
                  <TextInput
                    label="Connection"
                    placeholder="e.g. snowflake://acme/analytics"
                    value={source.connection}
                    onChange={(e) => updateSource(source.id, { connection: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextArea
                    label="Notes"
                    placeholder="Refresh cadence, owners, caveats…"
                    value={source.notes}
                    onChange={(e) => updateSource(source.id, { notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </StagePage>
  );
}
