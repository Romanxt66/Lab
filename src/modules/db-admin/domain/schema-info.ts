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

/** Where a foreign-key column points. */
export interface ColumnReference {
  schema: string;
  table: string;
  column: string;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  default: string | null;
  ordinalPosition: number;
  /** Set when this column is (part of) a foreign key. */
  references?: ColumnReference | null;
}

/** A foreign-key constraint, used for the relationship diagram. */
export interface ForeignKeyInfo {
  constraintName: string;
  schema: string;
  table: string;
  columns: string[];
  refSchema: string;
  refTable: string;
  refColumns: string[];
}

export interface IndexInfo {
  name: string;
  isUnique: boolean;
  isPrimary: boolean;
  /** Full `CREATE INDEX …` statement as reported by Postgres. */
  definition: string;
}

/** Everything the "Estructura" tab shows for one table. */
export interface TableDetail {
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  /** FKs declared on this table (this table → another). */
  foreignKeys: ForeignKeyInfo[];
  /** FKs on other tables pointing at this one. */
  referencedBy: ForeignKeyInfo[];
}

/** Data behind the schema diagram: every table plus the edges between them. */
export interface SchemaDiagram {
  tables: {
    schema: string;
    name: string;
    columns: { name: string; dataType: string; isPrimaryKey: boolean; isForeignKey: boolean }[];
  }[];
  relations: ForeignKeyInfo[];
}
