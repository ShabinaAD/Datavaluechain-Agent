import type { ConceptualModel, ModelEntityType } from '../../store/types';
import { ENTITY_TYPE_STYLE, ENTITY_TYPES, type ModelValidation } from '../../lib/model';
import { ModelDiagram } from './ModelDiagram';

function TypeBadge({ type }: { type: ModelEntityType }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ENTITY_TYPE_STYLE[type].badge}`}
    >
      {type}
    </span>
  );
}

export function ModelOutput({
  model,
  validation,
}: {
  model: ConceptualModel;
  validation: ModelValidation;
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
        <h3 className="font-serif text-lg font-semibold text-content">{model.name}</h3>
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
        <ModelDiagram model={model} />
      </section>

      {/* Entities */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-content">
          Entities <span className="text-content-subtle">({model.entities.length})</span>
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {model.entities.map((e) => (
            <div key={e.name} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-content">{e.name}</p>
                <TypeBadge type={e.type} />
              </div>
              <p className="mt-1 text-xs text-content-muted">{e.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {e.keyAttributes.map((a) => (
                  <span
                    key={a}
                    className="rounded border border-border bg-surface-muted/50 px-1.5 py-0.5 text-[11px] text-content-muted"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
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
                <th className="px-3 py-2 font-semibold">From</th>
                <th className="px-3 py-2 font-semibold">Cardinality</th>
                <th className="px-3 py-2 font-semibold">To</th>
                <th className="px-3 py-2 font-semibold">Relationship</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {model.relationships.map((r, i) => (
                <tr key={i} className="text-content">
                  <td className="px-3 py-2 font-medium">{r.from}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-surface-muted/60 px-1.5 py-0.5 font-mono text-xs">
                      {r.cardinality}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{r.to}</td>
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
