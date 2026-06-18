/**
 * Business domains the BRD agent has been trained on (spec 2.5.1).
 *
 * Each domain carries a default project-name suggestion (2.5.2) and a starter
 * requirement template (2.5.3). The list is configurable: add an entry here and
 * the dropdown, name auto-seed, and requirement seed all update together.
 */
export interface DomainDefinition {
  id: string;
  label: string;
  /** Suggested project name when this domain is picked. */
  suggestedName: string;
  /** Starter requirement text seeded into the Requirement box. */
  requirementSeed: string;
}

export const DOMAINS: DomainDefinition[] = [
  {
    id: 'life-sciences',
    label: 'Life Sciences',
    suggestedName: 'TrialInsight_Phase1',
    requirementSeed: [
      'Build a life-sciences data platform unifying clinical trial, lab, and regulatory data.',
      '',
      'Typical considerations for this domain:',
      '- GxP (GCP/GLP/GMP) compliance and 21 CFR Part 11 audit trails.',
      '- Patient and subject data privacy (consent, de-identification).',
      '- CDISC (SDTM/ADaM) standards for clinical trial data.',
      '- Pharmacovigilance and adverse-event reporting.',
    ].join('\n'),
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    suggestedName: 'Patient360_Phase1',
    requirementSeed: [
      'Build a unified patient view that consolidates clinical, claims, and scheduling data.',
      '',
      'Typical considerations for this domain:',
      '- HIPAA compliance and PHI handling (encryption at rest and in transit).',
      '- Patient consent and audit trails for every data access.',
      '- HL7 / FHIR interoperability with EHR systems.',
      '- Care-gap and readmission-risk reporting for clinicians.',
    ].join('\n'),
  },
  {
    id: 'trade-compliance',
    label: 'Trade Compliance / Tariff Management',
    suggestedName: 'TariffGuard_Phase1',
    requirementSeed: [
      'Build a tariff and trade-compliance workspace that classifies goods and screens shipments.',
      '',
      'Typical considerations for this domain:',
      '- Harmonized System (HS) / customs codes and country-of-origin rules.',
      '- Denied-party and sanctions screening with audit evidence.',
      '- Duty and landed-cost calculation per shipment.',
      '- Document retention for customs audits.',
    ].join('\n'),
  },
  {
    id: 'financial-services',
    label: 'Financial Services',
    suggestedName: 'RiskLens_Phase1',
    requirementSeed: [
      'Build a risk-and-finance reporting platform for portfolio and exposure analytics.',
      '',
      'Typical considerations for this domain:',
      '- SOX controls and segregation of duties.',
      '- AML / KYC data lineage and auditability.',
      '- Daily P&L, exposure, and liquidity reporting.',
      '- Regulatory reporting (e.g. Basel, MiFID) feeds.',
    ].join('\n'),
  },
  {
    id: 'retail',
    label: 'Retail',
    suggestedName: 'ShelfInsight_Phase1',
    requirementSeed: [
      'Build a retail analytics workspace spanning sales, inventory, and customer behavior.',
      '',
      'Typical considerations for this domain:',
      '- Omnichannel sales and inventory reconciliation.',
      '- Demand forecasting and replenishment signals.',
      '- Customer segmentation and basket analysis.',
      '- PCI-DSS handling for payment data.',
    ].join('\n'),
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    suggestedName: 'PlantPulse_Phase1',
    requirementSeed: [
      'Build a manufacturing operations dashboard covering OEE, quality, and supply.',
      '',
      'Typical considerations for this domain:',
      '- OEE (availability, performance, quality) by line and shift.',
      '- Predictive maintenance signals from sensor data.',
      '- Supplier on-time-in-full (OTIF) tracking.',
      '- Traceability from raw material to finished goods.',
    ].join('\n'),
  },
];

export const DEFAULT_DOMAIN_ID = DOMAINS[0].id;

export function domainById(id: string): DomainDefinition | undefined {
  return DOMAINS.find((d) => d.id === id);
}
