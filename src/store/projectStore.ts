import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ArtefactReview,
  BrdDocument,
  BrdSectionId,
  BrdState,
  BusinessRequirements,
  CodeGenFile,
  CodeGenState,
  ConceptualModel,
  DashboardPlan,
  DataSource,
  EngineeringPlan,
  LogicalModel,
  LogicalState,
  ModelState,
  ModelingPlan,
  PhysicalModel,
  PhysicalPlatform,
  PhysicalState,
  Project,
  ResultSource,
  ReviewState,
  ReviewVerdict,
  StageId,
  StageMeta,
  StageResult,
  StageStatus,
  VizDashboard,
  VizState,
} from './types';
import { WORKFLOW_STAGES } from '../config/workflow';
import { DEFAULT_DOMAIN_ID, domainById } from '../config/domains';

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
// v3 introduced persisted per-stage agent results.
// v4 introduced the BRD Generator workspace.
// v5 introduced the Conceptual Data Modeler workspace.
// v6 introduced the Logical Data Modeler workspace.
// v7 introduced Physical, Code Gen, Viz Gen, and Review workspaces.
const STORAGE_VERSION = 7;

/** Sensible default output folder for the .docx export (spec 2.5.7). */
const DEFAULT_OUTPUT_FOLDER = '~/Downloads/BRD';

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** A fresh BRD workspace, seeded from the default domain (spec 2.5.2, 2.5.3). */
export function createEmptyBrd(): BrdState {
  const domain = domainById(DEFAULT_DOMAIN_ID);
  return {
    domain: DEFAULT_DOMAIN_ID,
    projectName: domain?.suggestedName ?? '',
    projectNameEdited: false,
    requirement: domain?.requirementSeed ?? '',
    requirementEdited: false,
    outputFolder: DEFAULT_OUTPUT_FOLDER,
    createFolder: true,
    versions: [],
    activeVersion: null,
    comments: {},
  };
}

/** Compute the next version label given the history and the bump kind (spec 2.7.2). */
function nextVersion(
  versions: { major: number; minor: number }[],
  bump: 'minor' | 'major',
): { label: string; major: number; minor: number } {
  if (versions.length === 0) return { label: '1.0', major: 1, minor: 0 };
  const last = versions[versions.length - 1];
  const major = bump === 'major' ? last.major + 1 : last.major;
  const minor = bump === 'major' ? 0 : last.minor + 1;
  return { label: `${major}.${minor}`, major, minor };
}

/** A fresh Conceptual Data Modeler workspace, seeded from the default domain. */
export function createEmptyModel(): ModelState {
  return {
    domain: DEFAULT_DOMAIN_ID,
    versions: [],
    activeVersion: null,
    revisionNote: '',
  };
}

/** A fresh Logical Data Modeler workspace, seeded from the default domain. */
export function createEmptyLogical(): LogicalState {
  return {
    domain: DEFAULT_DOMAIN_ID,
    versions: [],
    activeVersion: null,
    revisionNote: '',
  };
}

export function createEmptyPhysical(): PhysicalState {
  return {
    platform: 'Snowflake',
    versions: [],
    activeVersion: null,
    revisionNote: '',
  };
}

export function createEmptyCodeGen(): CodeGenState {
  return {
    platform: 'Snowflake',
    language: 'SQL',
    outputFolder: '~/Downloads/CodeGen',
    files: [],
    revisionNote: '',
  };
}

export function createEmptyViz(): VizState {
  return {
    versions: [],
    activeVersion: null,
    revisionNote: '',
  };
}

export function createEmptyReview(): ReviewState {
  return {
    reviews: [],
    releaseNotes: '',
    signedOff: false,
  };
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
    agentResults: {},
    brd: createEmptyBrd(),
    model: createEmptyModel(),
    logical: createEmptyLogical(),
    physical: createEmptyPhysical(),
    codegen: createEmptyCodeGen(),
    viz: createEmptyViz(),
    review: createEmptyReview(),
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
  /** Add a source pre-filled from an imported sample file. */
  importSource: (partial: Partial<DataSource>) => void;
  updateSource: (id: string, patch: Partial<DataSource>) => void;
  removeSource: (id: string) => void;
  setStageStatus: (id: StageId, status: StageStatus) => void;
  setStageNotes: (id: StageId, notes: string) => void;
  setStageResult: (id: StageId, result: StageResult) => void;
  clearStageResult: (id: StageId) => void;

  // --- BRD Generator (spec 2.x) ---
  /** Change domain; re-seed name/requirement only if the user hasn't edited them. */
  setBrdDomain: (domainId: string) => void;
  /** User edits to the project name stop further auto-seeding (2.8.2). */
  setBrdProjectName: (name: string) => void;
  /** User edits to the requirement stop further auto-seeding (2.8.2). */
  setBrdRequirement: (requirement: string) => void;
  setBrdOutputFolder: (folder: string) => void;
  setBrdCreateFolder: (createFolder: boolean) => void;
  setBrdComment: (section: BrdSectionId, comment: string) => void;
  /** Append a generated revision and make it active; computes the version bump. */
  addBrdVersion: (doc: BrdDocument, source: ResultSource, bump: 'minor' | 'major') => string;
  setActiveBrdVersion: (label: string) => void;

  // --- Conceptual Data Modeler (spec 3.x) ---
  setModelDomain: (domainId: string) => void;
  setModelRevisionNote: (note: string) => void;
  /** Append a generated model revision and make it active; computes the version bump. */
  addModelVersion: (doc: ConceptualModel, source: ResultSource, bump: 'minor' | 'major') => string;
  setActiveModelVersion: (label: string) => void;

  // --- Logical Data Modeler (spec 3.x, logical layer) ---
  setLogicalDomain: (domainId: string) => void;
  setLogicalRevisionNote: (note: string) => void;
  addLogicalVersion: (doc: LogicalModel, source: ResultSource, bump: 'minor' | 'major') => string;
  setActiveLogicalVersion: (label: string) => void;

  // --- Physical Model / DDL ---
  setPhysicalPlatform: (platform: PhysicalPlatform) => void;
  setPhysicalRevisionNote: (note: string) => void;
  addPhysicalVersion: (doc: PhysicalModel, source: ResultSource, bump: 'minor' | 'major') => string;
  setActivePhysicalVersion: (label: string) => void;

  // --- Code Gen ---
  setCodeGenPlatform: (platform: PhysicalPlatform) => void;
  setCodeGenLanguage: (language: string) => void;
  setCodeGenRevisionNote: (note: string) => void;
  addCodeGenFile: (file: CodeGenFile) => void;

  // --- Viz Gen ---
  setVizRevisionNote: (note: string) => void;
  addVizVersion: (doc: VizDashboard, source: ResultSource, bump: 'minor' | 'major') => string;
  setActiveVizVersion: (label: string) => void;

  // --- Review & Publish ---
  addReview: (review: ArtefactReview) => void;
  setReviewVerdict: (artefact: string, verdict: ReviewVerdict) => void;
  setReleaseNotes: (notes: string) => void;
  setSignedOff: (signedOff: boolean) => void;

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

      importSource: (partial) =>
        set((s) => ({
          project: touch({
            ...s.project,
            sources: [
              ...s.project.sources,
              {
                id: makeId('src'),
                name: '',
                kind: 'file',
                connection: '',
                notes: '',
                ...partial,
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

      setStageResult: (id, result) =>
        set((s) => ({
          project: touch({
            ...s.project,
            agentResults: { ...s.project.agentResults, [id]: result },
          }),
        })),

      clearStageResult: (id) =>
        set((s) => ({
          project: touch({
            ...s.project,
            agentResults: { ...s.project.agentResults, [id]: undefined },
          }),
        })),

      setBrdDomain: (domainId) =>
        set((s) => {
          const domain = domainById(domainId);
          const brd = s.project.brd;
          return {
            project: touch({
              ...s.project,
              brd: {
                ...brd,
                domain: domainId,
                // Re-seed only the fields the user hasn't touched (spec 2.8.2).
                projectName:
                  !brd.projectNameEdited && domain ? domain.suggestedName : brd.projectName,
                requirement:
                  !brd.requirementEdited && domain ? domain.requirementSeed : brd.requirement,
              },
            }),
          };
        }),

      setBrdProjectName: (name) =>
        set((s) => ({
          project: touch({
            ...s.project,
            brd: { ...s.project.brd, projectName: name, projectNameEdited: true },
          }),
        })),

      setBrdRequirement: (requirement) =>
        set((s) => ({
          project: touch({
            ...s.project,
            brd: { ...s.project.brd, requirement, requirementEdited: true },
          }),
        })),

      setBrdOutputFolder: (folder) =>
        set((s) => ({
          project: touch({ ...s.project, brd: { ...s.project.brd, outputFolder: folder } }),
        })),

      setBrdCreateFolder: (createFolder) =>
        set((s) => ({
          project: touch({ ...s.project, brd: { ...s.project.brd, createFolder } }),
        })),

      setBrdComment: (section, comment) =>
        set((s) => ({
          project: touch({
            ...s.project,
            brd: {
              ...s.project.brd,
              comments: { ...s.project.brd.comments, [section]: comment },
            },
          }),
        })),

      addBrdVersion: (doc, source, bump) => {
        const { label, major, minor } = nextVersion(
          useProjectStore.getState().project.brd.versions,
          bump,
        );
        set((s) => ({
          project: touch({
            ...s.project,
            brd: {
              ...s.project.brd,
              versions: [
                ...s.project.brd.versions,
                { label, major, minor, at: Date.now(), source, doc },
              ],
              activeVersion: label,
            },
          }),
        }));
        return label;
      },

      setActiveBrdVersion: (label) =>
        set((s) => ({
          project: touch({ ...s.project, brd: { ...s.project.brd, activeVersion: label } }),
        })),

      setModelDomain: (domainId) =>
        set((s) => ({
          project: touch({ ...s.project, model: { ...s.project.model, domain: domainId } }),
        })),

      setModelRevisionNote: (note) =>
        set((s) => ({
          project: touch({ ...s.project, model: { ...s.project.model, revisionNote: note } }),
        })),

      addModelVersion: (doc, source, bump) => {
        const { label, major, minor } = nextVersion(
          useProjectStore.getState().project.model.versions,
          bump,
        );
        set((s) => ({
          project: touch({
            ...s.project,
            model: {
              ...s.project.model,
              versions: [
                ...s.project.model.versions,
                { label, major, minor, at: Date.now(), source, doc: { ...doc, version: label } },
              ],
              activeVersion: label,
            },
          }),
        }));
        return label;
      },

      setActiveModelVersion: (label) =>
        set((s) => ({
          project: touch({ ...s.project, model: { ...s.project.model, activeVersion: label } }),
        })),

      setLogicalDomain: (domainId) =>
        set((s) => ({
          project: touch({ ...s.project, logical: { ...s.project.logical, domain: domainId } }),
        })),

      setLogicalRevisionNote: (note) =>
        set((s) => ({
          project: touch({ ...s.project, logical: { ...s.project.logical, revisionNote: note } }),
        })),

      addLogicalVersion: (doc, source, bump) => {
        const { label, major, minor } = nextVersion(
          useProjectStore.getState().project.logical.versions,
          bump,
        );
        set((s) => ({
          project: touch({
            ...s.project,
            logical: {
              ...s.project.logical,
              versions: [
                ...s.project.logical.versions,
                { label, major, minor, at: Date.now(), source, doc: { ...doc, version: label } },
              ],
              activeVersion: label,
            },
          }),
        }));
        return label;
      },

      setActiveLogicalVersion: (label) =>
        set((s) => ({
          project: touch({ ...s.project, logical: { ...s.project.logical, activeVersion: label } }),
        })),

      // --- Physical Model / DDL ---
      setPhysicalPlatform: (platform) =>
        set((s) => ({
          project: touch({ ...s.project, physical: { ...s.project.physical, platform } }),
        })),
      setPhysicalRevisionNote: (note) =>
        set((s) => ({
          project: touch({ ...s.project, physical: { ...s.project.physical, revisionNote: note } }),
        })),
      addPhysicalVersion: (doc, source, bump) => {
        const { label, major, minor } = nextVersion(
          useProjectStore.getState().project.physical.versions,
          bump,
        );
        set((s) => ({
          project: touch({
            ...s.project,
            physical: {
              ...s.project.physical,
              versions: [
                ...s.project.physical.versions,
                { label, major, minor, at: Date.now(), source, doc: { ...doc, version: label } },
              ],
              activeVersion: label,
            },
          }),
        }));
        return label;
      },
      setActivePhysicalVersion: (label) =>
        set((s) => ({
          project: touch({ ...s.project, physical: { ...s.project.physical, activeVersion: label } }),
        })),

      // --- Code Gen ---
      setCodeGenPlatform: (platform) =>
        set((s) => ({
          project: touch({ ...s.project, codegen: { ...s.project.codegen, platform } }),
        })),
      setCodeGenLanguage: (language) =>
        set((s) => ({
          project: touch({ ...s.project, codegen: { ...s.project.codegen, language } }),
        })),
      setCodeGenRevisionNote: (note) =>
        set((s) => ({
          project: touch({ ...s.project, codegen: { ...s.project.codegen, revisionNote: note } }),
        })),
      addCodeGenFile: (file) =>
        set((s) => ({
          project: touch({
            ...s.project,
            codegen: { ...s.project.codegen, files: [...s.project.codegen.files, file] },
          }),
        })),

      // --- Viz Gen ---
      setVizRevisionNote: (note) =>
        set((s) => ({
          project: touch({ ...s.project, viz: { ...s.project.viz, revisionNote: note } }),
        })),
      addVizVersion: (doc, source, bump) => {
        const { label, major, minor } = nextVersion(
          useProjectStore.getState().project.viz.versions,
          bump,
        );
        set((s) => ({
          project: touch({
            ...s.project,
            viz: {
              ...s.project.viz,
              versions: [
                ...s.project.viz.versions,
                { label, major, minor, at: Date.now(), source, doc: { ...doc, version: label } },
              ],
              activeVersion: label,
            },
          }),
        }));
        return label;
      },
      setActiveVizVersion: (label) =>
        set((s) => ({
          project: touch({ ...s.project, viz: { ...s.project.viz, activeVersion: label } }),
        })),

      // --- Review & Publish ---
      addReview: (review) =>
        set((s) => ({
          project: touch({
            ...s.project,
            review: {
              ...s.project.review,
              reviews: [
                ...s.project.review.reviews,
                { ...review, at: review.at || Date.now() },
              ],
            },
          }),
        })),
      setReviewVerdict: (artefact, verdict) =>
        set((s) => ({
          project: touch({
            ...s.project,
            review: {
              ...s.project.review,
              reviews: s.project.review.reviews.map((r) =>
                r.artefact === artefact ? { ...r, verdict, at: Date.now() } : r,
              ),
            },
          }),
        })),
      setReleaseNotes: (notes) =>
        set((s) => ({
          project: touch({ ...s.project, review: { ...s.project.review, releaseNotes: notes } }),
        })),
      setSignedOff: (signedOff) =>
        set((s) => ({
          project: touch({ ...s.project, review: { ...s.project.review, signedOff } }),
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
        if (fromVersion < 3 && state?.project) {
          // v2 -> v3: add the persisted agent-results map.
          state.project.agentResults = state.project.agentResults ?? {};
        }
        if (fromVersion < 4 && state?.project) {
          // v3 -> v4: add the BRD Generator workspace.
          state.project.brd = state.project.brd ?? createEmptyBrd();
        }
        if (fromVersion < 5 && state?.project) {
          // v4 -> v5: add the Conceptual Data Modeler workspace.
          state.project.model = state.project.model ?? createEmptyModel();
        }
        if (fromVersion < 6 && state?.project) {
          // v5 -> v6: add the Logical Data Modeler workspace.
          state.project.logical = state.project.logical ?? createEmptyLogical();
        }
        if (fromVersion < 7 && state?.project) {
          // v6 -> v7: add Physical, Code Gen, Viz Gen, Review workspaces.
          state.project.physical = state.project.physical ?? createEmptyPhysical();
          state.project.codegen = state.project.codegen ?? createEmptyCodeGen();
          state.project.viz = state.project.viz ?? createEmptyViz();
          state.project.review = state.project.review ?? createEmptyReview();
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
