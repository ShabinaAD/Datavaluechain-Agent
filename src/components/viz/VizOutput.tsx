import type { VizDashboard, VizWidget } from '../../store/types';

const TYPE_ICON: Record<string, string> = {
  kpi: 'KPI',
  bar: 'Bar',
  line: 'Line',
  area: 'Area',
  pie: 'Pie',
  table: 'Table',
  scatter: 'Scatter',
};

const TYPE_COLORS: Record<string, string> = {
  kpi: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
  bar: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200',
  line: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200',
  area: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200',
  pie: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
  table: 'bg-stone-100 text-stone-700 dark:bg-stone-900/50 dark:text-stone-300',
  scatter: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200',
};

function WidgetCard({ widget }: { widget: VizWidget }) {
  let parsedConfig: Record<string, unknown> = {};
  try {
    parsedConfig = JSON.parse(widget.config);
  } catch {
    /* ignore */
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-content">{widget.title}</p>
          <p className="mt-0.5 text-xs text-content-muted">{widget.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_COLORS[widget.type] ?? 'bg-stone-100 text-stone-700'}`}>
          {TYPE_ICON[widget.type] ?? widget.type}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-content-muted">Data source:</span>
          <span className="font-mono text-content">{widget.dataSource}</span>
        </div>
        {Object.entries(parsedConfig).length > 0 && (
          <div>
            <span className="font-medium text-content-muted">Config:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(parsedConfig).map(([k, v]) => (
                <span key={k} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-content-muted">
                  {k}: {typeof v === 'string' ? v : JSON.stringify(v)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VizOutput({ dashboard }: { dashboard: VizDashboard }) {
  const kpis = dashboard.widgets.filter((w) => w.type === 'kpi');
  const charts = dashboard.widgets.filter((w) => w.type !== 'kpi');

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-serif text-lg font-semibold text-content">{dashboard.name}</h3>
        <p className="mt-1 text-sm text-content-muted">{dashboard.overview}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-content-muted">
            Layout: {dashboard.layout}
          </span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-content-muted">
            {dashboard.widgets.length} widgets
          </span>
        </div>
      </section>

      {kpis.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-content">
            KPI Cards <span className="text-content-subtle">({kpis.length})</span>
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {kpis.map((w) => (
              <WidgetCard key={w.id} widget={w} />
            ))}
          </div>
        </section>
      )}

      {charts.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-content">
            Visualizations <span className="text-content-subtle">({charts.length})</span>
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {charts.map((w) => (
              <WidgetCard key={w.id} widget={w} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
