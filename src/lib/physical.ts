import type {
  LogicalAttribute,
  LogicalEntity,
  LogicalModel,
  ModelEntityType,
  PhysicalColumn,
  PhysicalModel,
  PhysicalPlatform,
  PhysicalTable,
} from '../store/types';
import { toSnake } from './logical';

export const PLATFORMS: PhysicalPlatform[] = [
  'Snowflake',
  'Databricks',
  'Redshift',
  'BigQuery',
  'Azure Synapse',
];

export function detectPhysicalBump(revisionNote: string): 'minor' | 'major' {
  return /\bbreaking\b/i.test(revisionNote ?? '') ? 'major' : 'minor';
}

function mapLogicalToPhysicalType(logicalType: string, platform: PhysicalPlatform): string {
  const upper = logicalType.toUpperCase();
  const base = upper.replace(/\(.*\)/, '').trim();
  const params = logicalType.match(/\(.*\)/)?.[0] ?? '';

  const mapping: Record<string, Record<string, string>> = {
    Snowflake: {
      INTEGER: 'INTEGER', BIGINT: 'BIGINT', DECIMAL: `NUMBER${params}`,
      VARCHAR: `VARCHAR${params || '(255)'}`, TEXT: 'TEXT', DATE: 'DATE',
      TIME: 'TIME', TIMESTAMP: 'TIMESTAMP_NTZ', BOOLEAN: 'BOOLEAN', UUID: 'VARCHAR(36)',
    },
    Databricks: {
      INTEGER: 'INT', BIGINT: 'BIGINT', DECIMAL: `DECIMAL${params}`,
      VARCHAR: `STRING`, TEXT: 'STRING', DATE: 'DATE',
      TIME: 'STRING', TIMESTAMP: 'TIMESTAMP', BOOLEAN: 'BOOLEAN', UUID: 'STRING',
    },
    Redshift: {
      INTEGER: 'INTEGER', BIGINT: 'BIGINT', DECIMAL: `DECIMAL${params}`,
      VARCHAR: `VARCHAR${params || '(255)'}`, TEXT: 'VARCHAR(65535)', DATE: 'DATE',
      TIME: 'TIME', TIMESTAMP: 'TIMESTAMP', BOOLEAN: 'BOOLEAN', UUID: 'VARCHAR(36)',
    },
    BigQuery: {
      INTEGER: 'INT64', BIGINT: 'INT64', DECIMAL: `NUMERIC${params}`,
      VARCHAR: 'STRING', TEXT: 'STRING', DATE: 'DATE',
      TIME: 'TIME', TIMESTAMP: 'TIMESTAMP', BOOLEAN: 'BOOL', UUID: 'STRING',
    },
    'Azure Synapse': {
      INTEGER: 'INT', BIGINT: 'BIGINT', DECIMAL: `DECIMAL${params}`,
      VARCHAR: `NVARCHAR${params || '(255)'}`, TEXT: 'NVARCHAR(MAX)', DATE: 'DATE',
      TIME: 'TIME', TIMESTAMP: 'DATETIME2', BOOLEAN: 'BIT', UUID: 'UNIQUEIDENTIFIER',
    },
  };

  return mapping[platform]?.[base] ?? logicalType;
}

function silverAuditColumns(platform: PhysicalPlatform): PhysicalColumn[] {
  const tsType = mapLogicalToPhysicalType('TIMESTAMP', platform);
  const varType = mapLogicalToPhysicalType('VARCHAR(255)', platform);
  return [
    { name: 'ingestion_ts', dataType: tsType, nullable: false, isPrimaryKey: false, isForeignKey: false, references: null, description: '(standard audit column — not explicitly in BRD)', tags: ['audit'] },
    { name: 'source_system', dataType: varType, nullable: false, isPrimaryKey: false, isForeignKey: false, references: null, description: '(standard audit column — not explicitly in BRD)', tags: ['audit'] },
    { name: 'record_hash', dataType: mapLogicalToPhysicalType('VARCHAR(64)', platform), nullable: false, isPrimaryKey: false, isForeignKey: false, references: null, description: '(standard audit column — not explicitly in BRD)', tags: ['audit'] },
  ];
}

function logicalAttrToPhysicalCol(attr: LogicalAttribute, platform: PhysicalPlatform): PhysicalColumn {
  return {
    name: attr.name,
    dataType: mapLogicalToPhysicalType(attr.dataType, platform),
    nullable: attr.nullable,
    isPrimaryKey: attr.isPrimaryKey,
    isForeignKey: attr.isForeignKey,
    references: attr.references,
    description: attr.description,
    tags: [
      ...(attr.isPrimaryKey ? ['pk'] : []),
      ...(attr.isForeignKey ? ['fk'] : []),
      ...(attr.isBusinessKey ? ['business_key'] : []),
    ],
  };
}

function generateDdl(
  table: PhysicalTable,
  layer: 'silver' | 'gold',
  platform: PhysicalPlatform,
): string {
  const prefix = layer === 'silver' ? 'silver_' : '';
  const fullName = `${prefix}${toSnake(table.name)}`;
  const cols = table.columns.map((c) => {
    const nullStr = c.nullable ? '' : ' NOT NULL';
    const pkStr = c.isPrimaryKey ? ' PRIMARY KEY' : '';
    return `  ${c.name} ${c.dataType}${nullStr}${pkStr}`;
  });

  let ddl = `CREATE TABLE ${fullName} (\n${cols.join(',\n')}\n)`;

  if (platform === 'Snowflake') {
    const clusterCols = table.columns.filter((c) => c.isPrimaryKey || c.isForeignKey).map((c) => c.name);
    if (clusterCols.length > 0) ddl += `\nCLUSTER BY (${clusterCols.slice(0, 3).join(', ')})`;
  } else if (platform === 'Databricks') {
    ddl = ddl.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS');
    ddl += '\nUSING DELTA';
  } else if (platform === 'Redshift') {
    const distCol = table.columns.find((c) => c.isPrimaryKey);
    if (distCol) ddl += `\nDISTSTYLE KEY DISTKEY (${distCol.name})`;
  } else if (platform === 'BigQuery') {
    ddl = ddl.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS');
  } else if (platform === 'Azure Synapse') {
    ddl += '\nWITH (DISTRIBUTION = ROUND_ROBIN, CLUSTERED COLUMNSTORE INDEX)';
  }

  return ddl + ';';
}

function goldEntityName(entity: LogicalEntity): string {
  const snake = toSnake(entity.name);
  switch (entity.type) {
    case 'Dimension': return `dim_${snake}`;
    case 'Fact': return `fact_${snake}`;
    case 'Bridge': return `bridge_${snake}`;
    case 'Event': return `fact_${snake}`;
    default: return `dim_${snake}`;
  }
}

function goldType(entityType: ModelEntityType): ModelEntityType {
  return entityType === 'Event' ? 'Fact' : entityType;
}

export function derivePhysicalFromLogical(
  logical: LogicalModel,
  platform: PhysicalPlatform,
  projectName: string,
): PhysicalModel {
  const silverTables: PhysicalTable[] = logical.entities.map((entity) => {
    const cols: PhysicalColumn[] = entity.attributes.map((a) => logicalAttrToPhysicalCol(a, platform));
    cols.push(...silverAuditColumns(platform));
    const table: PhysicalTable = {
      name: entity.name,
      logicalEntity: entity.name,
      tableType: entity.type,
      description: `Silver layer: cleansed, conformed ${entity.name}.`,
      columns: cols,
      ddl: '',
    };
    table.ddl = generateDdl(table, 'silver', platform);
    return table;
  });

  const goldTables: PhysicalTable[] = logical.entities.map((entity) => {
    const gName = goldEntityName(entity);
    const gType = goldType(entity.type);
    const skName = `${toSnake(entity.name)}_sk`;
    const skType = mapLogicalToPhysicalType('BIGINT', platform);
    const skCol: PhysicalColumn = {
      name: skName, dataType: skType, nullable: false, isPrimaryKey: true,
      isForeignKey: false, references: null, description: 'Surrogate key', tags: ['pk', 'surrogate'],
    };

    const cols: PhysicalColumn[] = [skCol];
    for (const a of entity.attributes) {
      if (a.isPrimaryKey) {
        cols.push({ ...logicalAttrToPhysicalCol(a, platform), isPrimaryKey: false, tags: ['business_key'] });
      } else {
        cols.push(logicalAttrToPhysicalCol(a, platform));
      }
    }

    if (gType === 'Dimension') {
      const tsType = mapLogicalToPhysicalType('TIMESTAMP', platform);
      const boolType = mapLogicalToPhysicalType('BOOLEAN', platform);
      cols.push(
        { name: 'effective_start_date', dataType: tsType, nullable: false, isPrimaryKey: false, isForeignKey: false, references: null, description: 'SCD2 start', tags: ['scd2'] },
        { name: 'effective_end_date', dataType: tsType, nullable: true, isPrimaryKey: false, isForeignKey: false, references: null, description: 'SCD2 end', tags: ['scd2'] },
        { name: 'current_flag', dataType: boolType, nullable: false, isPrimaryKey: false, isForeignKey: false, references: null, description: 'SCD2 current', tags: ['scd2'] },
      );
    }

    const table: PhysicalTable = {
      name: gName,
      logicalEntity: entity.name,
      tableType: gType,
      description: `Gold layer: dimensional ${gName}.`,
      columns: cols,
      ddl: '',
    };
    table.ddl = generateDdl(table, 'gold', platform);
    return table;
  });

  return {
    name: `${projectName || 'Physical'} Physical Model (${platform})`,
    domain: logical.domain,
    platform,
    version: '',
    overview: `Physical model derived from the logical model for ${platform}. Silver layer provides cleansed, conformed tables (~1:1 with logical). Gold layer provides dimensional star/snowflake with SCD2 for dimensions.`,
    silver: silverTables,
    gold: goldTables,
  };
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

function coerceColumn(raw: Record<string, unknown>): PhysicalColumn {
  return {
    name: asString(raw.name),
    dataType: asString(raw.data_type ?? raw.dataType, 'VARCHAR(255)'),
    nullable: asBool(raw.nullable, true),
    isPrimaryKey: asBool(raw.is_primary_key ?? raw.isPrimaryKey),
    isForeignKey: asBool(raw.is_foreign_key ?? raw.isForeignKey),
    references: raw.references && typeof raw.references === 'object'
      ? { entity: asString((raw.references as Record<string, unknown>).entity), attribute: asString((raw.references as Record<string, unknown>).attribute) }
      : null,
    description: asString(raw.description),
    tags: Array.isArray(raw.tags) ? (raw.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
  };
}

function coerceTable(raw: Record<string, unknown>): PhysicalTable {
  return {
    name: asString(raw.name),
    logicalEntity: asString(raw.logical_entity ?? raw.logicalEntity),
    tableType: asString(raw.table_type ?? raw.tableType, 'Dimension') as ModelEntityType,
    description: asString(raw.description),
    columns: asRecordArray(raw.columns).map(coerceColumn),
    ddl: asString(raw.ddl),
  };
}

export function coercePhysicalModel(raw: unknown): PhysicalModel {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    name: asString(o.name, 'Physical Model'),
    domain: asString(o.domain),
    platform: (asString(o.platform, 'Snowflake') as PhysicalPlatform),
    version: asString(o.version),
    overview: asString(o.overview),
    silver: asRecordArray(o.silver).map(coerceTable),
    gold: asRecordArray(o.gold).map(coerceTable),
  };
}

export function localPhysicalFallback(
  logical: LogicalModel,
  platform: PhysicalPlatform,
  projectName: string,
): PhysicalModel {
  return derivePhysicalFromLogical(logical, platform, projectName);
}

export function summarizeLogical(model: LogicalModel): string {
  return JSON.stringify({
    entities: model.entities.map((e) => ({
      name: e.name,
      type: e.type,
      attributes: e.attributes.map((a) => `${a.name} ${a.dataType}${a.isPrimaryKey ? ' PK' : ''}${a.isForeignKey ? ' FK' : ''}`),
    })),
    relationships: model.relationships.map((r) => `${r.from}.${r.fromAttribute} → ${r.to}.${r.toAttribute} (${r.cardinality})`),
  });
}
