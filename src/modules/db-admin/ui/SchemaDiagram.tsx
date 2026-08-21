"use client";

import * as React from "react";
import { Loader2, ZoomIn, ZoomOut, Maximize2, Key, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { schemaDiagramAction } from "@/modules/db-admin/actions";
import {
  layoutDiagram,
  edgePath,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  type DiagramLayout,
} from "@/modules/db-admin/domain/diagram-layout";
import { cn } from "@/lib/utils";

const ZOOM_STEP = 0.15;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;

/** Entity-relationship diagram of a schema, drawn as inline SVG. */
export function SchemaDiagram({
  connectionId,
  schema,
  onPickTable,
}: {
  connectionId: string;
  schema: string;
  onPickTable?: (table: string) => void;
}) {
  const [layout, setLayout] = React.useState<DiagramLayout | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [zoom, setZoom] = React.useState(0.8);
  const [hovered, setHovered] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const res = await schemaDiagramAction(connectionId, schema);
      if (res.ok) setLayout(layoutDiagram(res.value));
      else setError(res.error);
      setLoading(false);
    })();
  }, [connectionId, schema]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Construyendo el diagrama…
      </p>
    );
  }
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!layout || layout.nodes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
        Este esquema no tiene tablas que dibujar.
      </p>
    );
  }

  /** Tables touched by the hovered table's relationships. */
  const related = new Set<string>();
  if (hovered) {
    related.add(hovered);
    for (const e of layout.edges) {
      if (e.from === hovered) related.add(e.to);
      if (e.to === hovered) related.add(e.from);
    }
  }
  const isDimmed = (table: string) => hovered !== null && !related.has(table);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {layout.nodes.length} tablas · {layout.edges.length} relaciones — pasa el
          cursor por una tabla para resaltar sus vínculos
          {onPickTable ? ", o haz clic para abrirla" : ""}.
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}>
            <ZoomOut className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom(0.8)} title="Restablecer zoom">
            <Maximize2 className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}>
            <ZoomIn className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-border/60 bg-foreground/[0.015]">
        <svg
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="block"
          role="img"
          aria-label={`Diagrama del esquema ${schema}`}
        >
          <defs>
            <marker
              id="erd-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
            </marker>
          </defs>

          {/* Relationships first, so boxes sit on top of the lines. */}
          <g>
            {layout.edges.map((e) => {
              const active = hovered === null || e.from === hovered || e.to === hovered;
              return (
                <path
                  key={e.id}
                  d={edgePath(e)}
                  fill="none"
                  markerEnd="url(#erd-arrow)"
                  className={cn(
                    "stroke-muted-foreground transition-opacity",
                    active ? "opacity-70" : "opacity-10",
                  )}
                  strokeWidth={active && hovered ? 2 : 1.2}
                >
                  <title>{`${e.from}.${e.label}`}</title>
                </path>
              );
            })}
          </g>

          {layout.nodes.map((n) => (
            <g
              key={n.table}
              transform={`translate(${n.x}, ${n.y})`}
              onMouseEnter={() => setHovered(n.table)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onPickTable?.(n.table)}
              className={cn(
                "transition-opacity",
                onPickTable && "cursor-pointer",
                isDimmed(n.table) ? "opacity-25" : "opacity-100",
              )}
            >
              <rect
                width={n.width}
                height={n.height}
                rx={8}
                className="fill-background stroke-border"
                strokeWidth={hovered === n.table ? 2 : 1}
              />
              <rect
                width={n.width}
                height={HEADER_HEIGHT}
                rx={8}
                className="fill-foreground/[0.06]"
              />
              {/* Square off the header's bottom corners. */}
              <rect y={HEADER_HEIGHT - 8} width={n.width} height={8} className="fill-foreground/[0.06]" />
              <line
                y1={HEADER_HEIGHT}
                x2={n.width}
                y2={HEADER_HEIGHT}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={10}
                y={HEADER_HEIGHT / 2 + 4}
                className="fill-foreground text-[12px] font-medium"
              >
                {n.table}
              </text>

              {n.columns.map((c) => (
                <g key={c.name}>
                  {c.isPrimaryKey ? (
                    <circle cx={14} cy={c.offsetY - 3} r={3} className="fill-accent" />
                  ) : c.isForeignKey ? (
                    <circle
                      cx={14}
                      cy={c.offsetY - 3}
                      r={3}
                      className="fill-none stroke-muted-foreground"
                      strokeWidth={1.2}
                    />
                  ) : null}
                  <text x={24} y={c.offsetY} className="fill-foreground text-[10px]">
                    {c.name}
                  </text>
                  <text
                    x={n.width - 10}
                    y={c.offsetY}
                    textAnchor="end"
                    className="fill-muted-foreground text-[9px]"
                  >
                    {c.dataType}
                  </text>
                </g>
              ))}

              {n.hiddenCount > 0 ? (
                <text
                  x={24}
                  y={HEADER_HEIGHT + n.columns.length * ROW_HEIGHT + ROW_HEIGHT / 2}
                  className="fill-muted-foreground text-[9px] italic"
                >
                  +{n.hiddenCount} columnas más
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Key className="size-3 text-accent" /> Clave primaria
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Link2 className="size-3" /> Clave foránea
        </span>
      </div>
    </div>
  );
}
