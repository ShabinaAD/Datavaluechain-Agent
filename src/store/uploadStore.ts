import { create } from 'zustand';

/**
 * Uploaded files live ONLY in memory and are deliberately NOT persisted
 * (spec 1.7): after a refresh the file itself is gone, but anything the user
 * derived from it (saved into the project store) survives. This store is the
 * "the file does not need to survive" exception, kept separate from the
 * persisted project store on purpose.
 */
export interface UploadedFile {
  name: string;
  size: number;
  /** A short, human preview of the contents — not persisted. */
  preview: string;
}

interface UploadState {
  files: Record<string, UploadedFile | undefined>;
  setFile: (key: string, file: UploadedFile) => void;
  clearFile: (key: string) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  files: {},
  setFile: (key, file) => set((s) => ({ files: { ...s.files, [key]: file } })),
  clearFile: (key) => set((s) => ({ files: { ...s.files, [key]: undefined } })),
}));
