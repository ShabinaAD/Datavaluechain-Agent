import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BusinessRequirements,
  DashboardPlan,
  DataSource,
  EngineeringPlan,
  ModelingPlan,
  Project,
  StageId,
  StageMeta,
  StageStatus,
} from './types';
import { WORKFLOW_STAGES } from '../config/workflow';

/**
 * PERSISTENCE CONTRACT
 * --------------------
 * This store is the single source of truth for all of a user's work. It is
 * mirrored to localStorage on every change via the `persist` middleware, so an
 * accidental browser refresh (or even a crash) never loses hours of work.
 *
 * Three things make this resilient rather than fragile:
 *   1. `version` + `migrate` — old saved blobs are upgraded, never discarded.
 *   2. `_hasHydrated` — the UI waits for rehydration before rendering or
 *      writing, so we never overwrite saved state with empty defaults on boot.
 *   3. `lastSavedAt` — surfaced in the UI ("All changes saved") so the user can
 *      trust their work is safe.
 */

const STORAGE_KEY = 'dvcaf.project';
// v2 introduced the dedicated "Data Engineering" stage.
const STORAGE_VERSION = 2;

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyStageMeta(): Record<StageId, StageMeta> {
  return WORKFLOW_STAGES.reduce(
    (acc, stage) => {
      acc[stage.id] = { status: 'not_started', notes: '' };
      return acc;
    },
    {} as Record<StageId, StageMeta>,
  );
}

export function createEmptyProject(): Project {
  const now = Date.now();
  return {
    id: makeId('proj'),
    name: 'Untitled Project',
    description: '',
    createdAt: now,
    updatedAt: now,
    requirements: { objective: '', audience: '', keyQuestions: '', successMetrics: '' },
    sources: [],
    engineering: { ingestion: '', pipeline: '', schedule: '', quality: '' },
    modeling: { grain: '', dimensions: '', measures: '', transformations: '' },
    dashboard: { title: '', layout: 'grid', widgets: '', notes: '' },
    stageMeta: emptyStageMeta(),
  };
}

interface ProjectState {
  project: Project;
  /** Wall-clock time of the last persisted write; powers the save indicator. */
  lastSavedAt: number | null;
  /** True once localStorage has been read back into the store on boot. */
  _hasHydrated: boolean;

  // --- mutations ---
  renameProject: (name: string) => void;
  setDescription: (description: string) => void;
  updateRequirements: (patch: Partial<BusinessRequirements>) => void;
  updateEngineering: (patch: Partial<EngineeringPlan>) => void;
  updateModeling: (patch: Partial<ModelingPlan>) => void;
  updateDashboard: (patch: Partial<DashboardPlan>) => void;
  addSource: () => void;
  updateSource: (id: string, patch: Partial<DataSource>) => void;
  removeSource: (id: string) => void;
  setStageStatus: (id: StageId, status: StageStatus) => void;
  setStageNotes: (id: StageId, notes: string) => void;
  resetProject: () => void;
  /** Replace the whole project, e.g. when restoring from a backup file. */
  replaceProject: (project: Project) => void;

  setHasHydrated: (value: boolean) => void;
}

/** Wrap a mutation so every change bumps `updatedAt`. */
function touch(project: Project): Project {
  return { ...project, updatedAt: Date.now() };
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      project: createEmptyProject(),
      lastSavedAt: null,
      _hasHydrated: false,

      renameProject: (name) => set((s) => ({ project: touch({ ...s.project, name }) })),
      setDescription: (description) =>
        set((s) => ({ project: touch({ ...s.project, description }) })),

      updateRequirements: (patch) =>
        set((s) => ({
          project: touch({ ...s.project, requirements: { ...s.project.requirements, ...patch } }),
        })),

      updateEngineering: (patch) =>
        set((s) => ({
          project: touch({ ...s.project, engineering: { ...s.project.engineering, ...patch } }),
        })),

      updateModeling: (patch) =>
        set((s) => ({
          project: touch({ ...s.project, modeling: { ...s.project.modeling, ...patch } }),
        })),

      updateDashboard: (patch) =>
        set((s) => ({
          project: touch({ ...s.project, dashboard: { ...s.project.dashboard, ...patch } }),
        })),

      addSource: () =>
        set((s) => ({
          project: touch({
            ...s.project,
            sources: [
              ...s.project.sources,
              {
                id: makeId('src'),
                name: '',
                kind: 'warehouse',
                connection: '',
                notes: '',
              },
            ],
          }),
        })),

      updateSource: (id, patch) =>
        set((s) => ({
          project: touch({
            ...s.project,
            sources: s.project.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)),
          }),
        })),

      removeSource: (id) =>
        set((s) => ({
          project: touch({
            ...s.project,
            sources: s.project.sources.filter((src) => src.id !== id),
          }),
        })),

      setStageStatus: (id, status) =>
        set((s) => ({
          project: touch({
            ...s.project,
            stageMeta: { ...s.project.stageMeta, [id]: { ...s.project.stageMeta[id], status } },
          }),
        })),

      setStageNotes: (id, notes) =>
        set((s) => ({
          project: touch({
            ...s.project,
            stageMeta: { ...s.project.stageMeta, [id]: { ...s.project.stageMeta[id], notes } },
          }),
        })),

      resetProject: () => set({ project: createEmptyProject(), lastSavedAt: Date.now() }),

      replaceProject: (project) => set({ project: touch(project), lastSavedAt: Date.now() }),

      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Only persist the data, never the action functions or the hydration flag.
      partialize: (state) => ({ project: state.project, lastSavedAt: state.lastSavedAt }),
      // Stamp the save time on every successful write so the UI can show it.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      migrate: (persisted, fromVersion) => {
        // Forward-migration hook: upgrade old saved blobs instead of dropping
        // the user's work. Each bump backfills only what changed.
        const state = persisted as { project: Project; lastSavedAt: number | null };
        if (fromVersion < 2 && state?.project) {
          // v1 -> v2: add the new "Data Engineering" stage and its meta.
          state.project.engineering = state.project.engineering ?? {
            ingestion: '',
            pipeline: '',
            schedule: '',
            quality: '',
          };
          state.project.stageMeta = {
            ...emptyStageMeta(),
            ...state.project.stageMeta,
          };
        }
        return state;
      },
    },
  ),
);

/**
 * Subscribe to changes and stamp `lastSavedAt`. We do this outside the setters
 * so *any* mutation (now or added later) updates the save indicator for free.
 */
useProjectStore.subscribe((state, prev) => {
  if (state.project !== prev.project && state._hasHydrated) {
    // Defer to avoid setstate-during-render warnings.
    queueMicrotask(() => useProjectStore.setState({ lastSavedAt: Date.now() }));
  }
});

export function stageCompletion(project: Project): number {
  const total = WORKFLOW_STAGES.length;
  const done = WORKFLOW_STAGES.filter((s) => project.stageMeta[s.id]?.status === 'complete').length;
  return Math.round((done / total) * 100);
}
