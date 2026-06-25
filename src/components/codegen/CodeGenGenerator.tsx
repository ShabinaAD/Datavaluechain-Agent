import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { useBannerStore } from '../../store/bannerStore';
import { AGENT_LABEL } from '../../lib/agent';
import {
  codeFileName,
  defaultLanguage,
  generatePipelineCode,
  PLATFORM_LANGUAGES,
  STAGE_LABELS,
} from '../../lib/codegen';
import { PLATFORMS } from '../../lib/physical';
import { requestCodeGen } from '../../lib/api';
import type { CodeGenStage, PhysicalPlatform } from '../../store/types';
import { Select } from '../ui/Field';
import { Button } from '../ui/Button';

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

export function CodeGenGenerator() {
  const physical = useProjectStore((s) => s.project.physical);
  const codegen = useProjectStore((s) => s.project.codegen);
  const setCodeGenPlatform = useProjectStore((s) => s.setCodeGenPlatform);
  const setCodeGenLanguage = useProjectStore((s) => s.setCodeGenLanguage);
  const setCodeGenRevisionNote = useProjectStore((s) => s.setCodeGenRevisionNote);
  const addCodeGenFile = useProjectStore((s) => s.addCodeGenFile);

  const aiConfigured = useRuntimeStore((s) => s.config.ai.configured);
  const success = useBannerStore((s) => s.success);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [activeStage, setActiveStage] = useState<CodeGenStage>('source-to-bronze');

  const physicalModel = useMemo(() => {
    const active =
      physical.versions.find((v) => v.label === physical.activeVersion) ??
      physical.versions[physical.versions.length - 1] ??
      null;
    return active?.doc ?? null;
  }, [physical]);
  const hasPhysical = physicalModel !== null;

  const languages = PLATFORM_LANGUAGES[codegen.platform] ?? ['SQL'];

  const stageFiles = codegen.files.filter((f) => f.stage === activeStage);
  const latestFile = stageFiles[stageFiles.length - 1] ?? null;

  async function runGeneration(stage: CodeGenStage) {
    if (!physicalModel) return;
    setBusy(true);
    setStatus(`${AGENT_LABEL} is writing ${STAGE_LABELS[stage]} code…`);
    try {
      const res = await requestCodeGen({
        stage,
        platform: codegen.platform,
        language: codegen.language,
        physicalModel: JSON.stringify(physicalModel),
        revisionNote: codegen.revisionNote,
      });

      let code: string;
      let source: 'ai' | 'fallback';
      if (res.source === 'ai' && res.code) {
        code = res.code;
        source = 'ai';
      } else {
        code = generatePipelineCode(stage, physicalModel, codegen.platform, codegen.language);
        source = 'fallback';
      }

      const fileName = codeFileName(stage, codegen.platform, codegen.language);
      addCodeGenFile({
        stage,
        platform: codegen.platform,
        language: codegen.language,
        fileName,
        code,
        source,
        at: Date.now(),
      });

      const provenance = source === 'ai' ? 'AI-generated' : 'Offline-generated';
      success(`${STAGE_LABELS[stage]} code ready (${provenance}).`);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  function downloadCode() {
    if (!latestFile) return;
    const blob = new Blob([latestFile.code], { type: 'text/plain' });
    saveBlob(blob, latestFile.fileName);
    success(`Downloaded ${latestFile.fileName}.`);
  }

  const stages: CodeGenStage[] = ['source-to-bronze', 'bronze-to-silver', 'silver-to-gold'];

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Code Generator
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-content">
          Generate <span className="text-accent-500">pipeline code.</span>
        </h1>
        <p className="mt-3 text-base text-content-muted">
          The {AGENT_LABEL} turns your physical model into production-grade medallion pipeline code —
          Source → Bronze → Silver → Gold — in your platform's native language.
        </p>
        {!aiConfigured && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            AI service not connected — results use the offline fallback.
          </p>
        )}
      </header>

      {/* Platform / Language config */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select
          label="Platform"
          value={codegen.platform}
          onChange={(e) => {
            const p = e.target.value as PhysicalPlatform;
            setCodeGenPlatform(p);
            setCodeGenLanguage(defaultLanguage(p));
          }}
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
        <Select
          label="Language"
          value={codegen.language}
          onChange={(e) => setCodeGenLanguage(e.target.value)}
        >
          {languages.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </Select>
        <div>
          <label className="field-label">Guidance (optional)</label>
          <textarea
            value={codegen.revisionNote}
            onChange={(e) => setCodeGenRevisionNote(e.target.value)}
            rows={2}
            placeholder="e.g. Add retry logic, use specific schema names…"
            className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      </div>

      {!hasPhysical && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Generate a physical model first (Data Modeling → Physical tab), then come back here.
        </div>
      )}

      {/* Stage sub-tabs */}
      <div className="inline-flex rounded-lg border border-border bg-surface-muted/40 p-1">
        {stages.map((s) => {
          const count = codegen.files.filter((f) => f.stage === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveStage(s)}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeStage === s
                  ? 'bg-surface text-content shadow-sm'
                  : 'text-content-muted hover:text-content'
              }`}
            >
              {STAGE_LABELS[s]}
              {count > 0 && (
                <span className="rounded-full bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Generate + output */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[40fr_60fr]">
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-semibold text-content">{STAGE_LABELS[activeStage]}</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runGeneration(activeStage)} disabled={busy || !hasPhysical}>
              Generate code
            </Button>
            <Button variant="secondary" onClick={downloadCode} disabled={!latestFile || busy}>
              Download
            </Button>
          </div>
          {status && <p className="text-xs text-content-muted animate-pulse">{status}</p>}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          {latestFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-content">{latestFile.fileName}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  latestFile.source === 'ai'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : 'bg-stone-100 text-stone-600 dark:bg-stone-900/50 dark:text-stone-300'
                }`}>
                  {latestFile.source === 'ai' ? 'AI-generated' : 'Offline-generated'}
                </span>
              </div>
              <pre className="max-h-[500px] overflow-auto rounded-lg bg-stone-900 px-4 py-3 text-xs leading-relaxed text-stone-200">
                {latestFile.code}
              </pre>
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-content-muted">
              {hasPhysical
                ? `Click "Generate code" to produce ${STAGE_LABELS[activeStage]} pipeline code.`
                : 'Generate a physical model first.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
