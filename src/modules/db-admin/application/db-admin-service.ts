import { type Result, ok, err } from "@/shared/kernel/result";
import { analyzeSql } from "@/modules/db-admin/domain/sql-analysis";
import { validateConnectionUrl } from "@/modules/db-admin/domain/connection";
import type {
  DbConnectionRepoPort,
  SqlExecutorPort,
  IntrospectionPort,
  QueryResult,
} from "./ports";
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from "@/modules/db-admin/domain/schema-info";
import type { DbConnection } from "@/modules/db-admin/domain/connection";

export interface RunQueryOptions {
  /** Require the user to have confirmed a destructive statement. */
  confirmDestructive?: boolean;
}

/**
 * DbAdminService: use-cases for the DB-admin tool. All UI actions route
 * through this service so the flow stays testable with fakes.
 */
export class DbAdminService {
  constructor(
    private readonly connections: DbConnectionRepoPort,
    private readonly executor: SqlExecutorPort,
    private readonly introspection: IntrospectionPort,
  ) {}

  // --- Connection management -------------------------------------------------

  list(): Promise<DbConnection[]> {
    return this.connections.list();
  }

  async save(input: {
    id?: string;
    name: string;
    connectionUrl: string;
    readOnly: boolean;
  }) {
    if (!input.name.trim()) return err("La conexión necesita un nombre.");
    const url = validateConnectionUrl(input.connectionUrl);
    if (!url.ok) return url;
    const data = {
      name: input.name.trim(),
      connectionUrl: url.value,
      readOnly: input.readOnly,
    };
    const saved = input.id
      ? await this.connections.update(input.id, data)
      : await this.connections.create(data);
    return ok(saved);
  }

  async remove(id: string): Promise<void> {
    await this.connections.remove(id);
  }

  async test(id: string): Promise<Result<{ version: string }>> {
    const conn = await this.connections.get(id);
    if (!conn) return err("Conexión no encontrada.");
    return this.executor.test(conn.connectionUrl);
  }

  // --- Introspection ---------------------------------------------------------

  private async withConn<T>(
    id: string,
    fn: (url: string) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    const conn = await this.connections.get(id);
    if (!conn) return err("Conexión no encontrada.");
    return fn(conn.connectionUrl);
  }

  listSchemas(id: string): Promise<Result<SchemaInfo[]>> {
    return this.withConn(id, (url) => this.introspection.listSchemas(url));
  }
  listTables(id: string, schema: string): Promise<Result<TableInfo[]>> {
    return this.withConn(id, (url) =>
      this.introspection.listTables(url, schema),
    );
  }
  listColumns(
    id: string,
    schema: string,
    table: string,
  ): Promise<Result<ColumnInfo[]>> {
    return this.withConn(id, (url) =>
      this.introspection.listColumns(url, schema, table),
    );
  }

  // --- Query -----------------------------------------------------------------

  async runQuery(
    id: string,
    sql: string,
    options: RunQueryOptions = {},
  ): Promise<Result<QueryResult>> {
    if (!sql.trim()) return err("Introduce una consulta.");
    const conn = await this.connections.get(id);
    if (!conn) return err("Conexión no encontrada.");

    const analysis = analyzeSql(sql);
    if (analysis.risk === "destructive" && !options.confirmDestructive) {
      const label = analysis.isUnbounded
        ? `${analysis.keyword} sin WHERE afecta todas las filas`
        : `Sentencia ${analysis.keyword}`;
      return err(`⚠️ ${label}. Confirma para ejecutar.`);
    }
    if (conn.readOnly && analysis.risk !== "safe") {
      return err(
        `La conexión "${conn.name}" está en modo solo lectura. Desactívalo si de verdad quieres modificar datos.`,
      );
    }

    return this.executor.runQuery(conn.connectionUrl, sql, {
      readOnly: conn.readOnly,
    });
  }
}
