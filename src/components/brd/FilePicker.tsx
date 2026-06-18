import { useRef } from 'react';
import { Button } from '../ui/Button';
import type { BrdFileMeta } from '../../store/brdUploadStore';

/**
 * A labelled file picker for the BRD inputs. Files are kept in memory only
 * (their metadata lives in the BRD upload store), so they are cleared on refresh
 * but survive tab switches. Selecting a file never derives or persists content
 * beyond what the caller chooses to do.
 */
export function FilePicker({
  label,
  hint,
  accept,
  multiple = false,
  files,
  onPick,
  onRemove,
}: {
  label: string;
  hint?: string;
  accept: string;
  multiple?: boolean;
  files: BrdFileMeta[];
  onPick: (files: BrdFileMeta[]) => void;
  onRemove: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size }));
    if (picked.length) onPick(picked);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-content-muted">{hint ?? 'Held in memory only — cleared on refresh.'}</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={onChange}
            className="hidden"
          />
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {multiple ? 'Add files' : 'Choose file'}
          </Button>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-1.5"
              >
                <span className="min-w-0 truncate text-sm text-content">{f.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-content-muted">{(f.size / 1024).toFixed(1)} KB</span>
                  <button
                    onClick={() => onRemove(f.name)}
                    className="text-xs text-content-muted hover:text-content"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
