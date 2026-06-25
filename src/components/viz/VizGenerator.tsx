import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { useBannerStore } from '../../store/bannerStore';
import { AGENT_LABEL } from '../../lib/agent';
import { coerceVizDashboard, detectVizBump, localVizFallback } from '../../lib/vizgen';
import { requestVizGen } from '../../lib/api';
import type { ResultSource, VizDashboard } from '../../store/types';
import { Button } from '../ui/Button';
import { VizOutput } from './VizOutput';

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

export function VizGenerator() {
  const brd = useProjectStore((s) => s.project.brd);
  const physical = useProjectStore((s) => s.project.physical);
  const viz = useProjectStore((s) => s.project.viz);
  const setVizRevisionNote = useProjectStore((s) => s.setVizRevisionNote);
  const addVizVersion = useProjectStore((s) => s.addVizVersion);
  const setActiveVizVersion = useProjectStore((s) => s.setActiveVizVersion);

  const aiConfigured = useRuntimeStore((s) => s.config.ai.configured);
  const success = useBannerStore((s) => s.success);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const physicalModel = useMemo(() => {
    const active =
      physical.versions.find((v) => v.label === physical.activeVersion) ??
      physical.versions[physical.versions.length - 1] ??
      null;
    return active?.doc ?? null;
  }, [physical]);
  const hasPhysical = physicalModel !== null;
  const projectName = brd.projectName;

  const activeVersion =
    viz.versions.find((v) => v.label === viz.activeVersion) ??
    viz.versions[viz.versions.length - 1] ??
    null;

  const canRegenerate = viz.versions.length >= 1 && !busy && hasPhysical;

  async function runGeneration(isRegen: boolean) {
    if (!physicalModel) return;
    setBusy(true);
    setStatus(`${AGENT_LABEL} is designing your dashboard…`);
    try {
      const res = await requestVizGen({
        domain: physicalModel.domain,
        projectName,
        physicalModel: JSON.stringify(physicalModel),
        revisionNote: viz.revisionNote,
      });

      let doc: VizDashboard;
      let source: ResultSource;
      if (res.source === 'ai' && res.doc) {
        doc = coerceVizDashboard(res.doc);
        source = 'ai';
      } else {
        doc = localVizFallback(physicalModel, projectName);
        source = 'fallback';
      }

      const bump = isRegen ? detectVizBump(viz.revisionNote) : 'minor';
      const label = addVizVersion(doc, source, bump);
      const provenance = source === 'ai' ? 'AI-generated' : 'Offline-generated';
      success(`Dashboard spec v${label} ready (${provenance}).`);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  function downloadJson() {
    if (!activeVersion) return;
    const safe = (projectName || 'dashboard').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const blob = new Blob([JSON.stringify(activeVersion.doc, null, 2)], {
      type: 'application/json',
    });
    saveBlob(blob, `Dashboard_${safe}_v${activeVersion.label}.json`);
    success(`Downloaded the v${activeVersion.label} dashboard spec JSON.`);
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Dashboard Design
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-content">
          Design your <span className="text-accent-500">dashboard.</span>
        </h1>
        <p className="mt-3 text-base text-content-muted">
          The {AGENT_LABEL} reads your physical model (Gold layer) and produces a dashboard
          specification — KPI cards, charts, and data tables — ready to implement.
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

          <div className="rounded-lg border border-border bg-surface-muted/30 p-3 text-sm">
            <p className="font-medium text-content">Input: your physical model</p>
            {hasPhysical ? (
              <p className="mt-1 text-xs text-content-muted">
                Using the physical model
                {physical.activeVersion ? ` v${physical.activeVersion}` : ''} (
                {physicalModel.platform}, {physicalModel.gold.length} Gold tables).
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No physical model yet — generate one in <strong>Data Modeling → Physical</strong> first.
              </p>
            )}
          </div>

          <div>
            <label className="field-label">Revision request (optional)</label>
            <textarea
              value={viz.revisionNote}
              onChange={(e) => setVizRevisionNote(e.target.value)}
              rows={4}
              placeholder="e.g. Add a trend chart for monthly volume. Use 'breaking' for a major bump."
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => runGeneration(false)} disabled={busy || !hasPhysical}>
              Generate dashboard
            </Button>
            <Button variant="secondary" onClick={() => runGeneration(true)} disabled={!canRegenerate}>
              Regenerate
            </Button>
            <Button variant="secondary" onClick={downloadJson} disabled={!activeVersion || busy}>
              Download JSON
            </Button>
          </div>

          {status && <p className="text-xs text-content-muted animate-pulse">{status}</p>}
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Output</p>
              <h2 className="text-lg font-semibold text-content">Dashboard spec</h2>
            </div>
            {viz.versions.length > 0 && activeVersion && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200">
                  v{activeVersion.label}
                </span>
                <select
                  value={viz.activeVersion ?? activeVersion.label}
                  onChange={(e) => setActiveVizVersion(e.target.value)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-content focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                  {[...viz.versions].reverse().map((v) => (
                    <option key={v.label} value={v.label}>
                      v{v.label} — {v.source === 'ai' ? 'AI' : 'Offline'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeVersion ? (
            <VizOutput dashboard={activeVersion.doc} />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border p-8 text-center text-sm text-content-muted">
              {hasPhysical
                ? 'Click "Generate dashboard" to produce a dashboard specification.'
                : 'Generate a physical model first, then come back here.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
