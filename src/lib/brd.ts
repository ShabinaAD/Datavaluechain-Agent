import type {
  BrdDocument,
  BrdSectionId,
  BrdState,
  BrdEntity,
  BrdMilestone,
} from '../store/types';
import { domainById } from '../config/domains';

/**
 * BRD content engine (spec 2.x).
 *
 * Two ways a BRD is produced:
 *   1. The server-backed agent (AI) returns structured JSON, validated by
 *      `coerceBrdDocument` so a malformed payload can never crash the UI.
 *   2. A deterministic, domain-aware offline fallback (`localBrdFallback`) that
 *      always produces a complete, reasonable document with no AI at all
 *      (spec 2.8.4). The result is labelled "Offline-generated".
 *
 * Reviewer comments are woven into the relevant section so a regenerate visibly
 * changes that section (spec 2.10).
 */

export interface BrdSectionMeta {
  id: BrdSectionId;
  title: string;
}

/** The twelve named sections, in the exact render/export order (spec 2.6.2). */
export const BRD_SECTIONS: BrdSectionMeta[] = [
  { id: 'executiveSummary', title: 'Executive Summary' },
  { id: 'businessObjectives', title: 'Business Objectives' },
  { id: 'scope', title: 'Scope' },
  { id: 'stakeholders', title: 'Stakeholders' },
  { id: 'functionalRequirements', title: 'Functional Requirements' },
  { id: 'nonFunctionalRequirements', title: 'Non-Functional Requirements' },
  { id: 'dataModel', title: 'Data Model' },
  { id: 'integrations', title: 'Integrations' },
  { id: 'assumptionsConstraints', title: 'Assumptions & Constraints' },
  { id: 'risks', title: 'Risks & Mitigations' },
  { id: 'timeline', title: 'Timeline & Milestones' },
  { id: 'acceptanceCriteria', title: 'Acceptance Criteria' },
];

/**
 * A regenerate is a "breaking" (major) bump when any reviewer comment uses the
 * word "breaking" (spec 2.7.2); otherwise it's a normal minor bump.
 */
export function detectBump(comments: Partial<Record<BrdSectionId, string>>): 'minor' | 'major' {
  const hasBreaking = Object.values(comments).some((c) => /\bbreaking\b/i.test(c ?? ''));
  return hasBreaking ? 'major' : 'minor';
}

/** Safe file name for the export, e.g. "BRD_Patient360_Phase1_v1.2.docx" (spec 2.7.3). */
export function brdFileName(brd: BrdState, versionLabel: string): string {
  const safeName = (brd.projectName || 'Project').replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `BRD_${safeName}_v${versionLabel}.docx`;
}

// --- defensive coercion of an AI/server payload ------------------------------

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

/**
 * Validate/normalise an unknown payload (e.g. from the AI service) into a
 * complete BrdDocument. Missing or malformed fields fall back to empty values
 * so rendering and .docx export never throw.
 */
export function coerceBrdDocument(raw: unknown): BrdDocument {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const scope = (o.scope ?? {}) as Record<string, unknown>;
  const dataModel = (o.dataModel ?? {}) as Record<string, unknown>;
  return {
    executiveSummary: asString(o.executiveSummary),
    businessObjectives: asStringArray(o.businessObjectives),
    scope: {
      inScope: asStringArray(scope.inScope),
      outOfScope: asStringArray(scope.outOfScope),
    },
    stakeholders: asRecordArray(o.stakeholders).map((s) => ({
      name: asString(s.name),
      role: asString(s.role),
      responsibility: asString(s.responsibility),
    })),
    functionalRequirements: asRecordArray(o.functionalRequirements).map((r, i) => ({
      id: asString(r.id, `FR-${i + 1}`),
      title: asString(r.title),
      description: asString(r.description),
      priority: asString(r.priority, 'Medium'),
    })),
    nonFunctionalRequirements: asRecordArray(o.nonFunctionalRequirements).map((r) => ({
      category: asString(r.category),
      requirement: asString(r.requirement),
      target: asString(r.target),
    })),
    dataModel: {
      overview: asString(dataModel.overview),
      entities: asRecordArray(dataModel.entities).map((e) => ({
        name: asString(e.name),
        attributes: asStringArray(e.attributes),
      })),
    },
    integrations: asRecordArray(o.integrations).map((it) => ({
      system: asString(it.system),
      direction: asString(it.direction),
      protocol: asString(it.protocol),
      description: asString(it.description),
    })),
    assumptions: asStringArray(o.assumptions),
    constraints: asStringArray(o.constraints),
    risks: asRecordArray(o.risks).map((r) => ({
      risk: asString(r.risk),
      impact: asString(r.impact),
      likelihood: asString(r.likelihood),
      mitigation: asString(r.mitigation),
    })),
    milestones: asRecordArray(o.milestones).map((m) => ({
      name: asString(m.name),
      targetDate: asString(m.targetDate),
      deliverables: asStringArray(m.deliverables),
    })),
    acceptanceCriteria: asStringArray(o.acceptanceCriteria),
  };
}

// --- offline, deterministic fallback -----------------------------------------

function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const match = trimmed.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

function futureDate(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a complete, domain-aware BRD with no AI. Reviewer comments are folded
 * into the matching section so a regenerate produces a visible change there.
 */
export function localBrdFallback(brd: BrdState): BrdDocument {
  const domain = domainById(brd.domain);
  const domainLabel = domain?.label ?? 'the selected domain';
  const projectName = brd.projectName || 'this initiative';
  const intent = firstSentence(brd.requirement) || `Deliver ${projectName} for ${domainLabel}.`;
  const comments = brd.comments;

  const milestones: BrdMilestone[] = [
    {
      name: 'Discovery & Requirements',
      targetDate: futureDate(1),
      deliverables: ['Signed-off BRD', 'Source-system inventory', 'Success metrics agreed'],
    },
    {
      name: 'Build & Integration',
      targetDate: futureDate(3),
      deliverables: ['Data pipelines', 'Conformed data model', 'Integration tests'],
    },
    {
      name: 'Launch & Handover',
      targetDate: futureDate(4),
      deliverables: ['UAT sign-off', 'Production deployment', 'Runbook & training'],
    },
  ];

  const entities: BrdEntity[] = [
    { name: 'Entity', attributes: ['id', 'name', 'created_at', 'updated_at'] },
    { name: 'Event', attributes: ['id', 'entity_id', 'type', 'occurred_at'] },
    { name: 'Reference', attributes: ['code', 'label', 'category'] },
  ];

  const doc: BrdDocument = {
    executiveSummary:
      `${projectName} addresses ${domainLabel.toLowerCase()} needs. ${intent} ` +
      'This document defines the scope, requirements, data model, and acceptance criteria ' +
      'needed to deliver the solution without further rework.',
    businessObjectives: [
      `Deliver ${projectName} aligned to ${domainLabel} priorities.`,
      'Reduce manual reporting effort and time-to-insight.',
      'Establish a single, trusted source of truth.',
      'Meet the agreed success metrics within the target timeline.',
    ],
    scope: {
      inScope: [
        'Core data ingestion from agreed source systems.',
        'A conformed data model and curated marts.',
        'A primary dashboard answering the key questions.',
      ],
      outOfScope: [
        'Real-time streaming beyond the agreed latency.',
        'Migration of legacy historical archives.',
        'Net-new source-system development.',
      ],
    },
    stakeholders: [
      { name: 'TBD', role: 'Business Sponsor', responsibility: 'Funds and prioritises the work.' },
      { name: 'TBD', role: 'Product Owner', responsibility: 'Owns scope and acceptance.' },
      { name: 'TBD', role: 'Data Engineer', responsibility: 'Builds pipelines and the model.' },
      { name: 'TBD', role: 'BI Developer', responsibility: 'Builds the dashboard and reports.' },
    ],
    functionalRequirements: [
      {
        id: 'FR-1',
        title: 'Ingest source data',
        description: 'Extract and load data from the agreed source systems on a schedule.',
        priority: 'High',
      },
      {
        id: 'FR-2',
        title: 'Conform and model data',
        description: 'Transform raw data into a conformed model with documented grain.',
        priority: 'High',
      },
      {
        id: 'FR-3',
        title: 'Present insights',
        description: 'Provide a dashboard that answers the stated business questions.',
        priority: 'Medium',
      },
    ],
    nonFunctionalRequirements: [
      { category: 'Performance', requirement: 'Dashboard load time', target: '< 3 seconds' },
      { category: 'Availability', requirement: 'Service uptime', target: '99.5% monthly' },
      { category: 'Security', requirement: 'Access control', target: 'Role-based, audited' },
      { category: 'Freshness', requirement: 'Data latency', target: 'Hourly incremental' },
    ],
    dataModel: {
      overview:
        'A star-style model with conformed dimensions and a primary fact, sized to the grain ' +
        'required to answer the key questions.',
      entities,
    },
    integrations: [
      {
        system: 'Source Warehouse',
        direction: 'Inbound',
        protocol: 'JDBC/Batch',
        description: 'Primary structured data source.',
      },
      {
        system: 'Identity Provider',
        direction: 'Inbound',
        protocol: 'OIDC/SAML',
        description: 'Authentication and role mapping.',
      },
      {
        system: 'BI Platform',
        direction: 'Outbound',
        protocol: 'API',
        description: 'Publishes the curated model to dashboards.',
      },
    ],
    assumptions: [
      'Source systems are accessible and reasonably documented.',
      'Stakeholders are available for review and sign-off.',
    ],
    constraints: [
      'Delivery within the agreed budget and timeline.',
      `Compliance with ${domainLabel} regulatory requirements.`,
    ],
    risks: [
      {
        risk: 'Source data quality issues',
        impact: 'High',
        likelihood: 'Medium',
        mitigation: 'Profile early; add quality checks and alerts.',
      },
      {
        risk: 'Scope creep',
        impact: 'Medium',
        likelihood: 'Medium',
        mitigation: 'Enforce change control against this BRD.',
      },
    ],
    milestones,
    acceptanceCriteria: [
      'All twelve BRD sections are complete and reviewed.',
      'The dashboard answers each stated business question.',
      'Data reconciles to an agreed source of truth.',
      'Stakeholders have signed off the deliverable.',
    ],
  };

  return applyComments(doc, comments);
}

/**
 * Fold reviewer comments into the offline document so the relevant section
 * visibly reflects the feedback after a regenerate (spec 2.10). For the AI path
 * the comments are sent in the prompt instead.
 */
function applyComments(
  doc: BrdDocument,
  comments: Partial<Record<BrdSectionId, string>>,
): BrdDocument {
  const next: BrdDocument = structuredClone(doc);
  const note = (c?: string) => (c && c.trim() ? `Reviewer note applied: ${c.trim()}` : null);

  const es = note(comments.executiveSummary);
  if (es) next.executiveSummary = `${next.executiveSummary} ${es}`;

  const bo = note(comments.businessObjectives);
  if (bo) next.businessObjectives = [...next.businessObjectives, bo];

  const sc = note(comments.scope);
  if (sc) next.scope = { ...next.scope, inScope: [...next.scope.inScope, sc] };

  const st = note(comments.stakeholders);
  if (st)
    next.stakeholders = [
      ...next.stakeholders,
      { name: 'TBD', role: 'Reviewer request', responsibility: st },
    ];

  const fr = note(comments.functionalRequirements);
  if (fr)
    next.functionalRequirements = [
      ...next.functionalRequirements,
      {
        id: `FR-${next.functionalRequirements.length + 1}`,
        title: 'Reviewer-requested requirement',
        description: fr,
        priority: 'Medium',
      },
    ];

  const nfr = note(comments.nonFunctionalRequirements);
  if (nfr)
    next.nonFunctionalRequirements = [
      ...next.nonFunctionalRequirements,
      { category: 'Reviewer request', requirement: nfr, target: 'TBD' },
    ];

  const dm = note(comments.dataModel);
  if (dm) next.dataModel = { ...next.dataModel, overview: `${next.dataModel.overview} ${dm}` };

  const ig = note(comments.integrations);
  if (ig)
    next.integrations = [
      ...next.integrations,
      { system: 'Reviewer request', direction: 'TBD', protocol: 'TBD', description: ig },
    ];

  const ac2 = note(comments.assumptionsConstraints);
  if (ac2) next.assumptions = [...next.assumptions, ac2];

  const rk = note(comments.risks);
  if (rk)
    next.risks = [
      ...next.risks,
      { risk: rk, impact: 'TBD', likelihood: 'TBD', mitigation: 'To be assessed.' },
    ];

  const tl = note(comments.timeline);
  if (tl)
    next.milestones = [
      ...next.milestones,
      { name: 'Reviewer-requested milestone', targetDate: futureDate(2), deliverables: [tl] },
    ];

  const acc = note(comments.acceptanceCriteria);
  if (acc) next.acceptanceCriteria = [...next.acceptanceCriteria, acc];

  return next;
}
