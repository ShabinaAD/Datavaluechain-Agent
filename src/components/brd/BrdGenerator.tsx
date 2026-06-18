import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { useBannerStore } from '../../store/bannerStore';
import { useBrdUploadStore } from '../../store/brdUploadStore';
import { DOMAINS, domainById } from '../../config/domains';
import {
  BRD_SECTIONS,
  brdFileName,
  coerceBrdDocument,
  detectBump,
  localBrdFallback,
} from '../../lib/brd';
import { requestBrd, downloadDocxOnServer } from '../../lib/api';
import { AGENT_LABEL } from '../../lib/agent';
import type { BrdDocument, BrdSectionId, ResultSource } from '../../store/types';
import { Select, TextInput } from '../ui/Field';
import { Button } from '../ui/Button';
import { FilePicker } from './FilePicker';
import { BrdOutput } from './BrdOutput';

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

/** Turn the partial comments map into a plain {section: text} for the prompt. */
function plainComments(comments: Partial<Record<BrdSectionId, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(comments)) {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}

export function BrdGenerator() {
  const brd = useProjectStore((s) => s.project.brd);
  const setBrdDomain = useProjectStore((s) => s.setBrdDomain);
  const setBrdProjectName = useProjectStore((s) => s.setBrdProjectName);
  const setBrdRequirement = useProjectStore((s) => s.setBrdRequirement);
  const setBrdOutputFolder = useProjectStore((s) => s.setBrdOutputFolder);
  const setBrdCreateFolder = useProjectStore((s) => s.setBrdCreateFolder);
  const setBrdComment = useProjectStore((s) => s.setBrdComment);
  const addBrdVersion = useProjectStore((s) => s.addBrdVersion);
  const setActiveBrdVersion = useProjectStore((s) => s.setActiveBrdVersion);

  const aiConfigured = useRuntimeStore((s) => s.config.ai.configured);
  const success = useBannerStore((s) => s.success);
  const error = useBannerStore((s) => s.error);

  const uploads = useBrdUploadStore();

  const [busy, setBusy] = useState<null | 'generating' | 'downloading'>(null);
  const [status, setStatus] = useState('');

  const domainLabel = domainById(brd.domain)?.label ?? brd.domain;
  const activeVersion =
    brd.versions.find((v) => v.label === brd.activeVersion) ??
    brd.versions[brd.versions.length - 1] ??
    null;

  // Workflow gating (spec 2.8.1): Generate needs a requirement; Regenerate needs
  // a first Generate; Download needs at least one Regenerate.
  const canGenerate = brd.requirement.trim().length > 0 && busy === null;
  const canRegenerate = brd.versions.length >= 1 && busy === null;
  const canDownload = brd.versions.length >= 2 && busy === null;

  async function runGeneration(isRegen: boolean) {
    if (!brd.requirement.trim()) {
      error('Add a requirement before generating the BRD.');
      return;
    }
    setBusy('generating');
    setStatus(`${AGENT_LABEL} is thinking…`);
    try {
      const res = await requestBrd({
        domain: brd.domain,
        requirement: brd.requirement,
        comments: plainComments(brd.comments),
      });

      let doc: BrdDocument;
      let source: ResultSource;
      if (res.source === 'ai' && res.doc) {
        doc = coerceBrdDocument(res.doc);
        source = 'ai';
      } else {
        doc = localBrdFallback(brd);
        source = 'fallback';
      }

      const bump = isRegen ? detectBump(brd.comments) : 'minor';
      const label = addBrdVersion(doc, source, bump);
      const provenance = source === 'ai' ? 'AI-generated' : 'Offline-generated';
      success(`BRD v${label} ready (${provenance}).`);
    } finally {
      setBusy(null);
      setStatus('');
    }
  }

  async function download() {
    if (!activeVersion) return;
    setBusy('downloading');
    setStatus('Preparing your document…');
    try {
      const fileName = brdFileName(brd, activeVersion.label);
      const meta = {
        projectName: brd.projectName,
        domainLabel,
        versionLabel: activeVersion.label,
        source: activeVersion.source,
      };
      const result = await downloadDocxOnServer({
        doc: activeVersion.doc,
        meta,
        fileName,
        outputFolder: brd.outputFolder,
        createFolder: brd.createFolder,
      });

      if (result.status === 'ok') {
        saveBlob(result.blob, fileName);
        success(
          result.savedPath
            ? `Saved ${fileName} to ${result.savedPath} and downloaded it.`
            : `Downloaded ${fileName}.`,
        );
      } else if (result.status === 'folder_error') {
        error(`Output folder problem: ${result.message} Update the folder and try again.`);
      } else if (result.status === 'server_unavailable') {
        // Offline: the browser can still produce the file, but cannot write to a
        // server folder. The (heavy) docx builder is loaded only on demand.
        const { buildBrdDocxBlob } = await import('../../lib/clientDocx');
        const blob = await buildBrdDocxBlob(activeVersion.doc, meta);
        saveBlob(blob, fileName);
        success(`Downloaded ${fileName}. (Offline — not saved to the output folder.)`);
      } else {
        error(result.message);
      }
    } finally {
      setBusy(null);
      setStatus('');
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero (spec 2.4.1) */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          BRD Generator
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-content">
          Describe what you're <span className="text-accent-500">building.</span>
        </h1>
        <p className="mt-3 text-base text-content-muted">
          Pick a domain, refine the requirement, and the {AGENT_LABEL} drafts a full Business
          Requirements Document you can review, revise, and export to Word.
        </p>
        {!aiConfigured && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            AI service not connected — results use the offline fallback.
          </p>
        )}
      </header>

      {/* Two-column workspace: 45% inputs / 55% output (spec 2.4.2) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[45fr_55fr]">
        {/* Left: configure */}
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Step 1</p>
            <h2 className="text-lg font-semibold text-content">Configure your project</h2>
          </div>

          <Select
            label="Domain"
            value={brd.domain}
            onChange={(e) => setBrdDomain(e.target.value)}
            hint="Picking a domain seeds a starter name and requirement you can edit."
          >
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>

          <TextInput
            label="Project name"
            value={brd.projectName}
            onChange={(e) => setBrdProjectName(e.target.value)}
            placeholder="e.g. Patient360_Phase1"
          />

          <div>
            <label className="field-label">Requirement</label>
            <textarea
              value={brd.requirement}
              onChange={(e) => setBrdRequirement(e.target.value)}
              rows={8}
              placeholder="Describe what you're building, the users, and the outcome…"
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <p className="field-hint">Required. The Generate button stays disabled until this has content.</p>
          </div>

          <FilePicker
            label="Input documents"
            hint="PDF, Word, PowerPoint, text, Markdown, CSV, Excel — held in memory only."
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.xls,.xlsx"
            multiple
            files={uploads.inputDocuments}
            onPick={uploads.addInputDocuments}
            onRemove={uploads.removeInputDocument}
          />

          <FilePicker
            label="Target BRD template (optional)"
            hint="A single Word document used to match your house style."
            accept=".doc,.docx"
            files={uploads.template ? [uploads.template] : []}
            onPick={(files) => uploads.setTemplate(files[0] ?? null)}
            onRemove={() => uploads.setTemplate(null)}
          />

          <FilePicker
            label="Source system DDL (optional)"
            hint="SQL files that give the data model real-world context."
            accept=".sql,.txt"
            multiple
            files={uploads.ddl}
            onPick={uploads.addDdl}
            onRemove={uploads.removeDdl}
          />

          <TextInput
            label="Output folder"
            value={brd.outputFolder}
            onChange={(e) => setBrdOutputFolder(e.target.value)}
            placeholder="~/Downloads/BRD"
          />
          <label className="flex items-center gap-2 text-sm text-content">
            <input
              type="checkbox"
              checked={brd.createFolder}
              onChange={(e) => setBrdCreateFolder(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
            />
            Create the folder if it doesn't exist
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => runGeneration(false)} disabled={!canGenerate}>
              Generate BRD
            </Button>
            <Button variant="secondary" onClick={() => runGeneration(true)} disabled={!canRegenerate}>
              Regenerate BRD
            </Button>
            <Button variant="secondary" onClick={download} disabled={!canDownload}>
              Download .docx
            </Button>
          </div>
        </div>

        {/* Right: output */}
        <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">Step 2</p>
              <h2 className="text-lg font-semibold text-content">Your BRD</h2>
            </div>
            {brd.versions.length > 0 && activeVersion && (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200">
                  v{activeVersion.label}
                </span>
                <select
                  value={brd.activeVersion ?? activeVersion.label}
                  onChange={(e) => setActiveBrdVersion(e.target.value)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-content focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                  {brd.versions
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

          {busy === 'generating' && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              {status || `${AGENT_LABEL} is thinking…`}
            </div>
          )}

          {activeVersion ? (
            <>
              <p className="text-xs text-content-muted">
                {activeVersion.source === 'ai' ? 'AI-generated' : 'Offline-generated'} ·{' '}
                {new Date(activeVersion.at).toLocaleString()}
              </p>
              <BrdOutput
                doc={activeVersion.doc}
                comments={brd.comments}
                onComment={setBrdComment}
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-8 text-center">
              <p className="text-sm font-medium text-content">Your BRD will appear here.</p>
              <p className="mt-1 text-sm text-content-muted">
                Fill in the requirement on the left, then click <strong>Generate BRD</strong>. You'll
                see all {BRD_SECTIONS.length} sections, then revise with per-section comments and
                regenerate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
