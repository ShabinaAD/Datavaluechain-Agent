import { useState } from 'react';
import { ModelGenerator } from '../components/model/ModelGenerator';
import { LogicalGenerator } from '../components/model/LogicalGenerator';
import { PhysicalGenerator } from '../components/model/PhysicalGenerator';
import { useProjectStore } from '../store/projectStore';

type ModelStage = 'conceptual' | 'logical' | 'physical';

export function Modeling() {
  const [stage, setStage] = useState<ModelStage>('conceptual');
  const conceptualCount = useProjectStore((s) => s.project.model.versions.length);
  const logicalCount = useProjectStore((s) => s.project.logical.versions.length);
  const physicalCount = useProjectStore((s) => s.project.physical.versions.length);

  const tabs: { id: ModelStage; label: string; count: number }[] = [
    { id: 'conceptual', label: 'Conceptual', count: conceptualCount },
    { id: 'logical', label: 'Logical', count: logicalCount },
    { id: 'physical', label: 'Physical (DDL)', count: physicalCount },
  ];

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-border bg-surface-muted/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStage(t.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              stage === t.id
                ? 'bg-surface text-content shadow-sm'
                : 'text-content-muted hover:text-content'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-200">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {stage === 'conceptual' && <ModelGenerator />}
      {stage === 'logical' && <LogicalGenerator />}
      {stage === 'physical' && <PhysicalGenerator />}
    </div>
  );
}
