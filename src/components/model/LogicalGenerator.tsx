import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { useBannerStore } from '../../store/bannerStore';
import { DOMAINS, domainById } from '../../config/domains';
import { sanitizeModel, summarizeBrd } from '../../lib/model';
import {
  coerceLogicalModel,
  detectLogicalBump,
  localLogicalFallback,
  sanitizeLogicalModel,
  summarizeConceptual,
} from '../../lib/logical';
import { requestLogical } from '../../lib/api';
import { AGENT_LABEL } from '../../lib/agent';
import type { LogicalModel, ResultSource } from '../../store/types';
import { Select } from '../ui/Field';
import { Button } from '../ui/Button';
import { LogicalOutput } from './LogicalOutput';

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

export function LogicalGenerator() {
  const brd = useProjectStore((s) => s.project.brd);
  const model = useProjectStore((s) => s.project.model);
  const logical = useProjectStore((s) => s.project.logical);
  const setLogicalDomain = useProjectStore((s) => s.setLogicalDomain);
  const setLogicalRevisionNote = useProjectStore((s) => s.setLogicalRevisionNote);
  const addLogicalVersion = useProjectStore((s) => s.addLogicalVersion);
  const setActiveLogicalVersion = useProjectStore((s) => s.setActiveLogicalVersion);

  const aiConfigured = useRuntimeStore((s) => s.config.ai.configured);
  const success = useBannerStore((s) => s.success);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // The authoritative input is the active conceptual model version.
  const conceptual = useMemo(() => {
    const active =
      model.versions.find((v) => v.label === model.activeVersion) ??
      model.versions[model.versions.length - 1] ??
      null;
    return active ? sanitizeModel(active.doc).model : null;
  }, [model]);
  const hasConceptual = conceptual !== null;

  // Track the conceptual domain until the user generates or overrides it.
  useEffect(() => {
    if (logical.versions.length === 0 && conceptual && logical.domain !== model.domain) {
      setLogicalDomain(model.domain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.domain, hasConceptual]);

  const domain = domainById(logical.domain);
  const domainLabel = domain?.label ?? logical.domain;
  const projectName = brd.projectName;

  const latestBrd = brd.versions[brd.versions.length - 1]?.doc ?? null;
  const brdText = useMemo(() => summarizeBrd(brd, latestBrd), [brd, latestBrd]);

  const activeVersion =
    logical.versions.find((v) => v.label === logical.activeVersion) ??
    logical.versions[logical.versions.length - 1] ??
    null;

  const sanitized = useMemo(
    () => (activeVersion ? sanitizeLogicalModel(activeVersion.doc) : null),
    [activeVersion],
  );

  const canRegenerate = logical.versions.length >= 1 && !busy && hasConceptual;

  async function runGeneration(isRegen: boolean) {
    if (!conceptual) return;
    setBusy(true);
    setStatus(`${AGENT_LABEL} is designing your logical model…`);
    try {
      const res = await requestLogical({
        domain: logical.domain,
        domainLabel,
        projectName,
        brdText,
        conceptualModel: summarizeConceptual(conceptual),
        revisionNote: logical.revisionNote,
      });

      let doc: LogicalModel;
      let source: ResultSource;
      if (res.source === 'ai' && res.doc) {
        doc = sanitizeLogicalModel(coerceLogicalModel(res.doc)).model;
        source = 'ai';
      } else {
        doc = sanitizeLogicalModel(
          localLogicalFallback(conceptual, projectName, logical.revisionNote),
        ).model;
        source = 'fallback';
      }

      const bump = isRegen ? detectLogicalBump(logical.revisionNote) : 'minor';
      const label = addLogicalVersion(doc, source, bump);
      const provenance = source === 'ai' ? 'AI-generated' : 'Offline-generated';
      success(`Logical model v${label} ready (${provenance}).`);
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
    saveBlob(blob, `Logical_${safe}_v${activeVersion.label}.json`);
    success(`Downloaded the v${activeVersion.label} logical model JSON.`);
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Logical Data Modeler
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-content">
          Take it from concept to a <span className="text-accent-500">logical schema.</span>
        </h1>
        <p className="mt-3 text-base text-content-muted">
          The {AGENT_LABEL} turns your conceptual model into a rigorous, platform-agnostic logical
          model — typed attributes, single-column primary keys, and explicit foreign keys, with
          many-to-many links resolved into bridge tables.
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
            <h2 className="text-lg font-semibold text-content">Generate the logical model</h2>
          </div>

          <Select
            label="Domain"
            value={logical.domain}
            onChange={(e) => setLogicalDomain(e.target.value)}
            hint="Defaults to your conceptual model's domain. Steers naming conventions."
          >
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>

          <div className="rounded-lg border border-border bg-surface-muted/30 p-3 text-sm">
            <p className="font-medium text-content">Input: your conceptual model</p>
            {hasConceptual ? (
              <p className="mt-1 text-xs text-content-muted">
                Using the conceptual model{model.activeVersion ? ` v${model.activeVersion}` : ''} (
                {conceptual?.entities.length} entities) as the authoritative entity set for this
                logical model.
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No conceptual model yet — generate one in the <strong>Conceptual</strong> tab first;
                the logical model is built from it.
              </p>
            )}
          </div>

          <div>
            <label className="field-label">Revision request (optional)</label>
            <textarea
              value={logical.revisionNote}
              onChange={(e) => setLogicalRevisionNote(e.target.value)}
              rows={5}
              placeholder="e.g. Split Patient into Patient and Patient_Address. Use 'breaking' for a major version bump."
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <p className="field-hint">
              Folded into the next Regenerate. Include the word “breaking” for a major version bump.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => runGeneration(false)} disabled={busy || !hasConceptual}>
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
              <h2 className="text-lg font-semibold text-content">Your logical model</h2>
            </div>
            {logical.versions.length > 0 && activeVersion && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200">
                  v{activeVersion.label}
                </span>
                <select
                  value={logical.activeVersion ?? activeVersion.label}
                  onChange={(e) => setActiveLogicalVersion(e.target.value)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-content focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                  {logical.versions
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
              <LogicalOutput model={activeVersion.doc} validation={sanitized.validation} />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-8 text-center">
              <p className="text-sm font-medium text-content">Your logical model will appear here.</p>
              <p className="mt-1 text-sm text-content-muted">
                Click <strong>Generate model</strong> to turn the conceptual model into tables with
                typed columns, primary/foreign keys, and an ER diagram. Then refine with a revision
                request and regenerate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
