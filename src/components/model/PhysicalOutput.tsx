import { useState } from 'react';
import type { PhysicalModel, PhysicalTable } from '../../store/types';

function TableCard({ table, layer }: { table: PhysicalTable; layer: 'silver' | 'gold' }) {
  const [showDdl, setShowDdl] = useState(false);
  const layerBadge = layer === 'silver'
    ? 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-content">{table.name}</p>
          <p className="mt-0.5 text-xs text-content-muted">{table.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${layerBadge}`}>
            {layer}
          </span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-content-muted">
            {table.tableType}
          </span>
        </div>
      </div>

      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-muted/30 text-content-muted">
            <th className="px-3 py-1.5">Column</th>
            <th className="px-3 py-1.5 text-right">Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {table.columns.map((c) => (
            <tr key={c.name} className="text-content">
              <td className="px-3 py-1">
                <div className="flex items-center gap-1.5">
                  <span className={c.isPrimaryKey ? 'font-semibold' : ''}>{c.name}</span>
                  {c.isPrimaryKey && (
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">PK</span>
                  )}
                  {c.isForeignKey && (
                    <span className="rounded bg-sky-100 px-1 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/50 dark:text-sky-200">FK</span>
                  )}
                  {c.tags.includes('scd2') && (
                    <span className="rounded bg-violet-100 px-1 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">SCD2</span>
                  )}
                  {c.tags.includes('audit') && (
                    <span className="rounded bg-stone-100 px-1 py-0.5 text-[10px] font-bold text-stone-600 dark:bg-stone-900/50 dark:text-stone-400">audit</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-1 text-right">
                <span className="font-mono text-[11px] text-content-muted">{c.dataType}</span>
                {!c.nullable && (
                  <span className="ml-1 text-[10px] font-semibold text-content-subtle">NOT NULL</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {table.ddl && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowDdl(!showDdl)}
            className="w-full px-3 py-1.5 text-left text-xs font-medium text-brand-600 hover:bg-surface-muted/50"
          >
            {showDdl ? 'Hide DDL' : 'Show DDL'}
          </button>
          {showDdl && (
            <pre className="max-h-60 overflow-auto border-t border-border bg-stone-900 px-3 py-2 text-xs text-stone-200">
              {table.ddl}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function PhysicalOutput({ model }: { model: PhysicalModel }) {
  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-lg font-semibold text-content">{model.name}</h3>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
            {model.platform}
          </span>
        </div>
        <p className="mt-1 text-sm text-content-muted">{model.overview}</p>
      </section>

      {model.silver.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-content">
            Silver Layer <span className="text-content-subtle">({model.silver.length} tables)</span>
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {model.silver.map((t) => (
              <TableCard key={t.name} table={t} layer="silver" />
            ))}
          </div>
        </section>
      )}

      {model.gold.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-content">
            Gold Layer <span className="text-content-subtle">({model.gold.length} tables)</span>
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {model.gold.map((t) => (
              <TableCard key={t.name} table={t} layer="gold" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
