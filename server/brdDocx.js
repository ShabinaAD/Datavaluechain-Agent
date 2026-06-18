// @ts-nocheck
/**
 * Builds a Word (.docx) document from a structured BRD (spec 2.6.2 / 2.7.3).
 *
 * The section order here mirrors the on-screen output exactly. Tables are used
 * for the structured sections (stakeholders, requirements, integrations, risks)
 * so the exported file is presentable without further editing.
 */
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
  AlignmentType,
} from 'docx';

function heading(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } });
}

function para(text) {
  return new Paragraph({ children: [new TextRun(String(text ?? ''))], spacing: { after: 120 } });
}

function bullets(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [para('—')];
  return list.map((t) => new Paragraph({ text: String(t), bullet: { level: 0 } }));
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold })] })],
  });
}

function table(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => cell(h, { bold: true })),
  });
  const bodyRows =
    rows.length > 0
      ? rows.map((cols) => new TableRow({ children: cols.map((c) => cell(c)) }))
      : [new TableRow({ children: headers.map(() => cell('—')) })];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

function twoColumns(leftTitle, leftItems, rightTitle, rightItems) {
  const toCellList = (items) =>
    (Array.isArray(items) && items.length ? items : ['—']).map(
      (t) => new Paragraph({ text: String(t), bullet: { level: 0 } }),
    );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [cell(leftTitle, { bold: true, width: 50 }), cell(rightTitle, { bold: true, width: 50 })],
      }),
      new TableRow({
        children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: toCellList(leftItems) }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: toCellList(rightItems) }),
        ],
      }),
    ],
  });
}

export function buildBrdDocument(doc, meta = {}) {
  const children = [];

  // Title block
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: `Business Requirements Document` })],
    }),
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

  // 1. Executive Summary
  children.push(heading('Executive Summary'));
  children.push(para(doc.executiveSummary));

  // 2. Business Objectives
  children.push(heading('Business Objectives'));
  children.push(...bullets(doc.businessObjectives));

  // 3. Scope
  children.push(heading('Scope'));
  children.push(twoColumns('In Scope', doc.scope?.inScope, 'Out of Scope', doc.scope?.outOfScope));

  // 4. Stakeholders
  children.push(heading('Stakeholders'));
  children.push(
    table(
      ['Name', 'Role', 'Responsibility'],
      (doc.stakeholders ?? []).map((s) => [s.name, s.role, s.responsibility]),
    ),
  );

  // 5. Functional Requirements
  children.push(heading('Functional Requirements'));
  children.push(
    table(
      ['ID', 'Title', 'Description', 'Priority'],
      (doc.functionalRequirements ?? []).map((r) => [r.id, r.title, r.description, r.priority]),
    ),
  );

  // 6. Non-Functional Requirements
  children.push(heading('Non-Functional Requirements'));
  children.push(
    table(
      ['Category', 'Requirement', 'Target'],
      (doc.nonFunctionalRequirements ?? []).map((r) => [r.category, r.requirement, r.target]),
    ),
  );

  // 7. Data Model
  children.push(heading('Data Model'));
  children.push(para(doc.dataModel?.overview));
  for (const e of doc.dataModel?.entities ?? []) {
    children.push(new Paragraph({ children: [new TextRun({ text: e.name, bold: true })], spacing: { before: 80 } }));
    children.push(...bullets(e.attributes));
  }

  // 8. Integrations
  children.push(heading('Integrations'));
  children.push(
    table(
      ['System', 'Direction', 'Protocol', 'Description'],
      (doc.integrations ?? []).map((it) => [it.system, it.direction, it.protocol, it.description]),
    ),
  );

  // 9. Assumptions & Constraints
  children.push(heading('Assumptions & Constraints'));
  children.push(twoColumns('Assumptions', doc.assumptions, 'Constraints', doc.constraints));

  // 10. Risks & Mitigations
  children.push(heading('Risks & Mitigations'));
  children.push(
    table(
      ['Risk', 'Impact', 'Likelihood', 'Mitigation'],
      (doc.risks ?? []).map((r) => [r.risk, r.impact, r.likelihood, r.mitigation]),
    ),
  );

  // 11. Timeline & Milestones
  children.push(heading('Timeline & Milestones'));
  for (const m of doc.milestones ?? []) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${m.name} — ${m.targetDate}`, bold: true })],
        spacing: { before: 80 },
      }),
    );
    children.push(...bullets(m.deliverables));
  }

  // 12. Acceptance Criteria
  children.push(heading('Acceptance Criteria'));
  children.push(...bullets(doc.acceptanceCriteria));

  return new Document({ sections: [{ children }] });
}

export async function brdToDocxBuffer(doc, meta) {
  return Packer.toBuffer(buildBrdDocument(doc, meta));
}
