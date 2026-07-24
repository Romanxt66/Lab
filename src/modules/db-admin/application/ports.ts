import type { Result } from "@/shared/kernel/result";
import type { DbConnection } from "@/modules/db-admin/domain/connection";
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from "@/modules/db-admin/domain/schema-info";

export interface DbConnectionRepoPort {
  list(): Promise<DbConnection[]>;
  get(id: string): Promise<DbConnection | null>;
  create(input: {
    name: string;
    connectionUrl: string;
    readOnly: boolean;
  }): Promise<DbConnection>;
  update(
    id: string,
    input: { name: string; connectionUrl: string; readOnly: boolean },
  ): Promise<DbConnection>;
  remove(id: string): Promise<void>;
}

/** One row = an ordered list of values matching `columns`. */
export interface QueryResult {
  columns: string[];
  columnTypes: string[];
  rows: unknown[][];
  rowCount: number;
  /** Milliseconds spent server-side. */
  durationMs: number;
  /** pg command tag: SELECT, INSERT, UPDATE, DELETE... */
  command?: string;
}

/** Executes SQL against a given connection URL. */
export interface SqlExecutorPort {
  test(connectionUrl: string): Promise<Result<{ version: string }>>;
  runQuery(
    connectionUrl: string,
    sql: string,
    options?: { readOnly?: boolean },
  ): Promise<Result<QueryResult>>;
}

/** Reads structural metadata (schemas / tables / columns). */
export interface IntrospectionPort {
  listSchemas(connectionUrl: string): Promise<Result<SchemaInfo[]>>;
  listTables(
    connectionUrl: string,
    schema: string,
  ): Promise<Result<TableInfo[]>>;
  listColumns(
    connectionUrl: string,
    schema: string,
    table: string,
  ): Promise<Result<ColumnInfo[]>>;
}
