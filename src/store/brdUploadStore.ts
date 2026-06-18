import { create } from 'zustand';

/**
 * In-memory record of files attached on the BRD tab (input documents, the
 * target template, and DDL files). Like {@link useUploadStore}, this is
 * deliberately NOT persisted: the uploaded files do not survive a refresh
 * (spec 2.8.3), but they do survive tab switches because the store outlives the
 * page component.
 */
export interface BrdFileMeta {
  name: string;
  size: number;
}

interface BrdUploadState {
  inputDocuments: BrdFileMeta[];
  template: BrdFileMeta | null;
  ddl: BrdFileMeta[];
  addInputDocuments: (files: BrdFileMeta[]) => void;
  removeInputDocument: (name: string) => void;
  setTemplate: (file: BrdFileMeta | null) => void;
  addDdl: (files: BrdFileMeta[]) => void;
  removeDdl: (name: string) => void;
}

export const useBrdUploadStore = create<BrdUploadState>((set) => ({
  inputDocuments: [],
  template: null,
  ddl: [],
  addInputDocuments: (files) =>
    set((s) => ({ inputDocuments: dedupe([...s.inputDocuments, ...files]) })),
  removeInputDocument: (name) =>
    set((s) => ({ inputDocuments: s.inputDocuments.filter((f) => f.name !== name) })),
  setTemplate: (file) => set({ template: file }),
  addDdl: (files) => set((s) => ({ ddl: dedupe([...s.ddl, ...files]) })),
  removeDdl: (name) => set((s) => ({ ddl: s.ddl.filter((f) => f.name !== name) })),
}));

function dedupe(files: BrdFileMeta[]): BrdFileMeta[] {
  const seen = new Set<string>();
  return files.filter((f) => (seen.has(f.name) ? false : (seen.add(f.name), true)));
}
