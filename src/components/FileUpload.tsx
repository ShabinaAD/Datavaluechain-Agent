import { useRef } from 'react';
import { useUploadStore } from '../store/uploadStore';
import { useBannerStore } from '../store/bannerStore';
import { Button } from './ui/Button';

/**
 * File upload that demonstrates the spec 1.7 exception: the uploaded file lives
 * only in memory (uploadStore, not persisted), so it is gone after a refresh —
 * but anything the user derives from it is handed to `onDerive` and saved into
 * the persisted project, so that work survives.
 */
export function FileUpload({
  uploadKey,
  onDerive,
}: {
  uploadKey: string;
  onDerive: (info: { name: string; text: string }) => void;
}) {
  const file = useUploadStore((s) => s.files[uploadKey]);
  const setFile = useUploadStore((s) => s.setFile);
  const clearFile = useUploadStore((s) => s.clearFile);
  const success = useBannerStore((s) => s.success);
  const error = useBannerStore((s) => s.error);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    try {
      const text = (await picked.text()).slice(0, 4000);
      const firstLine = text.split(/\r?\n/)[0] ?? '';
      setFile(uploadKey, {
        name: picked.name,
        size: picked.size,
        preview: firstLine.slice(0, 200),
      });
      onDerive({ name: picked.name, text });
      success(`Imported “${picked.name}”. Derived details were saved to your project.`);
    } catch {
      error('That file could not be read. Please try a text/CSV file.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-content">Import a sample file</p>
          <p className="text-xs text-content-muted">
            Held in memory only — cleared on refresh. Derived details are saved to your project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.json,.tsv"
            onChange={onSelect}
            className="hidden"
            id={`upload-${uploadKey}`}
          />
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
        </div>
      </div>

      {file && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-md border border-border bg-surface p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-content">{file.name}</p>
            <p className="truncate text-xs text-content-muted">
              {(file.size / 1024).toFixed(1)} KB · preview: {file.preview || '(empty)'}
            </p>
          </div>
          <button
            onClick={() => clearFile(uploadKey)}
            className="shrink-0 text-xs text-content-muted hover:text-content"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
