import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { useBannerStore } from '../../store/bannerStore';
import { DOMAINS, domainById } from '../../config/domains';
import {
  coerceConceptualModel,
  detectModelBump,
  localModelFallback,
  sanitizeModel,
  summarizeBrd,
} from '../../lib/model';
import { requestModel } from '../../lib/api';
import { AGENT_LABEL } from '../../lib/agent';
import type { ConceptualModel, ResultSource } from '../../store/types';
import { Select } from '../ui/Field';
import { Button } from '../ui/Button';
import { ModelOutput } from './ModelOutput';

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ModelGenerator() {
  const brd = useProjectStore((s) => s.project.brd);
  const model = useProjectStore((s) => s.project.model);
  const setModelDomain = useProjectStore((s) => s.setModelDomain);
  const setModelRevisionNote = useProjectStore((s) => s.setModelRevisionNote);
  const addModelVersion = useProjectStore((s) => s.addModelVersion);
  const setActiveModelVersion = useProjectStore((s) => s.setActiveModelVersion);

  const aiConfigured = useRuntimeStore((s) => s.config.ai.configured);
  const success = useBannerStore((s) => s.success);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // Adapt to the BRD's domain until the user has generated or overridden it.
  useEffect(() => {
    if (model.versions.length === 0 && model.domain !== brd.domain) {
      setModelDomain(brd.domain);
    }
    // Only react to BRD domain changes before the first generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brd.domain]);

  const domain = domainById(model.domain);
  const domainLabel = domain?.label ?? model.domain;
  const projectName = brd.projectName;

  const latestBrd = brd.versions[brd.versions.length - 1]?.doc ?? null;
  const brdText = useMemo(() => summarizeBrd(brd, latestBrd), [brd, latestBrd]);
  const hasBrdInput = brdText.trim().length > 0;

  const activeVersion =
    model.versions.find((v) => v.label === model.activeVersion) ??
    model.versions[model.versions.length - 1] ??
    null;

  const sanitized = useMemo(
    () => (activeVersion ? sanitizeModel(activeVersion.doc) : null),
    [activeVersion],
  );

  const canRegenerate = model.versions.length >= 1 && !busy;

  async function runGeneration(isRegen: boolean) {
    setBusy(true);
    setStatus(`${AGENT_LABEL} is shaping your data model…`);
    try {
      const res = await requestModel({
        domain: model.domain,
        domainLabel,
        projectName,
        brdText,
        vocabularyHint: domain?.modelSeed.entities.map((e) => e.name) ?? [],
        revisionNote: model.revisionNote,
      });

      let doc: ConceptualModel;
      let source: ResultSource;
      if (res.source === 'ai' && res.doc) {
        doc = sanitizeModel(coerceConceptualModel(res.doc)).model;
        source = 'ai';
      } else {
        doc = sanitizeModel(localModelFallback(model, projectName)).model;
        source = 'fallback';
      }

      const bump = isRegen ? detectModelBump(model.revisionNote) : 'minor';
      const label = addModelVersion(doc, source, bump);
      const provenance = source === 'ai' ? 'AI-generated' : 'Offline-generated';
      success(`Conceptual model v${label} ready (${provenance}).`);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  function downloadJson() {
    if (!activeVersion) return;
    const safe = (projectName || 'model').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const blob = new Blob([JSON.stringify(activeVersion.doc, null, 2)], {
      type: 'application/json',
    });
    saveBlob(blob, `Model_${safe}_v${activeVersion.label}.json`);
    success(`Downloaded the v${activeVersion.label} model JSON.`);
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Conceptual Data Modeler
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-content">
          Turn the BRD into a <span className="text-accent-500">data model.</span>
        </h1>
        <p className="mt-3 text-base text-content-muted">
          The {AGENT_LABEL} reads your Business Requirements Document and proposes a rigorous
          conceptual model — business entities, their types, and the relationships between them —
          grounded in the BRD and your domain's standard vocabulary.
        </p>
        {!aiConfigured && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            AI service not connected — results use the offline fallback.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[45fr_55fr]">
        {/* Left: configure */}
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Step 1</p>
            <h2 className="text-lg font-semibold text-content">Generate the model</h2>
          </div>

          <Select
            label="Domain"
            value={model.domain}
            onChange={(e) => setModelDomain(e.target.value)}
            hint="The domain seeds the standard entity vocabulary. Defaults to your BRD's domain."
          >
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>

          <div className="rounded-lg border border-border bg-surface-muted/30 p-3 text-sm">
            <p className="font-medium text-content">Input: your BRD</p>
            {hasBrdInput ? (
              <p className="mt-1 text-xs text-content-muted">
                Using {latestBrd ? `BRD v${brd.versions[brd.versions.length - 1]?.label}` : 'your requirement text'}
                {projectName ? ` for ${projectName}` : ''} as the grounding for this model.
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No BRD content yet — generate a BRD first for a grounded model, or proceed to get a
                domain-standard starter model.
              </p>
            )}
          </div>

          <div>
            <label className="field-label">Revision request (optional)</label>
            <textarea
              value={model.revisionNote}
              onChange={(e) => setModelRevisionNote(e.target.value)}
              rows={5}
              placeholder="e.g. Add a Coverage entity and link claims to it. Use 'breaking' for a major version bump."
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <p className="field-hint">
              Folded into the next Regenerate. Include the word “breaking” for a major version bump.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => runGeneration(false)} disabled={busy}>
              Generate model
            </Button>
            <Button variant="secondary" onClick={() => runGeneration(true)} disabled={!canRegenerate}>
              Regenerate
            </Button>
            <Button variant="secondary" onClick={downloadJson} disabled={!activeVersion || busy}>
              Download JSON
            </Button>
          </div>
        </div>

        {/* Right: output */}
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Step 2</p>
              <h2 className="text-lg font-semibold text-content">Your conceptual model</h2>
            </div>
            {model.versions.length > 0 && activeVersion && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200">
                  v{activeVersion.label}
                </span>
                <select
                  value={model.activeVersion ?? activeVersion.label}
                  onChange={(e) => setActiveModelVersion(e.target.value)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-content focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                  {model.versions
                    .slice()
                    .reverse()
                    .map((v) => (
                      <option key={v.label} value={v.label}>
                        v{v.label} · {v.source === 'ai' ? 'AI' : 'Offline'}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {busy && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              {status || `${AGENT_LABEL} is thinking…`}
            </div>
          )}

          {activeVersion && sanitized ? (
            <>
              <p className="text-xs text-content-muted">
                {activeVersion.source === 'ai' ? 'AI-generated' : 'Offline-generated'} ·{' '}
                {new Date(activeVersion.at).toLocaleString()}
              </p>
              <ModelOutput model={activeVersion.doc} validation={sanitized.validation} />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-8 text-center">
              <p className="text-sm font-medium text-content">Your data model will appear here.</p>
              <p className="mt-1 text-sm text-content-muted">
                Click <strong>Generate model</strong> to produce entities, a relationship table, and
                an ER diagram from your BRD. Then refine with a revision request and regenerate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
