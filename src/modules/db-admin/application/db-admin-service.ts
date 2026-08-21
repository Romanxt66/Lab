import { type Result, ok, err } from "@/shared/kernel/result";
import { analyzeSql } from "@/modules/db-admin/domain/sql-analysis";
import { validateConnectionUrl } from "@/modules/db-admin/domain/connection";
import { validateIdentifier } from "@/modules/db-admin/domain/identifier";
import {
  buildBrowseRows,
  buildInsertRow,
  buildUpdateRow,
  buildDeleteRow,
  clampLimit,
  type ParameterizedSql,
  type SortDirection,
} from "@/modules/db-admin/domain/row-sql";
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
  TableDetail,
  SchemaDiagram,
} from "@/modules/db-admin/domain/schema-info";
import type { DbConnection } from "@/modules/db-admin/domain/connection";

export interface RunQueryOptions {
  /** Require the user to have confirmed a destructive statement. */
  confirmDestructive?: boolean;
}

/** A page of table rows, plus whether another page follows. */
export interface BrowseResult extends QueryResult {
  hasMore: boolean;
  limit: number;
  offset: number;
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

  /** Columns + indexes + both directions of foreign keys, for one table. */
  async tableDetail(
    id: string,
    schema: string,
    table: string,
  ): Promise<Result<TableDetail>> {
    return this.withConn(id, async (url) => {
      const [columns, indexes, fks] = await Promise.all([
        this.introspection.listColumns(url, schema, table),
        this.introspection.listIndexes(url, schema, table),
        this.introspection.listForeignKeys(url, schema),
      ]);
      if (!columns.ok) return columns;
      if (!indexes.ok) return indexes;
      if (!fks.ok) return fks;

      const outgoing = fks.value.filter((f) => f.table === table);
      const incoming = fks.value.filter(
        (f) => f.refTable === table && f.refSchema === schema,
      );

      // Annotate each column with where it points, for the FK badge.
      const refByColumn = new Map<string, { schema: string; table: string; column: string }>();
      for (const fk of outgoing) {
        fk.columns.forEach((col, i) => {
          refByColumn.set(col, {
            schema: fk.refSchema,
            table: fk.refTable,
            column: fk.refColumns[i] ?? "",
          });
        });
      }

      return ok({
        columns: columns.value.map((c) => ({
          ...c,
          references: refByColumn.get(c.name) ?? null,
        })),
        indexes: indexes.value,
        foreignKeys: outgoing,
        referencedBy: incoming,
      });
    });
  }

  /**
   * Everything the relationship diagram needs, in one round trip: each table's
   * columns plus the FK edges between them.
   */
  async schemaDiagram(id: string, schema: string): Promise<Result<SchemaDiagram>> {
    return this.withConn(id, async (url) => {
      const [tables, fks] = await Promise.all([
        this.introspection.listTables(url, schema),
        this.introspection.listForeignKeys(url, schema),
      ]);
      if (!tables.ok) return tables;
      if (!fks.ok) return fks;

      const fkColumnsByTable = new Map<string, Set<string>>();
      for (const fk of fks.value) {
        const set = fkColumnsByTable.get(fk.table) ?? new Set<string>();
        fk.columns.forEach((c) => set.add(c));
        fkColumnsByTable.set(fk.table, set);
      }

      const withColumns = await Promise.all(
        tables.value.map(async (t) => {
          const cols = await this.introspection.listColumns(url, schema, t.name);
          const fkCols = fkColumnsByTable.get(t.name) ?? new Set<string>();
          return {
            schema,
            name: t.name,
            columns: cols.ok
              ? cols.value.map((c) => ({
                  name: c.name,
                  dataType: c.dataType,
                  isPrimaryKey: c.isPrimaryKey,
                  isForeignKey: fkCols.has(c.name),
                }))
              : [],
          };
        }),
      );

      return ok({ tables: withColumns, relations: fks.value });
    });
  }

  // --- Row browsing & editing -------------------------------------------------

  /**
   * One page of a table's rows. Asks for `limit + 1` rows and reports
   * `hasMore` instead of running a COUNT(*) on every page turn.
   */
  async browseRows(
    id: string,
    schema: string,
    table: string,
    opts: { limit?: number; offset?: number; orderBy?: string | null; direction?: SortDirection } = {},
  ): Promise<Result<BrowseResult>> {
    const names = this.validateTarget(schema, table);
    if (!names.ok) return names;

    return this.withConn(id, async (url) => {
      const limit = clampLimit(opts.limit ?? 0);
      const offset = Math.max(0, opts.offset ?? 0);
      const q = buildBrowseRows({ schema, table, limit, offset, orderBy: opts.orderBy, direction: opts.direction });
      // Always read-only: browsing must never be able to mutate.
      const res = await this.executor.runParameterized(url, q.text, q.values, {
        readOnly: true,
      });
      if (!res.ok) return res;

      const hasMore = res.value.rows.length > limit;
      return ok({
        ...res.value,
        rows: hasMore ? res.value.rows.slice(0, limit) : res.value.rows,
        hasMore,
        limit,
        offset,
      });
    });
  }

  async insertRow(
    id: string,
    schema: string,
    table: string,
    values: Record<string, unknown>,
  ): Promise<Result<QueryResult>> {
    return this.mutateRow(id, schema, table, () => buildInsertRow(schema, table, values));
  }

  async updateRow(
    id: string,
    schema: string,
    table: string,
    values: Record<string, unknown>,
    key: Record<string, unknown>,
  ): Promise<Result<QueryResult>> {
    return this.mutateRow(id, schema, table, () =>
      buildUpdateRow(schema, table, values, key),
    );
  }

  async deleteRow(
    id: string,
    schema: string,
    table: string,
    key: Record<string, unknown>,
  ): Promise<Result<QueryResult>> {
    return this.mutateRow(id, schema, table, () => buildDeleteRow(schema, table, key));
  }

  /** Shared guard rail for the three row mutations. */
  private async mutateRow(
    id: string,
    schema: string,
    table: string,
    build: () => Result<ParameterizedSql>,
  ): Promise<Result<QueryResult>> {
    const names = this.validateTarget(schema, table);
    if (!names.ok) return names;

    const conn = await this.connections.get(id);
    if (!conn) return err("Conexión no encontrada.");
    if (conn.readOnly) {
      return err(
        `La conexión "${conn.name}" está en modo solo lectura. Desactívalo si de verdad quieres modificar datos.`,
      );
    }

    const stmt = build();
    if (!stmt.ok) return stmt;
    return this.executor.runParameterized(conn.connectionUrl, stmt.value.text, stmt.value.values);
  }

  private validateTarget(schema: string, table: string): Result<true> {
    const s = validateIdentifier(schema, "esquema");
    if (!s.ok) return s;
    const t = validateIdentifier(table, "nombre de tabla");
    if (!t.ok) return t;
    return ok(true);
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
