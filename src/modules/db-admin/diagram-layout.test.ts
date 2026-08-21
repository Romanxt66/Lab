import { describe, it, expect } from "vitest";
import {
  layoutDiagram,
  edgePath,
  MAX_VISIBLE_COLUMNS,
  NODE_WIDTH,
} from "./domain/diagram-layout";
import type { SchemaDiagram, ForeignKeyInfo } from "./domain/schema-info";

function table(name: string, columnNames: string[] = ["id"]) {
  return {
    schema: "public",
    name,
    columns: columnNames.map((c) => ({
      name: c,
      dataType: "text",
      isPrimaryKey: c === "id",
      isForeignKey: c.endsWith("_id"),
    })),
  };
}

function fk(from: string, col: string, to: string, refCol = "id"): ForeignKeyInfo {
  return {
    constraintName: `${from}_${col}_fk`,
    schema: "public",
    table: from,
    columns: [col],
    refSchema: "public",
    refTable: to,
    refColumns: [refCol],
  };
}

function diagram(tables: SchemaDiagram["tables"], relations: ForeignKeyInfo[] = []): SchemaDiagram {
  return { tables, relations };
}

describe("layoutDiagram", () => {
  it("places every table and reports a canvas big enough to contain them", () => {
    const l = layoutDiagram(diagram([table("a"), table("b"), table("c")]));
    expect(l.nodes).toHaveLength(3);
    for (const n of l.nodes) {
      expect(n.x + n.width).toBeLessThanOrEqual(l.width);
      expect(n.y + n.height).toBeLessThanOrEqual(l.height);
    }
  });

  it("never overlaps two nodes", () => {
    const l = layoutDiagram(
      diagram([table("a"), table("b"), table("c"), table("d"), table("e")]),
    );
    for (let i = 0; i < l.nodes.length; i++) {
      for (let j = i + 1; j < l.nodes.length; j++) {
        const a = l.nodes[i];
        const b = l.nodes[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("orders the most-connected table first so it lands top-left", () => {
    const l = layoutDiagram(
      diagram(
        [table("lonely"), table("hub"), table("x", ["id", "hub_id"]), table("y", ["id", "hub_id"])],
        [fk("x", "hub_id", "hub"), fk("y", "hub_id", "hub")],
      ),
    );
    expect(l.nodes[0].table).toBe("hub");
  });

  it("truncates a very wide table and reports how many columns are hidden", () => {
    const many = Array.from({ length: MAX_VISIBLE_COLUMNS + 5 }, (_, i) => `c${i}`);
    const l = layoutDiagram(diagram([table("wide", many)]));
    expect(l.nodes[0].columns).toHaveLength(MAX_VISIBLE_COLUMNS);
    expect(l.nodes[0].hiddenCount).toBe(5);
  });

  it("anchors an edge to the exact column rows of the foreign key", () => {
    const l = layoutDiagram(
      diagram(
        [table("posts", ["id", "author_id"]), table("users", ["id"])],
        [fk("posts", "author_id", "users")],
      ),
    );
    expect(l.edges).toHaveLength(1);
    const posts = l.nodes.find((n) => n.table === "posts")!;
    const authorRow = posts.columns.find((c) => c.name === "author_id")!;
    expect(l.edges[0].y1).toBe(posts.y + authorRow.offsetY);
  });

  it("skips relations pointing at a table outside this schema", () => {
    const l = layoutDiagram(
      diagram([table("posts", ["id", "author_id"])], [fk("posts", "author_id", "elsewhere")]),
    );
    expect(l.edges).toHaveLength(0);
  });

  it("handles an empty schema without crashing", () => {
    const l = layoutDiagram(diagram([]));
    expect(l.nodes).toEqual([]);
    expect(l.edges).toEqual([]);
    expect(l.width).toBeGreaterThan(0);
  });

  it("gives every node the same fixed width", () => {
    const l = layoutDiagram(diagram([table("a"), table("b", ["id", "x", "y"])]));
    expect(l.nodes.every((n) => n.width === NODE_WIDTH)).toBe(true);
  });
});

describe("edgePath", () => {
  it("produces a cubic bezier from the first anchor to the second", () => {
    const d = edgePath({ id: "e", from: "a", to: "b", label: "", x1: 0, y1: 10, x2: 100, y2: 50 });
    expect(d.startsWith("M 0 10 C")).toBe(true);
    expect(d.endsWith("100 50")).toBe(true);
  });
});
