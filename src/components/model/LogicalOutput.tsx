import type { LogicalEntity, LogicalModel, ModelEntityType } from '../../store/types';
import { ENTITY_TYPE_STYLE, ENTITY_TYPES } from '../../lib/model';
import type { LogicalValidation } from '../../lib/logical';
import { LogicalDiagram } from './LogicalDiagram';

function TypeBadge({ type }: { type: ModelEntityType }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ENTITY_TYPE_STYLE[type].badge}`}
    >
      {type}
    </span>
  );
}

function KeyTag({ kind }: { kind: 'PK' | 'FK' | 'BK' }) {
  const style =
    kind === 'PK'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
      : kind === 'FK'
        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
        : 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200';
  return (
    <span className={`rounded px-1 py-0.5 text-[10px] font-bold leading-none ${style}`}>{kind}</span>
  );
}

function EntityCard({ entity }: { entity: LogicalEntity }) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-content">{entity.name}</p>
          <p className="mt-0.5 text-xs text-content-muted">{entity.description}</p>
        </div>
        <TypeBadge type={entity.type} />
      </div>
      <table className="w-full text-left text-xs">
        <tbody className="divide-y divide-border">
          {entity.attributes.map((a) => (
            <tr key={a.name} className="text-content">
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={a.isPrimaryKey ? 'font-semibold' : ''}>{a.name}</span>
                  {a.isPrimaryKey && <KeyTag kind="PK" />}
                  {a.isForeignKey && <KeyTag kind="FK" />}
                  {a.isBusinessKey && !a.isPrimaryKey && <KeyTag kind="BK" />}
                </div>
                {a.isForeignKey && a.references && (
                  <span className="text-[10px] text-content-subtle">
                    → {a.references.entity}.{a.references.attribute}
                  </span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right">
                <span className="font-mono text-[11px] text-content-muted">{a.dataType}</span>
                {!a.nullable && (
                  <span className="ml-1 text-[10px] font-semibold text-content-subtle">NOT NULL</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LogicalOutput({
  model,
  validation,
}: {
  model: LogicalModel;
  validation: LogicalValidation;
}) {
  return (
    <div className="space-y-6">
      {validation.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Model checks</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {validation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Overview */}
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-lg font-semibold text-content">{model.name}</h3>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
            {model.normalization}
          </span>
        </div>
        <p className="mt-1 text-sm text-content-muted">{model.overview}</p>
      </section>

      {/* Diagram */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-content">Entity-relationship diagram</h4>
          <div className="flex flex-wrap gap-2">
            {ENTITY_TYPES.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[11px] text-content-muted">
                <span className={`h-2 w-2 rounded-full ${ENTITY_TYPE_STYLE[t].dot}`} />
                {t}
              </span>
            ))}
          </div>
        </div>
        <LogicalDiagram model={model} />
        <p className="text-[11px] text-content-subtle">
          Solid line = identifying relationship · dashed = non-identifying · arrow points to the
          referenced table.
        </p>
      </section>

      {/* Entities */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-content">
          Tables <span className="text-content-subtle">({model.entities.length})</span>
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {model.entities.map((e) => (
            <EntityCard key={e.name} entity={e} />
          ))}
        </div>
      </section>

      {/* Relationships */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-content">
          Relationships <span className="text-content-subtle">({model.relationships.length})</span>
        </h4>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-content-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">From (FK)</th>
                <th className="px-3 py-2 font-semibold">To (PK)</th>
                <th className="px-3 py-2 font-semibold">Card.</th>
                <th className="px-3 py-2 font-semibold">Identifying</th>
                <th className="px-3 py-2 font-semibold">Relationship</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {model.relationships.map((r, i) => (
                <tr key={i} className="text-content">
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.from}</span>
                    <span className="font-mono text-xs text-content-subtle">.{r.fromAttribute}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.to}</span>
                    <span className="font-mono text-xs text-content-subtle">.{r.toAttribute}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-surface-muted/60 px-1.5 py-0.5 font-mono text-xs">
                      {r.cardinality}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-content-muted">{r.identifying ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 text-content-muted">{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
