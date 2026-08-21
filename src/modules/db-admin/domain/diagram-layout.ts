import type { SchemaDiagram } from "./schema-info";

/**
 * Geometry for the relationship diagram. Pure maths so it can be unit-tested
 * without a DOM — the SVG component just renders what this returns.
 */

export const NODE_WIDTH = 220;
export const HEADER_HEIGHT = 30;
export const ROW_HEIGHT = 18;
export const MAX_VISIBLE_COLUMNS = 10;
const H_GAP = 90;
const V_GAP = 60;
const PADDING = 40;

export interface LayoutColumn {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  /** Vertical centre of this row, relative to the node's top. */
  offsetY: number;
}

export interface LayoutNode {
  table: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: LayoutColumn[];
  /** Columns hidden because the table exceeds MAX_VISIBLE_COLUMNS. */
  hiddenCount: number;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  /** Anchor points, already resolved to absolute canvas coordinates. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DiagramLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

function nodeHeight(visibleColumns: number, hasHidden: boolean): number {
  return HEADER_HEIGHT + (visibleColumns + (hasHidden ? 1 : 0)) * ROW_HEIGHT + 8;
}

/**
 * Lay tables out on a grid, most-connected first so the busiest tables land
 * top-left where the eye starts. Edges anchor to the specific column rows
 * involved in the foreign key when those rows are visible.
 */
export function layoutDiagram(diagram: SchemaDiagram): DiagramLayout {
  // Rank by how many relationships each table participates in.
  const degree = new Map<string, number>();
  const bump = (t: string) => degree.set(t, (degree.get(t) ?? 0) + 1);
  for (const r of diagram.relations) {
    bump(r.table);
    bump(r.refTable);
  }

  const ordered = [...diagram.tables].sort((a, b) => {
    const d = (degree.get(b.name) ?? 0) - (degree.get(a.name) ?? 0);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  const perRow = Math.max(1, Math.ceil(Math.sqrt(ordered.length || 1)));
  const nodes: LayoutNode[] = [];
  const rowHeights: number[] = [];

  ordered.forEach((t, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const visible = t.columns.slice(0, MAX_VISIBLE_COLUMNS);
    const hiddenCount = Math.max(0, t.columns.length - visible.length);
    const height = nodeHeight(visible.length, hiddenCount > 0);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, height);

    nodes.push({
      table: t.name,
      x: PADDING + col * (NODE_WIDTH + H_GAP),
      y: 0, // filled in below, once each row's tallest node is known
      width: NODE_WIDTH,
      height,
      hiddenCount,
      columns: visible.map((c, idx) => ({
        name: c.name,
        dataType: c.dataType,
        isPrimaryKey: c.isPrimaryKey,
        isForeignKey: c.isForeignKey,
        offsetY: HEADER_HEIGHT + idx * ROW_HEIGHT + ROW_HEIGHT / 2,
      })),
    });
  });

  // Resolve Y once row heights are known so rows never overlap.
  const rowTops: number[] = [];
  let cursor = PADDING;
  rowHeights.forEach((h, r) => {
    rowTops[r] = cursor;
    cursor += h + V_GAP;
  });
  nodes.forEach((n, i) => {
    n.y = rowTops[Math.floor(i / perRow)] ?? PADDING;
  });

  const byTable = new Map(nodes.map((n) => [n.table, n]));

  const edges: LayoutEdge[] = [];
  diagram.relations.forEach((rel, i) => {
    const from = byTable.get(rel.table);
    const to = byTable.get(rel.refTable);
    // Skip relations pointing outside the schema being drawn.
    if (!from || !to) return;

    const fromCol = from.columns.find((c) => c.name === rel.columns[0]);
    const toCol = to.columns.find((c) => c.name === rel.refColumns[0]);
    const y1 = from.y + (fromCol?.offsetY ?? from.height / 2);
    const y2 = to.y + (toCol?.offsetY ?? to.height / 2);

    // Leave from whichever side faces the target, so lines don't cross the box.
    const fromRight = from.x + from.width / 2 <= to.x + to.width / 2;
    const x1 = fromRight ? from.x + from.width : from.x;
    const x2 = fromRight ? to.x : to.x + to.width;

    edges.push({
      id: `${rel.constraintName}-${i}`,
      from: rel.table,
      to: rel.refTable,
      label: `${rel.columns.join(", ")} → ${rel.refColumns.join(", ")}`,
      x1,
      y1,
      x2,
      y2,
    });
  });

  const width =
    nodes.reduce((max, n) => Math.max(max, n.x + n.width), 0) + PADDING;
  const height =
    nodes.reduce((max, n) => Math.max(max, n.y + n.height), 0) + PADDING;

  return { nodes, edges, width, height };
}

/** Bezier path between two anchors, bowing horizontally. */
export function edgePath(e: LayoutEdge): string {
  const dx = Math.max(40, Math.abs(e.x2 - e.x1) / 2);
  const c1 = e.x1 + (e.x2 >= e.x1 ? dx : -dx);
  const c2 = e.x2 - (e.x2 >= e.x1 ? dx : -dx);
  return `M ${e.x1} ${e.y1} C ${c1} ${e.y1}, ${c2} ${e.y2}, ${e.x2} ${e.y2}`;
}
