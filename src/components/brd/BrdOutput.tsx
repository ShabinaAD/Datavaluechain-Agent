import type { ReactNode } from 'react';
import type { BrdDocument, BrdSectionId } from '../../store/types';
import { BRD_SECTIONS } from '../../lib/brd';

/**
 * Renders a generated BRD as the twelve named sections, in order (spec 2.6.2).
 * Every section carries its own "Reviewer comment" box (2.6.4); the comments are
 * sent to the agent on the next Regenerate.
 */
export function BrdOutput({
  doc,
  comments,
  onComment,
}: {
  doc: BrdDocument;
  comments: Partial<Record<BrdSectionId, string>>;
  onComment: (section: BrdSectionId, value: string) => void;
}) {
  return (
    <div className="space-y-5">
      {BRD_SECTIONS.map((meta) => (
        <Section
          key={meta.id}
          title={meta.title}
          comment={comments[meta.id] ?? ''}
          onComment={(v) => onComment(meta.id, v)}
        >
          {renderSection(meta.id, doc)}
        </Section>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
  comment,
  onComment,
}: {
  title: string;
  children: ReactNode;
  comment: string;
  onComment: (value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-content">{title}</h3>
      <div className="text-sm text-content">{children}</div>
      <div className="mt-3 border-t border-border pt-3">
        <label className="mb-1 block text-xs font-medium text-content-muted">Reviewer comment</label>
        <textarea
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          rows={2}
          placeholder="e.g. expand the data model with more entities"
          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-content placeholder:text-content-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        />
      </div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-content-muted">—</p>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function TwoCol({
  leftTitle,
  left,
  rightTitle,
  right,
}: {
  leftTitle: string;
  left: string[];
  rightTitle: string;
  right: string[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-semibold text-content-muted">{leftTitle}</p>
        <Bullets items={left} />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-content-muted">{rightTitle}</p>
        <Bullets items={right} />
      </div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="border border-border bg-surface-muted px-2 py-1 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="border border-border px-2 py-1 text-content-muted" colSpan={headers.length}>
                —
              </td>
            </tr>
          ) : (
            rows.map((cols, i) => (
              <tr key={i}>
                {cols.map((c, j) => (
                  <td key={j} className="border border-border px-2 py-1 align-top">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function renderSection(id: BrdSectionId, doc: BrdDocument): ReactNode {
  switch (id) {
    case 'executiveSummary':
      return <p>{doc.executiveSummary || '—'}</p>;
    case 'businessObjectives':
      return <Bullets items={doc.businessObjectives} />;
    case 'scope':
      return (
        <TwoCol
          leftTitle="In Scope"
          left={doc.scope.inScope}
          rightTitle="Out of Scope"
          right={doc.scope.outOfScope}
        />
      );
    case 'stakeholders':
      return (
        <Table
          headers={['Name', 'Role', 'Responsibility']}
          rows={doc.stakeholders.map((s) => [s.name, s.role, s.responsibility])}
        />
      );
    case 'functionalRequirements':
      return (
        <Table
          headers={['ID', 'Title', 'Description', 'Priority']}
          rows={doc.functionalRequirements.map((r) => [r.id, r.title, r.description, r.priority])}
        />
      );
    case 'nonFunctionalRequirements':
      return (
        <Table
          headers={['Category', 'Requirement', 'Target']}
          rows={doc.nonFunctionalRequirements.map((r) => [r.category, r.requirement, r.target])}
        />
      );
    case 'dataModel':
      return (
        <div className="space-y-2">
          <p>{doc.dataModel.overview || '—'}</p>
          {doc.dataModel.entities.map((e, i) => (
            <div key={i}>
              <p className="font-medium">{e.name}</p>
              <Bullets items={e.attributes} />
            </div>
          ))}
        </div>
      );
    case 'integrations':
      return (
        <Table
          headers={['System', 'Direction', 'Protocol', 'Description']}
          rows={doc.integrations.map((it) => [it.system, it.direction, it.protocol, it.description])}
        />
      );
    case 'assumptionsConstraints':
      return (
        <TwoCol
          leftTitle="Assumptions"
          left={doc.assumptions}
          rightTitle="Constraints"
          right={doc.constraints}
        />
      );
    case 'risks':
      return (
        <Table
          headers={['Risk', 'Impact', 'Likelihood', 'Mitigation']}
          rows={doc.risks.map((r) => [r.risk, r.impact, r.likelihood, r.mitigation])}
        />
      );
    case 'timeline':
      return (
        <div className="space-y-2">
          {doc.milestones.length === 0 ? (
            <p className="text-content-muted">—</p>
          ) : (
            doc.milestones.map((m, i) => (
              <div key={i}>
                <p className="font-medium">
                  {m.name} <span className="text-content-muted">· {m.targetDate}</span>
                </p>
                <Bullets items={m.deliverables} />
              </div>
            ))
          )}
        </div>
      );
    case 'acceptanceCriteria':
      return <Bullets items={doc.acceptanceCriteria} />;
    default:
      return null;
  }
}
