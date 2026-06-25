import type {
  CodeGenStage,
  PhysicalModel,
  PhysicalPlatform,
} from '../store/types';
import { toSnake } from './logical';

export const STAGE_LABELS: Record<CodeGenStage, string> = {
  'source-to-bronze': 'Source → Bronze',
  'bronze-to-silver': 'Bronze → Silver',
  'silver-to-gold': 'Silver → Gold',
};

export const PLATFORM_LANGUAGES: Record<PhysicalPlatform, string[]> = {
  Snowflake: ['SQL', 'Python'],
  Databricks: ['PySpark', 'SQL'],
  Redshift: ['SQL', 'Python'],
  BigQuery: ['SQL', 'Python'],
  'Azure Synapse': ['T-SQL', 'Python'],
};

export function defaultLanguage(platform: PhysicalPlatform): string {
  return PLATFORM_LANGUAGES[platform]?.[0] ?? 'SQL';
}

function fileExtension(language: string): string {
  const lower = language.toLowerCase();
  if (lower === 'sql' || lower === 't-sql') return '.sql';
  return '.py';
}

export function codeFileName(
  stage: CodeGenStage,
  platform: PhysicalPlatform,
  language: string,
): string {
  const stagePart = stage.replace(/-/g, '_');
  const platPart = toSnake(platform);
  const langPart = toSnake(language);
  return `${stagePart}_${platPart}_${langPart}${fileExtension(language)}`;
}

function generateBronzeCode(
  physical: PhysicalModel,
  platform: PhysicalPlatform,
  language: string,
): string {
  const tables = physical.silver;
  const lines: string[] = [];
  const isSql = language.toLowerCase() === 'sql' || language.toLowerCase() === 't-sql';

  if (isSql) {
    lines.push(`-- ============================================================`);
    lines.push(`-- Source → Bronze ingestion pipeline`);
    lines.push(`-- Platform: ${platform} | Language: ${language}`);
    lines.push(`-- Tables: ${tables.map((t) => `bronze_${toSnake(t.name)}`).join(', ')}`);
    lines.push(`-- Load strategy: Full load (Append)`);
    lines.push(`-- Idempotency: TRUNCATE + INSERT pattern`);
    lines.push(`-- ============================================================`);
    lines.push('');

    for (const table of tables) {
      const bronzeName = `bronze_${toSnake(table.name)}`;
      const cols = table.columns.filter((c) => !c.tags.includes('audit'));
      lines.push(`-- Bronze landing table for ${table.name}`);
      lines.push(`CREATE TABLE IF NOT EXISTS ${bronzeName} (`);
      lines.push(`  _raw_id BIGINT IDENTITY(1,1) PRIMARY KEY,`);
      lines.push(`  _ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`);
      lines.push(`  _source_file VARCHAR(512),`);
      for (const col of cols) {
        lines.push(`  ${col.name} VARCHAR(4000),`);
      }
      lines.push(`);`);
      lines.push('');
    }
  } else {
    lines.push(`# ============================================================`);
    lines.push(`# Source → Bronze ingestion pipeline`);
    lines.push(`# Platform: ${platform} | Language: ${language}`);
    lines.push(`# ============================================================`);
    lines.push('');
    lines.push(`from pyspark.sql import SparkSession`);
    lines.push(`from pyspark.sql.functions import current_timestamp, lit, input_file_name`);
    lines.push('');
    lines.push(`# Configuration`);
    lines.push(`SOURCE_PATH = "/mnt/raw/"`);
    lines.push(`BRONZE_DB = "bronze"`);
    lines.push('');
    lines.push(`spark = SparkSession.builder.appName("source_to_bronze").getOrCreate()`);
    lines.push('');

    for (const table of tables) {
      const bronzeName = `bronze_${toSnake(table.name)}`;
      lines.push(`# Ingest ${table.name} from source to bronze`);
      lines.push(`df_${toSnake(table.name)} = (`);
      lines.push(`    spark.read.format("csv")`);
      lines.push(`    .option("header", True)`);
      lines.push(`    .option("inferSchema", False)`);
      lines.push(`    .load(f"{SOURCE_PATH}${toSnake(table.name)}/")`);
      lines.push(`    .withColumn("_ingested_at", current_timestamp())`);
      lines.push(`    .withColumn("_source_file", input_file_name())`);
      lines.push(`)`);
      lines.push(`df_${toSnake(table.name)}.write.mode("overwrite").saveAsTable(f"{BRONZE_DB}.${bronzeName}")`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateSilverCode(
  physical: PhysicalModel,
  platform: PhysicalPlatform,
  language: string,
): string {
  const tables = physical.silver;
  const lines: string[] = [];
  const isSql = language.toLowerCase() === 'sql' || language.toLowerCase() === 't-sql';

  if (isSql) {
    lines.push(`-- ============================================================`);
    lines.push(`-- Bronze → Silver cleanse & conform pipeline`);
    lines.push(`-- Platform: ${platform} | Language: ${language}`);
    lines.push(`-- Tables: ${tables.map((t) => `silver_${toSnake(t.name)}`).join(', ')}`);
    lines.push(`-- Load strategy: MERGE (upsert on PK)`);
    lines.push(`-- ============================================================`);
    lines.push('');

    for (const table of tables) {
      const silverName = `silver_${toSnake(table.name)}`;
      const bronzeName = `bronze_${toSnake(table.name)}`;
      const pk = table.columns.find((c) => c.isPrimaryKey);
      const nonPkCols = table.columns.filter((c) => !c.isPrimaryKey);

      lines.push(`-- Cleanse & load ${table.name}: ${bronzeName} → ${silverName}`);
      lines.push(`MERGE INTO ${silverName} AS tgt`);
      lines.push(`USING (`);
      lines.push(`  SELECT`);
      for (const col of table.columns) {
        const castLine = `    CAST(${col.name} AS ${col.dataType}) AS ${col.name},`;
        lines.push(castLine);
      }
      lines.push(`  FROM ${bronzeName}`);
      lines.push(`  WHERE ${pk?.name ?? 'id'} IS NOT NULL`);
      lines.push(`) AS src`);
      lines.push(`ON tgt.${pk?.name ?? 'id'} = src.${pk?.name ?? 'id'}`);
      lines.push(`WHEN MATCHED THEN UPDATE SET`);
      for (let i = 0; i < nonPkCols.length; i++) {
        const sep = i < nonPkCols.length - 1 ? ',' : '';
        lines.push(`  tgt.${nonPkCols[i].name} = src.${nonPkCols[i].name}${sep}`);
      }
      lines.push(`WHEN NOT MATCHED THEN INSERT (`);
      lines.push(`  ${table.columns.map((c) => c.name).join(', ')}`);
      lines.push(`) VALUES (`);
      lines.push(`  ${table.columns.map((c) => `src.${c.name}`).join(', ')}`);
      lines.push(`);`);
      lines.push('');
    }
  } else {
    lines.push(`# ============================================================`);
    lines.push(`# Bronze → Silver cleanse & conform pipeline`);
    lines.push(`# Platform: ${platform} | Language: ${language}`);
    lines.push(`# ============================================================`);
    lines.push('');
    lines.push(`from pyspark.sql import SparkSession`);
    lines.push(`from pyspark.sql.functions import col, current_timestamp, md5, concat_ws`);
    lines.push(`from delta.tables import DeltaTable`);
    lines.push('');
    lines.push(`BRONZE_DB = "bronze"`);
    lines.push(`SILVER_DB = "silver"`);
    lines.push('');
    lines.push(`spark = SparkSession.builder.appName("bronze_to_silver").getOrCreate()`);
    lines.push('');

    for (const table of tables) {
      const silverName = `silver_${toSnake(table.name)}`;
      const bronzeName = `bronze_${toSnake(table.name)}`;
      const pk = table.columns.find((c) => c.isPrimaryKey);
      lines.push(`# Cleanse ${table.name}: ${bronzeName} → ${silverName}`);
      lines.push(`df_bronze = spark.table(f"{BRONZE_DB}.${bronzeName}")`);
      lines.push(`df_clean = (`);
      lines.push(`    df_bronze`);
      lines.push(`    .dropDuplicates(["${pk?.name ?? 'id'}"])`);
      lines.push(`    .filter(col("${pk?.name ?? 'id'}").isNotNull())`);
      lines.push(`    .withColumn("ingestion_ts", current_timestamp())`);
      lines.push(`    .withColumn("source_system", lit("bronze"))`);
      lines.push(`    .withColumn("record_hash", md5(concat_ws("|", *[col(c) for c in df_bronze.columns])))`);
      lines.push(`)`);
      lines.push(`df_clean.write.mode("overwrite").saveAsTable(f"{SILVER_DB}.${silverName}")`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateGoldCode(
  physical: PhysicalModel,
  platform: PhysicalPlatform,
  language: string,
): string {
  const tables = physical.gold;
  const lines: string[] = [];
  const isSql = language.toLowerCase() === 'sql' || language.toLowerCase() === 't-sql';

  if (isSql) {
    lines.push(`-- ============================================================`);
    lines.push(`-- Silver → Gold dimensional pipeline`);
    lines.push(`-- Platform: ${platform} | Language: ${language}`);
    lines.push(`-- Tables: ${tables.map((t) => t.name).join(', ')}`);
    lines.push(`-- Load strategy: SCD2 for dims, Append/Merge for facts`);
    lines.push(`-- ============================================================`);
    lines.push('');

    for (const table of tables) {
      const isDim = table.tableType === 'Dimension';
      const silverSource = `silver_${toSnake(table.logicalEntity)}`;

      if (isDim) {
        const sk = table.columns.find((c) => c.isPrimaryKey);
        const bkCols = table.columns.filter((c) => c.tags.includes('business_key'));
        const bk = bkCols[0] ?? table.columns[1];
        lines.push(`-- SCD2 load for ${table.name} from ${silverSource}`);
        lines.push(`MERGE INTO ${table.name} AS tgt`);
        lines.push(`USING ${silverSource} AS src`);
        lines.push(`ON tgt.${bk?.name ?? 'id'} = src.${bk?.name ?? 'id'} AND tgt.current_flag = TRUE`);
        lines.push(`WHEN MATCHED AND src.record_hash <> tgt.record_hash THEN`);
        lines.push(`  UPDATE SET effective_end_date = CURRENT_TIMESTAMP, current_flag = FALSE`);
        lines.push(`WHEN NOT MATCHED THEN INSERT (`);
        const insertCols = table.columns.filter((c) => c.name !== sk?.name);
        lines.push(`  ${insertCols.map((c) => c.name).join(', ')}`);
        lines.push(`) VALUES (`);
        const vals = insertCols.map((c) => {
          if (c.name === 'effective_start_date') return 'CURRENT_TIMESTAMP';
          if (c.name === 'effective_end_date') return 'NULL';
          if (c.name === 'current_flag') return 'TRUE';
          return `src.${c.name}`;
        });
        lines.push(`  ${vals.join(', ')}`);
        lines.push(`);`);
      } else {
        lines.push(`-- Append load for ${table.name} from ${silverSource}`);
        lines.push(`INSERT INTO ${table.name}`);
        lines.push(`SELECT`);
        const dataCols = table.columns.filter((c) => !c.isPrimaryKey);
        lines.push(`  ${dataCols.map((c) => `src.${c.name}`).join(',\n  ')}`);
        lines.push(`FROM ${silverSource} src`);
        lines.push(`WHERE NOT EXISTS (`);
        lines.push(`  SELECT 1 FROM ${table.name} tgt`);
        const fkCols = table.columns.filter((c) => c.isForeignKey);
        if (fkCols.length > 0) {
          lines.push(`  WHERE ${fkCols.map((c) => `tgt.${c.name} = src.${c.name}`).join(' AND ')}`);
        } else {
          lines.push(`  WHERE tgt.${dataCols[0]?.name ?? 'id'} = src.${dataCols[0]?.name ?? 'id'}`);
        }
        lines.push(`);`);
      }
      lines.push('');
    }
  } else {
    lines.push(`# ============================================================`);
    lines.push(`# Silver → Gold dimensional pipeline`);
    lines.push(`# Platform: ${platform} | Language: ${language}`);
    lines.push(`# ============================================================`);
    lines.push('');
    lines.push(`from pyspark.sql import SparkSession`);
    lines.push(`from pyspark.sql.functions import col, current_timestamp, lit, monotonically_increasing_id`);
    lines.push('');
    lines.push(`SILVER_DB = "silver"`);
    lines.push(`GOLD_DB = "gold"`);
    lines.push('');
    lines.push(`spark = SparkSession.builder.appName("silver_to_gold").getOrCreate()`);
    lines.push('');

    for (const table of tables) {
      const silverSource = `silver_${toSnake(table.logicalEntity)}`;
      lines.push(`# Load ${table.name} from ${silverSource}`);
      lines.push(`df_silver = spark.table(f"{SILVER_DB}.${silverSource}")`);
      lines.push(`df_gold = (`);
      lines.push(`    df_silver`);
      lines.push(`    .withColumn("${toSnake(table.name)}_sk", monotonically_increasing_id())`);
      if (table.tableType === 'Dimension') {
        lines.push(`    .withColumn("effective_start_date", current_timestamp())`);
        lines.push(`    .withColumn("effective_end_date", lit(None))`);
        lines.push(`    .withColumn("current_flag", lit(True))`);
      }
      lines.push(`)`);
      lines.push(`df_gold.write.mode("overwrite").saveAsTable(f"{GOLD_DB}.${table.name}")`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function generatePipelineCode(
  stage: CodeGenStage,
  physical: PhysicalModel,
  platform: PhysicalPlatform,
  language: string,
): string {
  switch (stage) {
    case 'source-to-bronze':
      return generateBronzeCode(physical, platform, language);
    case 'bronze-to-silver':
      return generateSilverCode(physical, platform, language);
    case 'silver-to-gold':
      return generateGoldCode(physical, platform, language);
  }
}
