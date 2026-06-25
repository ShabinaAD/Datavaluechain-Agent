import type {
  PhysicalModel,
  VizDashboard,
  VizWidget,
} from '../store/types';

export function detectVizBump(revisionNote: string): 'minor' | 'major' {
  return /\bbreaking\b/i.test(revisionNote ?? '') ? 'major' : 'minor';
}

let widgetCounter = 0;
function nextWidgetId(): string {
  return `w_${++widgetCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

function deriveKpiWidgets(physical: PhysicalModel): VizWidget[] {
  const factTables = [...physical.gold.filter((t) => t.tableType === 'Fact')];
  const dimTables = [...physical.gold.filter((t) => t.tableType === 'Dimension')];
  const widgets: VizWidget[] = [];

  widgets.push({
    id: nextWidgetId(),
    type: 'kpi',
    title: 'Total Records',
    description: 'Total count of records across all fact tables.',
    dataSource: factTables[0]?.name ?? 'fact_main',
    config: JSON.stringify({ aggregation: 'COUNT', format: '0,0' }),
  });

  if (factTables.length > 0) {
    widgets.push({
      id: nextWidgetId(),
      type: 'kpi',
      title: `${factTables[0].name} Volume`,
      description: `Record count in ${factTables[0].name}.`,
      dataSource: factTables[0].name,
      config: JSON.stringify({ aggregation: 'COUNT', format: '0,0' }),
    });
  }

  widgets.push({
    id: nextWidgetId(),
    type: 'kpi',
    title: 'Dimensions',
    description: 'Number of active dimension tables.',
    dataSource: 'metadata',
    config: JSON.stringify({ value: dimTables.length, format: '0' }),
  });

  widgets.push({
    id: nextWidgetId(),
    type: 'kpi',
    title: 'Data Freshness',
    description: 'Most recent ingestion timestamp.',
    dataSource: 'silver_audit',
    config: JSON.stringify({ aggregation: 'MAX', column: 'ingestion_ts', format: 'datetime' }),
  });

  return widgets;
}

function deriveChartWidgets(physical: PhysicalModel): VizWidget[] {
  const factTables = physical.gold.filter((t) => t.tableType === 'Fact');
  const dimTables = physical.gold.filter((t) => t.tableType === 'Dimension');
  const widgets: VizWidget[] = [];

  if (factTables.length > 0) {
    const firstFact = factTables[0];
    const timeCols = firstFact.columns.filter((c) =>
      c.dataType.includes('DATE') || c.dataType.includes('TIMESTAMP') || c.dataType.includes('DATETIME'),
    );
    const timeCol = timeCols[0]?.name ?? 'created_ts';

    widgets.push({
      id: nextWidgetId(),
      type: 'line',
      title: `${firstFact.name} Trend`,
      description: `Record count over time in ${firstFact.name}.`,
      dataSource: firstFact.name,
      config: JSON.stringify({ x: timeCol, y: 'COUNT(*)', groupBy: 'month' }),
    });

    if (dimTables.length > 0) {
      widgets.push({
        id: nextWidgetId(),
        type: 'bar',
        title: `Records by ${dimTables[0].name}`,
        description: `Distribution across ${dimTables[0].name}.`,
        dataSource: `${firstFact.name} JOIN ${dimTables[0].name}`,
        config: JSON.stringify({ x: dimTables[0].columns[1]?.name ?? 'name', y: 'COUNT(*)' }),
      });
    }
  }

  if (dimTables.length > 1) {
    widgets.push({
      id: nextWidgetId(),
      type: 'pie',
      title: `${dimTables[1].name} Breakdown`,
      description: `Proportional breakdown of ${dimTables[1].name}.`,
      dataSource: dimTables[1].name,
      config: JSON.stringify({ category: dimTables[1].columns[1]?.name ?? 'type', value: 'COUNT(*)' }),
    });
  }

  widgets.push({
    id: nextWidgetId(),
    type: 'table',
    title: 'Recent Activity',
    description: 'Most recent records from the primary fact table.',
    dataSource: factTables[0]?.name ?? 'fact_main',
    config: JSON.stringify({ limit: 50, orderBy: 'DESC' }),
  });

  return widgets;
}

export function deriveVizFromPhysical(
  physical: PhysicalModel,
  projectName: string,
): VizDashboard {
  const kpis = deriveKpiWidgets(physical);
  const charts = deriveChartWidgets(physical);

  return {
    name: `${projectName || 'Project'} Dashboard`,
    domain: physical.domain,
    version: '',
    overview: `Auto-generated dashboard specification for the ${physical.domain} domain, featuring ${kpis.length} KPI cards and ${charts.length} visualization widgets based on the Gold-layer dimensional model.`,
    layout: 'grid',
    widgets: [...kpis, ...charts],
  };
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

export function coerceVizDashboard(raw: unknown): VizDashboard {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    name: asString(o.name, 'Dashboard'),
    domain: asString(o.domain),
    version: asString(o.version),
    overview: asString(o.overview),
    layout: (['single', 'grid', 'narrative'].includes(asString(o.layout)) ? asString(o.layout) : 'grid') as VizDashboard['layout'],
    widgets: asRecordArray(o.widgets).map((w) => ({
      id: asString(w.id, nextWidgetId()),
      type: asString(w.type, 'kpi') as VizWidget['type'],
      title: asString(w.title),
      description: asString(w.description),
      dataSource: asString(w.data_source ?? w.dataSource),
      config: typeof w.config === 'string' ? w.config : JSON.stringify(w.config ?? {}),
    })),
  };
}

export function localVizFallback(
  physical: PhysicalModel,
  projectName: string,
): VizDashboard {
  return deriveVizFromPhysical(physical, projectName);
}
