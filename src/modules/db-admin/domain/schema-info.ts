/**
 * Types describing a database's structure, returned by IntrospectionPort.
 */

export interface SchemaInfo {
  name: string;
  /** Non-user schemas from Postgres (pg_catalog, information_schema, …). */
  isSystem: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
  /** "BASE TABLE" | "VIEW" | "MATERIALIZED VIEW" | ... */
  kind: string;
  /** Approximate row count (from pg_class.reltuples). */
  rowsApprox: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  default: string | null;
  ordinalPosition: number;
}
