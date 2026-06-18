import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import type { BrdDocument } from '../store/types';

/**
 * Client-side .docx builder used only when the application server is
 * unreachable (e.g. the static preview). Mirrors the server's layout so the
 * downloaded file is consistent; the server additionally writes the file to the
 * user's output folder, which the browser cannot do.
 */
export interface DocxMeta {
  projectName?: string;
  domainLabel?: string;
  versionLabel?: string;
  source?: 'ai' | 'fallback';
}

function heading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
}

function para(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text ?? '')], spacing: { after: 120 } });
}

function bullets(items: string[]): Paragraph[] {
  if (!items || items.length === 0) return [para('—')];
  return items.map((t) => new Paragraph({ text: t, bullet: { level: 0 } }));
}

function cell(text: string, bold = false, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: text ?? '', bold })] })],
  });
}

function table(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => cell(h, true)),
  });
  const bodyRows =
    rows.length > 0
      ? rows.map((cols) => new TableRow({ children: cols.map((c) => cell(c)) }))
      : [new TableRow({ children: headers.map(() => cell('—')) })];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
}

function twoColumns(
  leftTitle: string,
  leftItems: string[],
  rightTitle: string,
  rightItems: string[],
): Table {
  const list = (items: string[]) =>
    (items && items.length ? items : ['—']).map((t) => new Paragraph({ text: t, bullet: { level: 0 } }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [cell(leftTitle, true, 50), cell(rightTitle, true, 50)],
      }),
      new TableRow({
        children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: list(leftItems) }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: list(rightItems) }),
        ],
      }),
    ],
  });
}

export async function buildBrdDocxBlob(doc: BrdDocument, meta: DocxMeta): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Business Requirements Document')] }),
  );
  children.push(
    para(
      [
        meta.projectName ? `Project: ${meta.projectName}` : null,
        meta.domainLabel ? `Domain: ${meta.domainLabel}` : null,
        meta.versionLabel ? `Version: v${meta.versionLabel}` : null,
        meta.source === 'fallback' ? 'Generated offline (AI service unavailable)' : null,
      ]
        .filter(Boolean)
        .join('   |   '),
    ),
  );

  children.push(heading('Executive Summary'), para(doc.executiveSummary));
  children.push(heading('Business Objectives'), ...bullets(doc.businessObjectives));
  children.push(heading('Scope'), twoColumns('In Scope', doc.scope.inScope, 'Out of Scope', doc.scope.outOfScope));
  children.push(
    heading('Stakeholders'),
    table(['Name', 'Role', 'Responsibility'], doc.stakeholders.map((s) => [s.name, s.role, s.responsibility])),
  );
  children.push(
    heading('Functional Requirements'),
    table(
      ['ID', 'Title', 'Description', 'Priority'],
      doc.functionalRequirements.map((r) => [r.id, r.title, r.description, r.priority]),
    ),
  );
  children.push(
    heading('Non-Functional Requirements'),
    table(
      ['Category', 'Requirement', 'Target'],
      doc.nonFunctionalRequirements.map((r) => [r.category, r.requirement, r.target]),
    ),
  );
  children.push(heading('Data Model'), para(doc.dataModel.overview));
  for (const e of doc.dataModel.entities) {
    children.push(new Paragraph({ children: [new TextRun({ text: e.name, bold: true })], spacing: { before: 80 } }));
    children.push(...bullets(e.attributes));
  }
  children.push(
    heading('Integrations'),
    table(
      ['System', 'Direction', 'Protocol', 'Description'],
      doc.integrations.map((it) => [it.system, it.direction, it.protocol, it.description]),
    ),
  );
  children.push(
    heading('Assumptions & Constraints'),
    twoColumns('Assumptions', doc.assumptions, 'Constraints', doc.constraints),
  );
  children.push(
    heading('Risks & Mitigations'),
    table(
      ['Risk', 'Impact', 'Likelihood', 'Mitigation'],
      doc.risks.map((r) => [r.risk, r.impact, r.likelihood, r.mitigation]),
    ),
  );
  children.push(heading('Timeline & Milestones'));
  for (const m of doc.milestones) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `${m.name} — ${m.targetDate}`, bold: true })], spacing: { before: 80 } }),
    );
    children.push(...bullets(m.deliverables));
  }
  children.push(heading('Acceptance Criteria'), ...bullets(doc.acceptanceCriteria));

  const document = new Document({ sections: [{ children }] });
  return Packer.toBlob(document);
}
