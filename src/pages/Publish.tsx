import { useMemo, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useBannerStore } from '../store/bannerStore';
import type { ReviewVerdict } from '../store/types';
import { Button } from '../components/ui/Button';

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

type ArtefactSummary = {
  id: string;
  label: string;
  versions: number;
  latestVersion: string;
  source: string;
  detail: string;
};

const VERDICT_LABELS: Record<ReviewVerdict, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
};
const VERDICT_COLORS: Record<ReviewVerdict, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200',
  skipped: 'bg-stone-100 text-stone-600 dark:bg-stone-900/50 dark:text-stone-300',
};

export function Publish() {
  const project = useProjectStore((s) => s.project);
  const review = project.review;
  const addReview = useProjectStore((s) => s.addReview);
  const setReviewVerdict = useProjectStore((s) => s.setReviewVerdict);
  const setReleaseNotes = useProjectStore((s) => s.setReleaseNotes);
  const setSignedOff = useProjectStore((s) => s.setSignedOff);
  const success = useBannerStore((s) => s.success);

  const [reviewer, setReviewer] = useState('');

  const artefacts = useMemo<ArtefactSummary[]>(() => {
    const list: ArtefactSummary[] = [];

    if (project.brd.versions.length > 0) {
      const latest = project.brd.versions[project.brd.versions.length - 1];
      list.push({
        id: 'brd',
        label: 'Business Requirements Document',
        versions: project.brd.versions.length,
        latestVersion: latest.label,
        source: latest.source,
        detail: `${Object.keys(latest.doc).length} sections`,
      });
    }

    if (project.model.versions.length > 0) {
      const latest = project.model.versions[project.model.versions.length - 1];
      list.push({
        id: 'conceptual',
        label: 'Conceptual Data Model',
        versions: project.model.versions.length,
        latestVersion: latest.label,
        source: latest.source,
        detail: `${latest.doc.entities?.length ?? 0} entities, ${latest.doc.relationships?.length ?? 0} relationships`,
      });
    }

    if (project.logical.versions.length > 0) {
      const latest = project.logical.versions[project.logical.versions.length - 1];
      list.push({
        id: 'logical',
        label: 'Logical Data Model',
        versions: project.logical.versions.length,
        latestVersion: latest.label,
        source: latest.source,
        detail: `${latest.doc.entities?.length ?? 0} entities, ${latest.doc.relationships?.length ?? 0} relationships`,
      });
    }

    if (project.physical.versions.length > 0) {
      const latest = project.physical.versions[project.physical.versions.length - 1];
      list.push({
        id: 'physical',
        label: 'Physical Data Model (DDL)',
        versions: project.physical.versions.length,
        latestVersion: latest.label,
        source: latest.source,
        detail: `${latest.doc.silver?.length ?? 0} Silver + ${latest.doc.gold?.length ?? 0} Gold tables (${latest.doc.platform})`,
      });
    }

    if (project.codegen.files.length > 0) {
      const stages = new Set(project.codegen.files.map((f) => f.stage));
      list.push({
        id: 'codegen',
        label: 'Pipeline Code',
        versions: project.codegen.files.length,
        latestVersion: `${project.codegen.files.length} files`,
        source: project.codegen.files[project.codegen.files.length - 1].source,
        detail: `${stages.size} stage(s), ${project.codegen.platform}, ${project.codegen.language}`,
      });
    }

    if (project.viz.versions.length > 0) {
      const latest = project.viz.versions[project.viz.versions.length - 1];
      list.push({
        id: 'viz',
        label: 'Dashboard Design',
        versions: project.viz.versions.length,
        latestVersion: latest.label,
        source: latest.source,
        detail: `${latest.doc.widgets?.length ?? 0} widgets, layout: ${latest.doc.layout}`,
      });
    }

    return list;
  }, [project]);

  const existingReviews = review.reviews;
  const getVerdict = (artefactId: string): ReviewVerdict => {
    const r = existingReviews.find((rev) => rev.artefact === artefactId);
    return r?.verdict ?? 'pending';
  };

  function handleVerdictEvent(artefactId: string, verdict: ReviewVerdict) {
    const existing = existingReviews.find((r) => r.artefact === artefactId);
    if (existing) {
      setReviewVerdict(artefactId, verdict);
    } else {
      addReview({
        artefact: artefactId,
        verdict,
        reviewer: reviewer || 'anonymous',
        note: '',
        at: 0,
      });
    }
  }

  const allReviewed = artefacts.length > 0 && artefacts.every((a) => {
    const v = getVerdict(a.id);
    return v === 'approved' || v === 'skipped';
  });

  function downloadAll() {
    const bundle: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      projectName: project.name,
      releaseNotes: review.releaseNotes,
      signedOff: review.signedOff,
      reviews: review.reviews,
    };

    if (project.brd.versions.length > 0) {
      bundle.brd = project.brd.versions[project.brd.versions.length - 1].doc;
    }
    if (project.model.versions.length > 0) {
      bundle.conceptualModel = project.model.versions[project.model.versions.length - 1].doc;
    }
    if (project.logical.versions.length > 0) {
      bundle.logicalModel = project.logical.versions[project.logical.versions.length - 1].doc;
    }
    if (project.physical.versions.length > 0) {
      bundle.physicalModel = project.physical.versions[project.physical.versions.length - 1].doc;
    }
    if (project.codegen.files.length > 0) {
      bundle.codeGenFiles = project.codegen.files;
    }
    if (project.viz.versions.length > 0) {
      bundle.dashboard = project.viz.versions[project.viz.versions.length - 1].doc;
    }

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const safe = (project.name || 'project').replace(/[^a-zA-Z0-9_-]+/g, '_');
    saveBlob(blob, `${safe}_artefact_bundle.json`);
    success('Downloaded all artefacts as JSON bundle.');
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          Review & Publish
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-content">
          Review all <span className="text-accent-500">artefacts.</span>
        </h1>
        <p className="mt-3 text-base text-content-muted">
          Review every generated artefact across the data value chain, sign off, and download the
          complete bundle.
        </p>
      </header>

      {/* Artefact summary */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold text-content">Artefact Summary</h2>
        {artefacts.length === 0 ? (
          <p className="mt-3 text-sm text-content-muted">
            No artefacts generated yet. Use the other tabs to produce BRDs, data models, code, and dashboards.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-content-muted">
                  <th className="pb-2 pr-4">Artefact</th>
                  <th className="pb-2 pr-4">Versions</th>
                  <th className="pb-2 pr-4">Latest</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2 pr-4">Detail</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {artefacts.map((a) => {
                  const verdict = getVerdict(a.id);
                  return (
                    <tr key={a.id} className="text-content">
                      <td className="py-2 pr-4 font-medium">{a.label}</td>
                      <td className="py-2 pr-4">{a.versions}</td>
                      <td className="py-2 pr-4">v{a.latestVersion}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          a.source === 'ai'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
                            : 'bg-stone-100 text-stone-600 dark:bg-stone-900/50 dark:text-stone-300'
                        }`}>
                          {a.source === 'ai' ? 'AI' : 'Offline'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-content-muted">{a.detail}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_COLORS[verdict]}`}>
                            {VERDICT_LABELS[verdict]}
                          </span>
                          <select
                            value={verdict}
                            onChange={(e) => handleVerdictEvent(a.id, e.target.value as ReviewVerdict)}
                            className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-content"
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approve</option>
                            <option value="rejected">Reject</option>
                            <option value="skipped">Skip</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reviewer & Sign-off */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-lg font-semibold text-content">Sign-off</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Reviewer name</label>
            <input
              type="text"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="field-label">Release notes</label>
            <textarea
              value={review.releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              rows={3}
              placeholder="Summary of this release…"
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setSignedOff(true);
              success('All artefacts signed off!');
            }}
            disabled={!allReviewed || review.signedOff}
          >
            {review.signedOff ? 'Signed off' : 'Sign off & approve'}
          </Button>
          <Button variant="secondary" onClick={downloadAll} disabled={artefacts.length === 0}>
            Download all artefacts
          </Button>
          {!allReviewed && artefacts.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Approve or skip all artefacts above before signing off.
            </p>
          )}
          {review.signedOff && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
              Signed off
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
