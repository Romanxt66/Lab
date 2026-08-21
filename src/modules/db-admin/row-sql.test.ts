import { describe, it, expect } from "vitest";
import { quoteIdent, quoteQualified, validateIdentifier } from "./domain/identifier";
import {
  buildBrowseRows,
  buildCountRows,
  buildInsertRow,
  buildUpdateRow,
  buildDeleteRow,
  clampLimit,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
} from "./domain/row-sql";

describe("quoteIdent", () => {
  it("wraps a plain name in double quotes", () => {
    expect(quoteIdent("users")).toBe('"users"');
  });

  it("preserves case and spaces (that's the point of quoting)", () => {
    expect(quoteIdent("My Table")).toBe('"My Table"');
  });

  it("neutralises an injection attempt by doubling the quote", () => {
    // Without doubling, this would close the identifier and inject a statement.
    expect(quoteIdent('a"; DROP TABLE users; --')).toBe('"a""; DROP TABLE users; --"');
  });

  it("rejects a NUL byte instead of trying to escape it", () => {
    expect(() => quoteIdent("bad\0name")).toThrow();
  });
});

describe("quoteQualified", () => {
  it("quotes both parts separately", () => {
    expect(quoteQualified("public", "users")).toBe('"public"."users"');
  });

  it("does not let a dot in the name split the qualification", () => {
    expect(quoteQualified("a.b", "c")).toBe('"a.b"."c"');
  });
});

describe("validateIdentifier", () => {
  it("accepts and trims a normal name", () => {
    const r = validateIdentifier("  users  ");
    expect(r.ok && r.value).toBe("users");
  });

  it("rejects an empty name", () => {
    expect(validateIdentifier("   ").ok).toBe(false);
  });

  it("rejects a name longer than Postgres' 63-byte limit", () => {
    expect(validateIdentifier("x".repeat(64)).ok).toBe(false);
    expect(validateIdentifier("x".repeat(63)).ok).toBe(true);
  });
});

describe("clampLimit", () => {
  it("caps at the maximum page size", () => {
    expect(clampLimit(10_000)).toBe(MAX_PAGE_SIZE);
  });
  it("falls back to the default for nonsense input", () => {
    expect(clampLimit(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(-5)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("buildBrowseRows", () => {
  it("parameterizes limit/offset and fetches one extra row to detect a next page", () => {
    const q = buildBrowseRows({ schema: "public", table: "users", limit: 50, offset: 100 });
    expect(q.text).toBe('SELECT * FROM "public"."users" LIMIT $1 OFFSET $2');
    expect(q.values).toEqual([51, 100]);
  });

  it("quotes the ORDER BY column and only allows asc/desc", () => {
    const q = buildBrowseRows({
      schema: "public",
      table: "users",
      limit: 10,
      offset: 0,
      orderBy: 'weird"col',
      direction: "desc",
    });
    expect(q.text).toContain('ORDER BY "weird""col" DESC');
  });

  it("defaults to ASC for an unknown direction", () => {
    const q = buildBrowseRows({
      schema: "public",
      table: "t",
      limit: 10,
      offset: 0,
      orderBy: "id",
    });
    expect(q.text).toContain('ORDER BY "id" ASC');
  });

  it("never emits a negative offset", () => {
    const q = buildBrowseRows({ schema: "s", table: "t", limit: 10, offset: -50 });
    expect(q.values[1]).toBe(0);
  });
});

describe("buildCountRows", () => {
  it("counts against the quoted table", () => {
    expect(buildCountRows("public", "users").text).toContain('FROM "public"."users"');
  });
});

describe("buildInsertRow", () => {
  it("binds every value as a parameter", () => {
    const r = buildInsertRow("public", "users", { name: "Ana", age: 30 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.text).toBe(
      'INSERT INTO "public"."users" ("name", "age") VALUES ($1, $2) RETURNING *',
    );
    expect(r.value.values).toEqual(["Ana", 30]);
  });

  it("keeps an injection attempt in a column name inert", () => {
    const r = buildInsertRow("public", "t", { 'a"; DROP TABLE x; --': 1 });
    expect(r.ok && r.value.text).toContain('"a""; DROP TABLE x; --"');
  });

  it("refuses an empty payload", () => {
    expect(buildInsertRow("public", "t", {}).ok).toBe(false);
  });
});

describe("buildUpdateRow", () => {
  it("numbers SET params before WHERE params", () => {
    const r = buildUpdateRow("public", "users", { name: "Ana" }, { id: 7 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.text).toBe(
      'UPDATE "public"."users" SET "name" = $1 WHERE "id" = $2 RETURNING *',
    );
    expect(r.value.values).toEqual(["Ana", 7]);
  });

  it("ANDs a composite key", () => {
    const r = buildUpdateRow("s", "t", { v: 1 }, { a: "x", b: "y" });
    expect(r.ok && r.value.text).toContain('WHERE "a" = $2 AND "b" = $3');
  });

  it("refuses to update without a key (would hit every row)", () => {
    const r = buildUpdateRow("public", "users", { name: "Ana" }, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/clave primaria/i);
  });

  it("refuses an empty change set", () => {
    expect(buildUpdateRow("public", "users", {}, { id: 1 }).ok).toBe(false);
  });
});

describe("buildDeleteRow", () => {
  it("deletes by key with bound params", () => {
    const r = buildDeleteRow("public", "users", { id: 7 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.text).toBe('DELETE FROM "public"."users" WHERE "id" = $1');
    expect(r.value.values).toEqual([7]);
  });

  it("refuses to delete without a key (would wipe the table)", () => {
    const r = buildDeleteRow("public", "users", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/clave primaria/i);
  });
});
