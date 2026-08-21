import { describe, it, expect } from "vitest";
import { ok, type Result } from "@/shared/kernel/result";
import {
  hostFromUrl,
  validateConnectionUrl,
  type DbConnection,
} from "./domain/connection";
import { analyzeSql, stripComments } from "./domain/sql-analysis";
import { DbAdminService } from "./application/db-admin-service";
import type {
  DbConnectionRepoPort,
  SqlExecutorPort,
  IntrospectionPort,
  QueryResult,
} from "./application/ports";
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
} from "./domain/schema-info";

describe("connection URL", () => {
  it("accepts postgres:// and postgresql://", () => {
    expect(
      validateConnectionUrl("postgres://u:p@h:5432/db").ok,
    ).toBe(true);
    expect(
      validateConnectionUrl("postgresql://u:p@h:5432/db").ok,
    ).toBe(true);
  });
  it("rejects other schemes and garbage", () => {
    expect(validateConnectionUrl("mysql://u@h/db").ok).toBe(false);
    expect(validateConnectionUrl("nope").ok).toBe(false);
  });
  it("strips accidental surrounding quotes", () => {
    const r = validateConnectionUrl('"postgres://u:p@h:5432/db"');
    expect(r.ok && r.value).toBe("postgres://u:p@h:5432/db");
  });
  it("extracts host:port", () => {
    expect(hostFromUrl("postgres://u:p@host.local:5433/db")).toBe(
      "host.local:5433",
    );
  });
});

describe("sql-analysis", () => {
  it("strips comments", () => {
    expect(stripComments("-- a\nSELECT 1")).toContain("SELECT 1");
    expect(stripComments("/* b */ SELECT 2")).toContain("SELECT 2");
  });

  it("labels SELECT as safe", () => {
    expect(analyzeSql("SELECT * FROM t").risk).toBe("safe");
  });
  it("labels INSERT as modifying", () => {
    const a = analyzeSql("INSERT INTO t(x) VALUES(1)");
    expect(a.risk).toBe("modifying");
    expect(a.keyword).toBe("INSERT");
  });
  it("labels UPDATE with WHERE as modifying", () => {
    expect(analyzeSql("UPDATE t SET x=1 WHERE id=2").risk).toBe("modifying");
  });
  it("labels UPDATE without WHERE as destructive+unbounded", () => {
    const a = analyzeSql("UPDATE t SET x=1");
    expect(a.risk).toBe("destructive");
    expect(a.isUnbounded).toBe(true);
  });
  it("labels DELETE without WHERE as destructive+unbounded", () => {
    const a = analyzeSql("DELETE FROM t");
    expect(a.risk).toBe("destructive");
    expect(a.isUnbounded).toBe(true);
  });
  it("labels DROP/TRUNCATE as destructive", () => {
    expect(analyzeSql("DROP TABLE t").risk).toBe("destructive");
    expect(analyzeSql("TRUNCATE t").risk).toBe("destructive");
    expect(analyzeSql("ALTER TABLE t ADD c INT").risk).toBe("destructive");
  });
  it("ignores comments before the keyword", () => {
    const a = analyzeSql("-- danger! DROP TABLE t\nSELECT 1");
    expect(a.risk).toBe("safe");
  });
});

// --- Fake ports ---
const sample: DbConnection = {
  id: "c1",
  name: "prod",
  connectionUrl: "postgres://u:p@h:5432/db",
  readOnly: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function repo(list: DbConnection[] = [sample]): DbConnectionRepoPort {
  return {
    async list() {
      return list;
    },
    async get(id) {
      return list.find((c) => c.id === id) ?? null;
    },
    async create() {
      throw new Error("nope");
    },
    async update() {
      throw new Error("nope");
    },
    async remove() {},
  };
}

class FakeExecutor implements SqlExecutorPort {
  calls: Array<{ url: string; sql: string; readOnly?: boolean }> = [];
  paramCalls: Array<{ sql: string; values: unknown[]; readOnly?: boolean }> = [];
  /** Rows handed back by runParameterized; override to test pagination. */
  paramRows: unknown[][] = [[1]];

  async test(url: string) {
    return ok({ version: `pg-${url}` });
  }
  async runQuery(
    url: string,
    sql: string,
    opts?: { readOnly?: boolean },
  ): Promise<Result<QueryResult>> {
    this.calls.push({ url, sql, readOnly: opts?.readOnly });
    return ok({
      columns: ["a"],
      columnTypes: ["integer"],
      rows: [[1]],
      rowCount: 1,
      durationMs: 1,
      command: "SELECT",
    });
  }
  async runParameterized(
    _url: string,
    sql: string,
    values: unknown[],
    opts?: { readOnly?: boolean },
  ): Promise<Result<QueryResult>> {
    this.paramCalls.push({ sql, values, readOnly: opts?.readOnly });
    return ok({
      columns: ["a"],
      columnTypes: ["integer"],
      rows: this.paramRows,
      rowCount: this.paramRows.length,
      durationMs: 1,
      command: "SELECT",
    });
  }
}

class FakeIntrospection implements IntrospectionPort {
  async listSchemas(): Promise<Result<SchemaInfo[]>> {
    return ok([]);
  }
  async listTables(): Promise<Result<TableInfo[]>> {
    return ok([]);
  }
  async listColumns(): Promise<Result<ColumnInfo[]>> {
    return ok([]);
  }
  async listForeignKeys(): Promise<Result<ForeignKeyInfo[]>> {
    return ok([]);
  }
  async listIndexes(): Promise<Result<IndexInfo[]>> {
    return ok([]);
  }
}

describe("DbAdminService.runQuery", () => {
  it("passes SELECT straight through", async () => {
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo(), exec, new FakeIntrospection());
    const r = await svc.runQuery("c1", "SELECT 1");
    expect(r.ok).toBe(true);
    expect(exec.calls).toHaveLength(1);
  });

  it("blocks destructive statements without confirmation", async () => {
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo(), exec, new FakeIntrospection());
    const r = await svc.runQuery("c1", "DROP TABLE t");
    expect(r.ok).toBe(false);
    expect(exec.calls).toHaveLength(0);
  });

  it("allows destructive statements when confirmed", async () => {
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo(), exec, new FakeIntrospection());
    const r = await svc.runQuery("c1", "DROP TABLE t", { confirmDestructive: true });
    expect(r.ok).toBe(true);
    expect(exec.calls).toHaveLength(1);
  });

  it("blocks any modification when connection is read-only", async () => {
    const roConn = { ...sample, readOnly: true };
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo([roConn]), exec, new FakeIntrospection());
    const r = await svc.runQuery("c1", "INSERT INTO t(x) VALUES(1)");
    expect(r.ok).toBe(false);
    expect(exec.calls).toHaveLength(0);
  });

  it("threads through readOnly to the executor for SELECT on RO connection", async () => {
    const roConn = { ...sample, readOnly: true };
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo([roConn]), exec, new FakeIntrospection());
    await svc.runQuery("c1", "SELECT 1");
    expect(exec.calls[0].readOnly).toBe(true);
  });
});

describe("DbAdminService.browseRows", () => {
  function svcWith(exec: FakeExecutor, conns = [sample]) {
    return new DbAdminService(repo(conns), exec, new FakeIntrospection());
  }

  it("always browses inside a read-only transaction, even on a writable connection", async () => {
    const exec = new FakeExecutor();
    await svcWith(exec).browseRows("c1", "public", "users");
    expect(exec.paramCalls[0].readOnly).toBe(true);
  });

  it("reports hasMore and trims the probe row when a next page exists", async () => {
    const exec = new FakeExecutor();
    // limit 2 → the service asks for 3; returning 3 means there is more.
    exec.paramRows = [[1], [2], [3]];
    const r = await svcWith(exec).browseRows("c1", "public", "users", { limit: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.hasMore).toBe(true);
    expect(r.value.rows).toHaveLength(2);
  });

  it("reports hasMore=false on the last page", async () => {
    const exec = new FakeExecutor();
    exec.paramRows = [[1], [2]];
    const r = await svcWith(exec).browseRows("c1", "public", "users", { limit: 2 });
    expect(r.ok && r.value.hasMore).toBe(false);
    expect(r.ok && r.value.rows).toHaveLength(2);
  });

  it("rejects an empty table name before touching the database", async () => {
    const exec = new FakeExecutor();
    const r = await svcWith(exec).browseRows("c1", "public", "   ");
    expect(r.ok).toBe(false);
    expect(exec.paramCalls).toHaveLength(0);
  });
});

describe("DbAdminService row mutations", () => {
  const roConn = { ...sample, readOnly: true };

  it("refuses insert/update/delete on a read-only connection", async () => {
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo([roConn]), exec, new FakeIntrospection());

    const ins = await svc.insertRow("c1", "public", "users", { name: "Ana" });
    const upd = await svc.updateRow("c1", "public", "users", { name: "Ana" }, { id: 1 });
    const del = await svc.deleteRow("c1", "public", "users", { id: 1 });

    expect(ins.ok).toBe(false);
    expect(upd.ok).toBe(false);
    expect(del.ok).toBe(false);
    expect(exec.paramCalls).toHaveLength(0);
  });

  it("inserts with bound values on a writable connection", async () => {
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo(), exec, new FakeIntrospection());
    const r = await svc.insertRow("c1", "public", "users", { name: "Ana", age: 30 });
    expect(r.ok).toBe(true);
    expect(exec.paramCalls[0].sql).toContain('INSERT INTO "public"."users"');
    expect(exec.paramCalls[0].values).toEqual(["Ana", 30]);
  });

  it("refuses an update with no primary key to target the row", async () => {
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo(), exec, new FakeIntrospection());
    const r = await svc.updateRow("c1", "public", "users", { name: "Ana" }, {});
    expect(r.ok).toBe(false);
    expect(exec.paramCalls).toHaveLength(0);
  });

  it("refuses a delete with no primary key to target the row", async () => {
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo(), exec, new FakeIntrospection());
    const r = await svc.deleteRow("c1", "public", "users", {});
    expect(r.ok).toBe(false);
    expect(exec.paramCalls).toHaveLength(0);
  });

  it("fails cleanly when the connection does not exist", async () => {
    const exec = new FakeExecutor();
    const svc = new DbAdminService(repo([]), exec, new FakeIntrospection());
    const r = await svc.insertRow("nope", "public", "users", { a: 1 });
    expect(r.ok).toBe(false);
    expect(exec.paramCalls).toHaveLength(0);
  });
});

describe("DbAdminService.tableDetail", () => {
  it("splits foreign keys into outgoing and incoming, and tags the column", async () => {
    class Intro extends FakeIntrospection {
      override async listColumns(): Promise<Result<ColumnInfo[]>> {
        return ok([
          {
            name: "author_id",
            dataType: "uuid",
            isNullable: false,
            isPrimaryKey: false,
            default: null,
            ordinalPosition: 1,
          },
        ]);
      }
      override async listForeignKeys(): Promise<Result<ForeignKeyInfo[]>> {
        return ok([
          {
            constraintName: "posts_author_fk",
            schema: "public",
            table: "posts",
            columns: ["author_id"],
            refSchema: "public",
            refTable: "users",
            refColumns: ["id"],
          },
          {
            constraintName: "comments_post_fk",
            schema: "public",
            table: "comments",
            columns: ["post_id"],
            refSchema: "public",
            refTable: "posts",
            refColumns: ["id"],
          },
        ]);
      }
    }
    const svc = new DbAdminService(repo(), new FakeExecutor(), new Intro());
    const r = await svc.tableDetail("c1", "public", "posts");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.foreignKeys.map((f) => f.constraintName)).toEqual(["posts_author_fk"]);
    expect(r.value.referencedBy.map((f) => f.constraintName)).toEqual(["comments_post_fk"]);
    expect(r.value.columns[0].references).toEqual({
      schema: "public",
      table: "users",
      column: "id",
    });
  });
});
