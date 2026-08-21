"use server";

import { type Result, ok } from "@/shared/kernel/result";
import { getDbAdminService } from "@/shared/di/container";
import {
  toDTO,
  type DbConnectionDTO,
} from "@/modules/db-admin/domain/connection";
import type {
  QueryResult,
} from "@/modules/db-admin/application/ports";
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  TableDetail,
  SchemaDiagram,
} from "@/modules/db-admin/domain/schema-info";
import type { BrowseResult } from "@/modules/db-admin/application/db-admin-service";
import type { SortDirection } from "@/modules/db-admin/domain/row-sql";
import { analyzeSql } from "@/modules/db-admin/domain/sql-analysis";

// --- Connections -----------------------------------------------------------

export async function listConnectionsAction(): Promise<DbConnectionDTO[]> {
  const conns = await getDbAdminService().list();
  return conns.map(toDTO);
}

export async function saveConnectionAction(input: {
  id?: string;
  name: string;
  connectionUrl: string;
  readOnly: boolean;
}): Promise<Result<DbConnectionDTO>> {
  const res = await getDbAdminService().save(input);
  return res.ok ? ok(toDTO(res.value)) : res;
}

export async function deleteConnectionAction(id: string): Promise<void> {
  await getDbAdminService().remove(id);
}

export async function testConnectionAction(
  id: string,
): Promise<Result<{ version: string }>> {
  return getDbAdminService().test(id);
}

// --- Introspection ---------------------------------------------------------

export async function listSchemasAction(
  id: string,
): Promise<Result<SchemaInfo[]>> {
  return getDbAdminService().listSchemas(id);
}

export async function listTablesAction(
  id: string,
  schema: string,
): Promise<Result<TableInfo[]>> {
  return getDbAdminService().listTables(id, schema);
}

export async function listColumnsAction(
  id: string,
  schema: string,
  table: string,
): Promise<Result<ColumnInfo[]>> {
  return getDbAdminService().listColumns(id, schema, table);
}

export async function tableDetailAction(
  id: string,
  schema: string,
  table: string,
): Promise<Result<TableDetail>> {
  return getDbAdminService().tableDetail(id, schema, table);
}

export async function schemaDiagramAction(
  id: string,
  schema: string,
): Promise<Result<SchemaDiagram>> {
  return getDbAdminService().schemaDiagram(id, schema);
}

// --- Row browsing & editing -------------------------------------------------

export async function browseRowsAction(
  id: string,
  schema: string,
  table: string,
  opts: {
    limit?: number;
    offset?: number;
    orderBy?: string | null;
    direction?: SortDirection;
  } = {},
): Promise<Result<BrowseResult>> {
  return getDbAdminService().browseRows(id, schema, table, opts);
}

export async function insertRowAction(
  id: string,
  schema: string,
  table: string,
  values: Record<string, unknown>,
): Promise<Result<QueryResult>> {
  return getDbAdminService().insertRow(id, schema, table, values);
}

export async function updateRowAction(
  id: string,
  schema: string,
  table: string,
  values: Record<string, unknown>,
  key: Record<string, unknown>,
): Promise<Result<QueryResult>> {
  return getDbAdminService().updateRow(id, schema, table, values, key);
}

export async function deleteRowAction(
  id: string,
  schema: string,
  table: string,
  key: Record<string, unknown>,
): Promise<Result<QueryResult>> {
  return getDbAdminService().deleteRow(id, schema, table, key);
}

// --- Query -----------------------------------------------------------------

/** Server-side SQL risk analysis, mirrored to the UI. */
export async function analyzeSqlAction(
  sql: string,
): Promise<ReturnType<typeof analyzeSql>> {
  return analyzeSql(sql);
}

export async function runQueryAction(
  id: string,
  sql: string,
  confirmDestructive = false,
): Promise<Result<QueryResult>> {
  return getDbAdminService().runQuery(id, sql, { confirmDestructive });
}
