import { useMemo } from 'react';
import type { LogicalModel } from '../../store/types';
import { ENTITY_TYPE_STYLE } from '../../lib/model';

/**
 * Logical ER diagram. Entities are laid out on an ellipse (so a 10–25 table
 * model stays readable); foreign keys are drawn as directed edges from the FK
 * holder to the referenced table. A solid line is an identifying relationship,
 * a dashed line is non-identifying; edge labels show the cardinality.
 */

const WIDTH = 820;
const NODE_W = 140;
const NODE_H = 40;

interface Placed {
  name: string;
  x: number;
  y: number;
  color: string;
}

export function LogicalDiagram({ model }: { model: LogicalModel }) {
  const { placed, height } = useMemo(() => {
    const n = model.entities.length;
    const pad = NODE_W / 2 + 16;
    const rx = WIDTH / 2 - pad;
    const ry = Math.max(160, 28 * n);
    const cx = WIDTH / 2;
    const cy = ry + NODE_H / 2 + 24;
    const h = cy + ry + NODE_H / 2 + 24;
    const map = new Map<string, Placed>();
    model.entities.forEach((e, i) => {
      const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      map.set(e.name, {
        name: e.name,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
        color: ENTITY_TYPE_STYLE[e.type].node,
      });
    });
    return { placed: map, height: h };
  }, [model]);

  if (model.entities.length === 0) return null;

  return (
    <figure className="overflow-x-auto rounded-lg border border-border bg-surface-muted/30 p-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="mx-auto h-auto w-full min-w-[680px]"
        role="img"
        aria-label="Logical entity relationship diagram"
      >
        <defs>
          <marker
            id="logical-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-content-subtle" />
          </marker>
        </defs>

        {model.relationships.map((r, i) => {
          const a = placed.get(r.from);
          const b = placed.get(r.to);
          if (!a || !b || r.from === r.to) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="stroke-border"
                strokeWidth={1.5}
                strokeDasharray={r.identifying ? undefined : '5 4'}
                markerEnd="url(#logical-arrow)"
              />
              <rect
                x={mx - 16}
                y={my - 9}
                width={32}
                height={16}
                rx={8}
                className="fill-surface stroke-border"
                strokeWidth={1}
              />
              <text x={mx} y={my + 3} textAnchor="middle" className="fill-content-muted text-[10px]">
                {r.cardinality}
              </text>
            </g>
          );
        })}

        {model.entities.map((e) => {
          const p = placed.get(e.name);
          if (!p) return null;
          return (
            <g key={e.name}>
              <rect
                x={p.x - NODE_W / 2}
                y={p.y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                className="fill-surface"
                stroke={p.color}
                strokeWidth={2}
              />
              <circle cx={p.x - NODE_W / 2 + 12} cy={p.y} r={4} fill={p.color} />
              <text
                x={p.x + 6}
                y={p.y + 4}
                textAnchor="middle"
                className="fill-content text-[11px] font-medium"
              >
                {e.name.length > 17 ? `${e.name.slice(0, 16)}…` : e.name}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
