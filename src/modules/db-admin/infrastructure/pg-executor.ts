import "server-only";
import pg from "pg";
import { type Result, ok, err } from "@/shared/kernel/result";
import type {
  SqlExecutorPort,
  QueryResult,
} from "@/modules/db-admin/application/ports";

/**
 * pg-based executor. Opens a short-lived client per operation — this tool
 * isn't hot-path, and each query targets a user-managed database that may go
 * up/down independently. Node-postgres tags query results with `command` and
 * per-column `dataTypeID`s, which we translate to friendly labels.
 */
export class PgExecutor implements SqlExecutorPort {
  async test(connectionUrl: string): Promise<Result<{ version: string }>> {
    return this.withClient(connectionUrl, async (client) => {
      const res = await client.query<{ version: string }>("SELECT version()");
      return ok({ version: res.rows[0]?.version ?? "unknown" });
    });
  }

  async runQuery(
    connectionUrl: string,
    sql: string,
    options: { readOnly?: boolean } = {},
  ): Promise<Result<QueryResult>> {
    return this.withClient(connectionUrl, async (client) => {
      // A read-only transaction is enforced server-side when the connection is
      // marked as read-only — no way to escape it from the UI.
      if (options.readOnly) {
        await client.query("BEGIN READ ONLY");
      }
      const started = performance.now();
      try {
        const res = await client.query({ text: sql, rowMode: "array" });
        const durationMs = Math.round(performance.now() - started);
        if (options.readOnly) await client.query("COMMIT");
        const columns = res.fields.map((f) => f.name);
        const columnTypes = res.fields.map((f) => oidLabel(f.dataTypeID));
        // rowMode:"array" gives rows as arrays of unknown[].
        const rows = (res.rows as unknown[][]).map((r) => r.map(serialise));
        return ok({
          columns,
          columnTypes,
          rows,
          rowCount: res.rowCount ?? rows.length,
          durationMs,
          command: res.command,
        });
      } catch (e) {
        if (options.readOnly) {
          try {
            await client.query("ROLLBACK");
          } catch {
            /* ignore */
          }
        }
        throw e;
      }
    });
  }

  private async withClient<T>(
    url: string,
    fn: (client: pg.Client) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    let client: pg.Client | null = null;
    try {
      client = new pg.Client({
        connectionString: url,
        connectionTimeoutMillis: 8_000,
      });
      await client.connect();
      return await fn(client);
    } catch (e) {
      return err(pgErrorMessage(e));
    } finally {
      if (client) await client.end().catch(() => {});
    }
  }
}

/** Serialise a value for JSON transport (Dates → ISO, buffers → hex, etc.). */
function serialise(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return `\\x${Buffer.from(v).toString("hex")}`;
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object") {
    try {
      return v; // objects (json columns) are fine as-is
    } catch {
      return String(v);
    }
  }
  return v;
}

/** Map the most common Postgres OIDs to friendly labels. */
function oidLabel(oid: number): string {
  return OID_MAP[oid] ?? `oid:${oid}`;
}
const OID_MAP: Record<number, string> = {
  16: "boolean",
  17: "bytea",
  20: "bigint",
  21: "smallint",
  23: "integer",
  25: "text",
  114: "json",
  700: "real",
  701: "double",
  1042: "char",
  1043: "varchar",
  1082: "date",
  1083: "time",
  1114: "timestamp",
  1184: "timestamptz",
  1700: "numeric",
  2950: "uuid",
  3802: "jsonb",
};

function pgErrorMessage(e: unknown): string {
  if (!e || typeof e !== "object") return String(e ?? "Error");
  const anyE = e as { message?: string; code?: string; hint?: string; position?: string };
  const parts = [anyE.message ?? "Error de PostgreSQL"];
  if (anyE.code) parts.push(`(code ${anyE.code})`);
  if (anyE.hint) parts.push(`hint: ${anyE.hint}`);
  return parts.join(" ");
}
