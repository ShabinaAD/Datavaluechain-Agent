import { useMemo } from 'react';
import type { ConceptualModel } from '../../store/types';
import { ENTITY_TYPE_STYLE } from '../../lib/model';

/**
 * A lightweight, dependency-free entity-relationship diagram. Entities are laid
 * out on a circle so even a fully-connected model stays readable; relationships
 * are drawn as directed edges labelled with their cardinality. Node colour
 * encodes the entity type (matching the cards), and a legend explains it.
 */

const WIDTH = 760;
const NODE_W = 132;
const NODE_H = 40;

interface Placed {
  name: string;
  x: number;
  y: number;
  color: string;
}

export function ModelDiagram({ model }: { model: ConceptualModel }) {
  const { placed, height } = useMemo(() => {
    const n = model.entities.length;
    // Ellipse: horizontal radius is capped so the widest node still fits inside
    // the viewBox; vertical radius grows with the entity count for breathing room.
    const pad = NODE_W / 2 + 16;
    const rx = WIDTH / 2 - pad;
    const ry = Math.max(150, 30 * n);
    const cx = WIDTH / 2;
    const cy = ry + NODE_H / 2 + 24;
    const h = cy + ry + NODE_H / 2 + 24;
    const map = new Map<string, Placed>();
    model.entities.forEach((e, i) => {
      // Start at the top and go clockwise.
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
        className="mx-auto h-auto w-full min-w-[640px]"
        role="img"
        aria-label="Entity relationship diagram"
      >
        <defs>
          <marker
            id="arrow"
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

        {/* Edges first so nodes paint on top. */}
        {model.relationships.map((r, i) => {
          const a = placed.get(r.from);
          const b = placed.get(r.to);
          if (!a) return null;
          if (r.from === r.to && a) {
            // Self-reference: a small loop above the node.
            const lx = a.x;
            const ly = a.y - NODE_H / 2;
            return (
              <g key={`self-${i}`}>
                <path
                  d={`M ${lx - 16} ${ly} C ${lx - 34} ${ly - 46}, ${lx + 34} ${ly - 46}, ${lx + 16} ${ly}`}
                  className="fill-none stroke-border"
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                />
                <text x={lx} y={ly - 40} textAnchor="middle" className="fill-content-muted text-[10px]">
                  {r.cardinality} {r.label}
                </text>
              </g>
            );
          }
          if (!b) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const labelW = (r.cardinality.length + r.label.length) * 6 + 14;
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="stroke-border"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
              <rect
                x={mx - labelW / 2}
                y={my - 9}
                width={labelW}
                height={16}
                rx={8}
                className="fill-surface stroke-border"
                strokeWidth={1}
              />
              <text x={mx} y={my + 3} textAnchor="middle" className="fill-content-muted text-[10px]">
                {r.cardinality} {r.label}
              </text>
            </g>
          );
        })}

        {/* Nodes. */}
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
                {e.name.length > 16 ? `${e.name.slice(0, 15)}…` : e.name}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
