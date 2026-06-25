import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { useBannerStore } from '../../store/bannerStore';
import { summarizeBrd } from '../../lib/model';
import { sanitizeLogicalModel } from '../../lib/logical';
import {
  coercePhysicalModel,
  detectPhysicalBump,
  localPhysicalFallback,
  PLATFORMS,
  summarizeLogical,
} from '../../lib/physical';
import { requestPhysical } from '../../lib/api';
import { AGENT_LABEL } from '../../lib/agent';
import { domainById } from '../../config/domains';
import type { PhysicalModel, PhysicalPlatform, ResultSource } from '../../store/types';
import { Select } from '../ui/Field';
import { Button } from '../ui/Button';
import { PhysicalOutput } from './PhysicalOutput';

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

export function PhysicalGenerator() {
  const brd = useProjectStore((s) => s.project.brd);
  const logical = useProjectStore((s) => s.project.logical);
  const physical = useProjectStore((s) => s.project.physical);
  const setPhysicalPlatform = useProjectStore((s) => s.setPhysicalPlatform);
  const setPhysicalRevisionNote = useProjectStore((s) => s.setPhysicalRevisionNote);
  const addPhysicalVersion = useProjectStore((s) => s.addPhysicalVersion);
  const setActivePhysicalVersion = useProjectStore((s) => s.setActivePhysicalVersion);

  const aiConfigured = useRuntimeStore((s) => s.config.ai.configured);
  const success = useBannerStore((s) => s.success);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const logicalModel = useMemo(() => {
    const active =
      logical.versions.find((v) => v.label === logical.activeVersion) ??
      logical.versions[logical.versions.length - 1] ??
      null;
    return active ? sanitizeLogicalModel(active.doc).model : null;
  }, [logical]);
  const hasLogical = logicalModel !== null;

  const domainLabel = domainById(logical.domain)?.label ?? logical.domain;
  const projectName = brd.projectName;
  const latestBrd = brd.versions[brd.versions.length - 1]?.doc ?? null;
  const brdText = useMemo(() => summarizeBrd(brd, latestBrd), [brd, latestBrd]);

  const activeVersion =
    physical.versions.find((v) => v.label === physical.activeVersion) ??
    physical.versions[physical.versions.length - 1] ??
    null;

  const canRegenerate = physical.versions.length >= 1 && !busy && hasLogical;

  async function runGeneration(isRegen: boolean) {
    if (!logicalModel) return;
    setBusy(true);
    setStatus(`${AGENT_LABEL} is designing your physical model…`);
    try {
      const res = await requestPhysical({
        domain: logical.domain,
        domainLabel,
        projectName,
        brdText,
        logicalModel: summarizeLogical(logicalModel),
        platform: physical.platform,
        revisionNote: physical.revisionNote,
      });

      let doc: PhysicalModel;
      let source: ResultSource;
      if (res.source === 'ai' && res.doc) {
        doc = coercePhysicalModel(res.doc);
        source = 'ai';
      } else {
        doc = localPhysicalFallback(logicalModel, physical.platform, projectName);
        source = 'fallback';
      }

      const bump = isRegen ? detectPhysicalBump(physical.revisionNote) : 'minor';
      const label = addPhysicalVersion(doc, source, bump);
      const provenance = source === 'ai' ? 'AI-generated' : 'Offline-generated';
      success(`Physical model v${label} ready (${provenance}).`);
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
    saveBlob(blob, `Physical_${safe}_v${activeVersion.label}.json`);
    success(`Downloaded the v${activeVersion.label} physical model JSON.`);
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Physical Model (DDL)
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-content">
          Generate platform-specific <span className="text-accent-500">DDL.</span>
        </h1>
        <p className="mt-3 text-base text-content-muted">
          The {AGENT_LABEL} takes your logical model and produces runnable CREATE TABLE DDL for your
          target platform — Silver (cleansed, conformed) and Gold (dimensional star/snowflake with
          SCD2).
        </p>
        {!aiConfigured && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            AI service not connected — results use the offline fallback.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[45fr_55fr]">
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Inputs</p>
            <h2 className="text-lg font-semibold text-content">Configure & generate</h2>
          </div>

          <Select
            label="Target platform"
            value={physical.platform}
            onChange={(e) => setPhysicalPlatform(e.target.value as PhysicalPlatform)}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>

          <div className="rounded-lg border border-border bg-surface-muted/30 p-3 text-sm">
            <p className="font-medium text-content">Input: your logical model</p>
            {hasLogical ? (
              <p className="mt-1 text-xs text-content-muted">
                Using the logical model
                {logical.activeVersion ? ` v${logical.activeVersion}` : ''} (
                {logicalModel?.entities.length} entities) as the source for the physical layer.
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No logical model yet — generate one in the <strong>Logical</strong> tab first.
              </p>
            )}
          </div>

          <div>
            <label className="field-label">Revision request (optional)</label>
            <textarea
              value={physical.revisionNote}
              onChange={(e) => setPhysicalRevisionNote(e.target.value)}
              rows={4}
              placeholder="e.g. Add partitioning by date on the Encounter table. Use 'breaking' for a major bump."
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => runGeneration(false)} disabled={busy || !hasLogical}>
              Generate DDL
            </Button>
            <Button variant="secondary" onClick={() => runGeneration(true)} disabled={!canRegenerate}>
              Regenerate
            </Button>
            <Button variant="secondary" onClick={downloadJson} disabled={!activeVersion || busy}>
              Download JSON
            </Button>
          </div>

          {status && (
            <p className="text-xs text-content-muted animate-pulse">{status}</p>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Output</p>
              <h2 className="text-lg font-semibold text-content">Physical model</h2>
            </div>
            {physical.versions.length > 0 && activeVersion && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200">
                  v{activeVersion.label}
                </span>
                <select
                  value={physical.activeVersion ?? activeVersion.label}
                  onChange={(e) => setActivePhysicalVersion(e.target.value)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-content focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                  {[...physical.versions].reverse().map((v) => (
                    <option key={v.label} value={v.label}>
                      v{v.label} — {v.source === 'ai' ? 'AI' : 'Offline'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeVersion ? (
            <PhysicalOutput model={activeVersion.doc} />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border p-8 text-center text-sm text-content-muted">
              {hasLogical
                ? 'Click "Generate DDL" to produce Silver + Gold tables.'
                : 'Generate a logical model first, then come back here.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
