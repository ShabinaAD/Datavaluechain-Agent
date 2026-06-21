/**
 * Business domains the BRD agent has been trained on (spec 2.5.1).
 *
 * Each domain carries a default project-name suggestion (2.5.2) and a starter
 * requirement template (2.5.3). The list is configurable: add an entry here and
 * the dropdown, name auto-seed, and requirement seed all update together.
 */
import type { ModelEntity, ModelRelationship } from '../store/types';

/** A starter conceptual model for a domain, used by the offline modeler fallback
 *  and as the vocabulary hint sent to the AI agent (spec 3.x). */
export interface DomainModelSeed {
  /** 2–4 sentence overview written for this domain. */
  overview: string;
  entities: ModelEntity[];
  relationships: ModelRelationship[];
}

export interface DomainDefinition {
  id: string;
  label: string;
  /** Suggested project name when this domain is picked. */
  suggestedName: string;
  /** Starter requirement text seeded into the Requirement box. */
  requirementSeed: string;
  /** Domain-standard conceptual model (entities + relationships). */
  modelSeed: DomainModelSeed;
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
    modelSeed: {
      overview:
        'A conceptual model for a clinical research data platform spanning study setup, ' +
        'site activation, subject enrollment, and visit-level data capture. It links safety ' +
        '(adverse events) and efficacy (observations, lab results) data back to subjects, sites, ' +
        'and the study drug, and tracks regulatory submissions per study. The model stays at the ' +
        'business-entity level with no physical implementation detail.',
      entities: [
        { name: 'Sponsor', type: 'Dimension', description: 'Organization funding and owning the study.', keyAttributes: ['Sponsor Identifier', 'Name', 'Country'] },
        { name: 'Study', type: 'Dimension', description: 'A clinical trial with a defined protocol and objectives.', keyAttributes: ['Study Identifier', 'Title', 'Phase', 'Therapeutic Area', 'Status'] },
        { name: 'Site', type: 'Dimension', description: 'A physical location where the study is conducted.', keyAttributes: ['Site Identifier', 'Site Name', 'Country', 'Activation Date'] },
        { name: 'Investigator', type: 'Dimension', description: 'Clinician responsible for conduct at a site.', keyAttributes: ['Investigator Identifier', 'Name', 'Credentials', 'Specialty'] },
        { name: 'Subject', type: 'Dimension', description: 'An enrolled trial participant.', keyAttributes: ['Subject Identifier', 'Screening Number', 'Enrollment Date', 'Arm'] },
        { name: 'Visit', type: 'Event', description: 'A scheduled or unscheduled subject visit.', keyAttributes: ['Visit Identifier', 'Visit Name', 'Scheduled Day', 'Visit Window'] },
        { name: 'Observation', type: 'Fact', description: 'A measurement or assessment captured at a visit.', keyAttributes: ['Observation Identifier', 'Parameter', 'Result Value', 'Unit', 'Collected At'] },
        { name: 'Lab Result', type: 'Fact', description: 'A laboratory analyte result for a subject.', keyAttributes: ['Result Identifier', 'Analyte', 'Value', 'Reference Range', 'Collected At'] },
        { name: 'Adverse Event', type: 'Event', description: 'An untoward medical occurrence in a subject.', keyAttributes: ['Event Identifier', 'Term', 'Severity', 'Seriousness', 'Onset Date'] },
        { name: 'Study Drug', type: 'Reference', description: 'An investigational product administered in the study.', keyAttributes: ['Drug Identifier', 'Name', 'Dosage Form', 'Strength'] },
        { name: 'Regulatory Submission', type: 'Event', description: 'A filing made to a health authority for the study.', keyAttributes: ['Submission Identifier', 'Type', 'Authority', 'Submission Date', 'Status'] },
      ],
      relationships: [
        { from: 'Sponsor', to: 'Study', cardinality: '1:N', label: 'sponsors' },
        { from: 'Study', to: 'Site', cardinality: '1:N', label: 'conducted at' },
        { from: 'Investigator', to: 'Site', cardinality: '1:N', label: 'leads' },
        { from: 'Site', to: 'Subject', cardinality: '1:N', label: 'enrolls' },
        { from: 'Study', to: 'Subject', cardinality: '1:N', label: 'enrolls' },
        { from: 'Subject', to: 'Visit', cardinality: '1:N', label: 'attends' },
        { from: 'Visit', to: 'Observation', cardinality: '1:N', label: 'captures' },
        { from: 'Visit', to: 'Lab Result', cardinality: '1:N', label: 'produces' },
        { from: 'Subject', to: 'Adverse Event', cardinality: '1:N', label: 'experiences' },
        { from: 'Adverse Event', to: 'Study Drug', cardinality: 'N:1', label: 'attributed to' },
        { from: 'Subject', to: 'Study Drug', cardinality: 'N:N', label: 'receives' },
        { from: 'Study', to: 'Regulatory Submission', cardinality: '1:N', label: 'files' },
      ],
    },
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
    modelSeed: {
      overview:
        'A conceptual model for a unified patient view across clinical encounters, claims, and ' +
        'coverage. Patients receive care from providers at facilities during encounters, which ' +
        'generate diagnoses, procedures, observations, and claims billed against coverage. The ' +
        'model names business entities and their relationships only, with no physical schema.',
      entities: [
        { name: 'Patient', type: 'Dimension', description: 'A person receiving care; also a plan member.', keyAttributes: ['Patient Identifier', 'Full Name', 'Date Of Birth', 'Gender', 'Member Number'] },
        { name: 'Provider', type: 'Dimension', description: 'A clinician or organization delivering care.', keyAttributes: ['Provider Identifier', 'Name', 'Specialty', 'NPI'] },
        { name: 'Facility', type: 'Dimension', description: 'A site where care is delivered.', keyAttributes: ['Facility Identifier', 'Name', 'Type', 'Location'] },
        { name: 'Encounter', type: 'Event', description: 'An interaction between a patient and the health system.', keyAttributes: ['Encounter Identifier', 'Encounter Type', 'Admission Date', 'Discharge Date', 'Status'] },
        { name: 'Diagnosis', type: 'Reference', description: 'A coded condition recorded for an encounter.', keyAttributes: ['Diagnosis Code', 'Description', 'Code System'] },
        { name: 'Procedure', type: 'Reference', description: 'A coded clinical procedure performed.', keyAttributes: ['Procedure Code', 'Description', 'Code System'] },
        { name: 'Observation', type: 'Fact', description: 'A clinical measurement or result for an encounter.', keyAttributes: ['Observation Identifier', 'Type', 'Value', 'Unit', 'Observed At'] },
        { name: 'Medication', type: 'Reference', description: 'A drug prescribed or administered.', keyAttributes: ['Medication Code', 'Name', 'Form', 'Strength'] },
        { name: 'Claim', type: 'Fact', description: 'A billing claim submitted for an encounter.', keyAttributes: ['Claim Identifier', 'Claim Type', 'Total Charge', 'Service Date', 'Status'] },
        { name: 'Claim Line', type: 'Bridge', description: 'A billed line item on a claim (derived from standard healthcare model — not explicitly in BRD).', keyAttributes: ['Line Number', 'Service Code', 'Charge Amount', 'Units'] },
        { name: 'Coverage', type: 'Dimension', description: 'A patient insurance plan that claims are billed to.', keyAttributes: ['Coverage Identifier', 'Plan Name', 'Payer', 'Effective Date', 'Termination Date'] },
      ],
      relationships: [
        { from: 'Patient', to: 'Encounter', cardinality: '1:N', label: 'has' },
        { from: 'Provider', to: 'Encounter', cardinality: '1:N', label: 'delivers' },
        { from: 'Facility', to: 'Encounter', cardinality: '1:N', label: 'hosts' },
        { from: 'Provider', to: 'Facility', cardinality: 'N:N', label: 'practices at' },
        { from: 'Encounter', to: 'Diagnosis', cardinality: 'N:N', label: 'diagnosed with' },
        { from: 'Encounter', to: 'Procedure', cardinality: 'N:N', label: 'performs' },
        { from: 'Encounter', to: 'Observation', cardinality: '1:N', label: 'records' },
        { from: 'Encounter', to: 'Medication', cardinality: 'N:N', label: 'prescribes' },
        { from: 'Encounter', to: 'Claim', cardinality: '1:N', label: 'generates' },
        { from: 'Claim', to: 'Claim Line', cardinality: '1:N', label: 'itemized as' },
        { from: 'Claim Line', to: 'Procedure', cardinality: 'N:1', label: 'bills' },
        { from: 'Patient', to: 'Coverage', cardinality: '1:N', label: 'holds' },
        { from: 'Claim', to: 'Coverage', cardinality: 'N:1', label: 'billed to' },
      ],
    },
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
    modelSeed: {
      overview:
        'A conceptual model for trade compliance covering shipments, product classification, ' +
        'customs declarations, duty assessment, and sanctions screening. Shipments of classified ' +
        'products move between countries via trading partners, are declared to customs, incur ' +
        'duties, and are screened and evidenced with documents and licenses.',
      entities: [
        { name: 'Trading Partner', type: 'Dimension', description: 'A counterparty involved in a shipment.', keyAttributes: ['Partner Identifier', 'Name', 'Role', 'Country'] },
        { name: 'Shipment', type: 'Fact', description: 'A consignment of goods moving across borders.', keyAttributes: ['Shipment Identifier', 'Reference Number', 'Ship Date', 'Incoterms', 'Status'] },
        { name: 'Product', type: 'Dimension', description: 'A traded good included in a shipment.', keyAttributes: ['Product Identifier', 'Description', 'Material', 'Unit Of Measure'] },
        { name: 'HS Classification', type: 'Reference', description: 'A Harmonized System code and its duty rate.', keyAttributes: ['HS Code', 'Description', 'Duty Rate', 'Chapter'] },
        { name: 'Country', type: 'Reference', description: 'An origin or destination country.', keyAttributes: ['Country Code', 'Country Name', 'Region', 'Trade Bloc'] },
        { name: 'Customs Declaration', type: 'Event', description: 'A filing lodged with customs for a shipment.', keyAttributes: ['Declaration Identifier', 'Entry Number', 'Customs Regime', 'Declaration Date'] },
        { name: 'Duty Assessment', type: 'Fact', description: 'Duties and taxes assessed on a declaration.', keyAttributes: ['Assessment Identifier', 'Duty Type', 'Amount', 'Currency'] },
        { name: 'Sanctions Screening', type: 'Event', description: 'A denied-party / sanctions check on a shipment.', keyAttributes: ['Screening Identifier', 'List Checked', 'Outcome', 'Screened At'] },
        { name: 'License', type: 'Dimension', description: 'An export/import permit a product may require.', keyAttributes: ['License Identifier', 'License Type', 'Authority', 'Expiry Date'] },
        { name: 'Document', type: 'Reference', description: 'Supporting evidence retained for audits.', keyAttributes: ['Document Identifier', 'Document Type', 'Issued Date'] },
      ],
      relationships: [
        { from: 'Trading Partner', to: 'Shipment', cardinality: '1:N', label: 'ships' },
        { from: 'Shipment', to: 'Product', cardinality: 'N:N', label: 'contains' },
        { from: 'Product', to: 'HS Classification', cardinality: 'N:1', label: 'classified as' },
        { from: 'Shipment', to: 'Country', cardinality: 'N:1', label: 'originates from' },
        { from: 'Shipment', to: 'Country', cardinality: 'N:1', label: 'destined for' },
        { from: 'Shipment', to: 'Customs Declaration', cardinality: '1:N', label: 'declared via' },
        { from: 'Customs Declaration', to: 'Duty Assessment', cardinality: '1:N', label: 'incurs' },
        { from: 'Duty Assessment', to: 'HS Classification', cardinality: 'N:1', label: 'rated by' },
        { from: 'Shipment', to: 'Sanctions Screening', cardinality: '1:N', label: 'screened by' },
        { from: 'Sanctions Screening', to: 'Trading Partner', cardinality: 'N:1', label: 'evaluates' },
        { from: 'Shipment', to: 'Document', cardinality: 'N:N', label: 'supported by' },
        { from: 'Product', to: 'License', cardinality: 'N:N', label: 'requires' },
      ],
    },
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
    modelSeed: {
      overview:
        'A conceptual model for risk-and-finance analytics covering customers, accounts, ' +
        'transactions, instruments, positions, and exposures. Customers own accounts grouped into ' +
        'portfolios that hold positions in instruments; transactions and counterparties drive risk ' +
        'exposures that feed regulatory reporting.',
      entities: [
        { name: 'Customer', type: 'Dimension', description: 'A client of the institution.', keyAttributes: ['Customer Identifier', 'Legal Name', 'Segment', 'Onboarding Date', 'KYC Status'] },
        { name: 'Account', type: 'Dimension', description: 'A financial account held by a customer.', keyAttributes: ['Account Identifier', 'Account Number', 'Account Type', 'Currency', 'Status'] },
        { name: 'Transaction', type: 'Fact', description: 'A financial movement on an account.', keyAttributes: ['Transaction Identifier', 'Type', 'Amount', 'Currency', 'Trade Date'] },
        { name: 'Instrument', type: 'Dimension', description: 'A tradable financial instrument.', keyAttributes: ['Instrument Identifier', 'Symbol', 'Asset Class', 'Issuer'] },
        { name: 'Position', type: 'Fact', description: 'A holding of an instrument within a portfolio.', keyAttributes: ['Position Identifier', 'Quantity', 'Market Value', 'As Of Date'] },
        { name: 'Portfolio', type: 'Dimension', description: 'A managed grouping of accounts and positions.', keyAttributes: ['Portfolio Identifier', 'Name', 'Strategy', 'Base Currency'] },
        { name: 'Counterparty', type: 'Dimension', description: 'An entity the institution transacts with.', keyAttributes: ['Counterparty Identifier', 'Name', 'Rating', 'Jurisdiction'] },
        { name: 'Risk Exposure', type: 'Fact', description: 'A measured exposure arising from positions.', keyAttributes: ['Exposure Identifier', 'Risk Type', 'Exposure Amount', 'Measure Date'] },
        { name: 'Product', type: 'Reference', description: 'A product classification for accounts.', keyAttributes: ['Product Code', 'Name', 'Category'] },
        { name: 'Regulatory Report', type: 'Event', description: 'A regulatory submission derived from portfolios.', keyAttributes: ['Report Identifier', 'Framework', 'Reporting Period', 'Status'] },
      ],
      relationships: [
        { from: 'Customer', to: 'Account', cardinality: '1:N', label: 'owns' },
        { from: 'Account', to: 'Transaction', cardinality: '1:N', label: 'records' },
        { from: 'Transaction', to: 'Instrument', cardinality: 'N:1', label: 'references' },
        { from: 'Account', to: 'Portfolio', cardinality: 'N:1', label: 'grouped into' },
        { from: 'Portfolio', to: 'Position', cardinality: '1:N', label: 'holds' },
        { from: 'Position', to: 'Instrument', cardinality: 'N:1', label: 'of' },
        { from: 'Position', to: 'Risk Exposure', cardinality: '1:N', label: 'generates' },
        { from: 'Risk Exposure', to: 'Counterparty', cardinality: 'N:1', label: 'attributed to' },
        { from: 'Account', to: 'Product', cardinality: 'N:1', label: 'classified as' },
        { from: 'Transaction', to: 'Counterparty', cardinality: 'N:1', label: 'settled with' },
        { from: 'Customer', to: 'Counterparty', cardinality: 'N:N', label: 'transacts with' },
        { from: 'Portfolio', to: 'Regulatory Report', cardinality: '1:N', label: 'reported in' },
      ],
    },
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
    modelSeed: {
      overview:
        'A conceptual model for retail analytics spanning customers, products, orders, inventory, ' +
        'and promotions. Customers place orders of product line items fulfilled by stores; products ' +
        'roll up into a category hierarchy, are supplied by suppliers, stocked as inventory, and ' +
        'discounted by promotions.',
      entities: [
        { name: 'Customer', type: 'Dimension', description: 'A shopper who places orders.', keyAttributes: ['Customer Identifier', 'Name', 'Loyalty Tier', 'Segment'] },
        { name: 'Product', type: 'Dimension', description: 'A sellable item.', keyAttributes: ['Product Identifier', 'SKU', 'Name', 'Brand', 'Unit Price'] },
        { name: 'Category', type: 'Hierarchy', description: 'A merchandising category, possibly nested.', keyAttributes: ['Category Identifier', 'Name', 'Parent Category'] },
        { name: 'Store', type: 'Dimension', description: 'A physical or digital sales location.', keyAttributes: ['Store Identifier', 'Name', 'Format', 'Region'] },
        { name: 'Order', type: 'Fact', description: 'A customer purchase transaction.', keyAttributes: ['Order Identifier', 'Order Date', 'Channel', 'Total Amount', 'Status'] },
        { name: 'Order Line', type: 'Bridge', description: 'A product line item within an order.', keyAttributes: ['Line Number', 'Quantity', 'Unit Price', 'Discount'] },
        { name: 'Inventory', type: 'Fact', description: 'Stock on hand for a product at a store.', keyAttributes: ['Inventory Identifier', 'On Hand Quantity', 'Reorder Point', 'As Of Date'] },
        { name: 'Supplier', type: 'Dimension', description: 'A vendor that supplies products.', keyAttributes: ['Supplier Identifier', 'Name', 'Lead Time', 'Country'] },
        { name: 'Promotion', type: 'Dimension', description: 'A marketing discount applied to orders/products.', keyAttributes: ['Promotion Identifier', 'Name', 'Discount Type', 'Start Date', 'End Date'] },
        { name: 'Payment', type: 'Fact', description: 'A settlement against an order.', keyAttributes: ['Payment Identifier', 'Method', 'Amount', 'Authorized At'] },
      ],
      relationships: [
        { from: 'Customer', to: 'Order', cardinality: '1:N', label: 'places' },
        { from: 'Order', to: 'Order Line', cardinality: '1:N', label: 'contains' },
        { from: 'Order Line', to: 'Product', cardinality: 'N:1', label: 'of' },
        { from: 'Product', to: 'Category', cardinality: 'N:1', label: 'belongs to' },
        { from: 'Category', to: 'Category', cardinality: '1:N', label: 'parent of' },
        { from: 'Store', to: 'Order', cardinality: '1:N', label: 'fulfills' },
        { from: 'Store', to: 'Inventory', cardinality: '1:N', label: 'stocks' },
        { from: 'Inventory', to: 'Product', cardinality: 'N:1', label: 'tracks' },
        { from: 'Supplier', to: 'Product', cardinality: '1:N', label: 'supplies' },
        { from: 'Promotion', to: 'Product', cardinality: 'N:N', label: 'discounts' },
        { from: 'Order', to: 'Promotion', cardinality: 'N:1', label: 'applies' },
        { from: 'Order', to: 'Payment', cardinality: '1:N', label: 'settled by' },
      ],
    },
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
    modelSeed: {
      overview:
        'A conceptual model for manufacturing operations covering plants, production lines, work ' +
        'orders, products, materials, machines, and quality. Work orders run on production lines to ' +
        'produce products built from materials via a bill of materials; machines emit sensor ' +
        'readings and work orders are quality-inspected.',
      entities: [
        { name: 'Plant', type: 'Dimension', description: 'A manufacturing facility.', keyAttributes: ['Plant Identifier', 'Name', 'Location', 'Capacity'] },
        { name: 'Production Line', type: 'Dimension', description: 'A line within a plant that runs work orders.', keyAttributes: ['Line Identifier', 'Name', 'Throughput Rate', 'Status'] },
        { name: 'Work Order', type: 'Fact', description: 'An instruction to produce a quantity of product.', keyAttributes: ['Work Order Identifier', 'Quantity', 'Start Time', 'End Time', 'Status'] },
        { name: 'Product', type: 'Dimension', description: 'A finished good produced by work orders.', keyAttributes: ['Product Identifier', 'Name', 'SKU', 'Unit Of Measure'] },
        { name: 'Material', type: 'Dimension', description: 'A raw material or component consumed in production.', keyAttributes: ['Material Identifier', 'Name', 'Material Type', 'Unit Of Measure'] },
        { name: 'Bill Of Materials', type: 'Bridge', description: 'The components and quantities for a product (derived from standard manufacturing model).', keyAttributes: ['BOM Identifier', 'Component Quantity', 'Version'] },
        { name: 'Machine', type: 'Dimension', description: 'Equipment on a production line.', keyAttributes: ['Machine Identifier', 'Name', 'Type', 'Install Date'] },
        { name: 'Sensor Reading', type: 'Fact', description: 'A telemetry reading emitted by a machine.', keyAttributes: ['Reading Identifier', 'Metric', 'Value', 'Unit', 'Recorded At'] },
        { name: 'Quality Inspection', type: 'Event', description: 'A quality check performed on a work order.', keyAttributes: ['Inspection Identifier', 'Result', 'Defect Count', 'Inspected At'] },
        { name: 'Supplier', type: 'Dimension', description: 'A vendor that supplies materials.', keyAttributes: ['Supplier Identifier', 'Name', 'OTIF Rate', 'Country'] },
      ],
      relationships: [
        { from: 'Plant', to: 'Production Line', cardinality: '1:N', label: 'operates' },
        { from: 'Plant', to: 'Machine', cardinality: '1:N', label: 'houses' },
        { from: 'Production Line', to: 'Work Order', cardinality: '1:N', label: 'runs' },
        { from: 'Production Line', to: 'Machine', cardinality: '1:N', label: 'equipped with' },
        { from: 'Work Order', to: 'Product', cardinality: 'N:1', label: 'produces' },
        { from: 'Product', to: 'Bill Of Materials', cardinality: '1:N', label: 'defined by' },
        { from: 'Bill Of Materials', to: 'Material', cardinality: 'N:1', label: 'consumes' },
        { from: 'Machine', to: 'Sensor Reading', cardinality: '1:N', label: 'emits' },
        { from: 'Work Order', to: 'Quality Inspection', cardinality: '1:N', label: 'inspected by' },
        { from: 'Quality Inspection', to: 'Product', cardinality: 'N:1', label: 'evaluates' },
        { from: 'Supplier', to: 'Material', cardinality: '1:N', label: 'supplies' },
      ],
    },
  },
];

export const DEFAULT_DOMAIN_ID = DOMAINS[0].id;

export function domainById(id: string): DomainDefinition | undefined {
  return DOMAINS.find((d) => d.id === id);
}
