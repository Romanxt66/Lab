import { type Result, ok, err } from "@/shared/kernel/result";
import { quoteIdent, quoteQualified } from "./identifier";

/** A statement ready for a parameterized driver call. */
export interface ParameterizedSql {
  text: string;
  values: unknown[];
}

export type SortDirection = "asc" | "desc";

export interface BrowseOptions {
  schema: string;
  table: string;
  limit: number;
  offset: number;
  orderBy?: string | null;
  direction?: SortDirection;
}

export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

/** Clamp a caller-supplied page size into a sane range. */
export function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(limit), MAX_PAGE_SIZE);
}

/**
 * SELECT one page of a table.
 *
 * Fetches `limit + 1` rows so the caller can tell whether a next page exists
 * without paying for a COUNT(*) on every keystroke.
 */
export function buildBrowseRows(opts: BrowseOptions): ParameterizedSql {
  const limit = clampLimit(opts.limit);
  const offset = Math.max(0, Math.floor(opts.offset) || 0);
  const order = opts.orderBy
    ? ` ORDER BY ${quoteIdent(opts.orderBy)} ${opts.direction === "desc" ? "DESC" : "ASC"}`
    : "";
  return {
    text: `SELECT * FROM ${quoteQualified(opts.schema, opts.table)}${order} LIMIT $1 OFFSET $2`,
    values: [limit + 1, offset],
  };
}

export function buildCountRows(schema: string, table: string): ParameterizedSql {
  return { text: `SELECT COUNT(*)::bigint AS n FROM ${quoteQualified(schema, table)}`, values: [] };
}

/** INSERT … RETURNING *, with every value bound as a parameter. */
export function buildInsertRow(
  schema: string,
  table: string,
  values: Record<string, unknown>,
): Result<ParameterizedSql> {
  const entries = Object.entries(values);
  if (entries.length === 0) return err("No hay valores que insertar.");

  const cols = entries.map(([c]) => quoteIdent(c)).join(", ");
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
  return ok({
    text: `INSERT INTO ${quoteQualified(schema, table)} (${cols}) VALUES (${placeholders}) RETURNING *`,
    values: entries.map(([, v]) => v),
  });
}

/**
 * UPDATE … WHERE <primary key> … RETURNING *.
 *
 * `key` must identify exactly one row — the caller passes the table's primary
 * key columns. An empty key is refused rather than silently updating the whole
 * table.
 */
export function buildUpdateRow(
  schema: string,
  table: string,
  values: Record<string, unknown>,
  key: Record<string, unknown>,
): Result<ParameterizedSql> {
  const valueEntries = Object.entries(values);
  const keyEntries = Object.entries(key);
  if (valueEntries.length === 0) return err("No hay cambios que guardar.");
  if (keyEntries.length === 0) {
    return err("No se puede editar una fila sin clave primaria que la identifique.");
  }

  const params: unknown[] = [];
  const sets = valueEntries.map(([c, v]) => {
    params.push(v);
    return `${quoteIdent(c)} = $${params.length}`;
  });
  const wheres = keyEntries.map(([c, v]) => {
    params.push(v);
    return `${quoteIdent(c)} = $${params.length}`;
  });

  return ok({
    text: `UPDATE ${quoteQualified(schema, table)} SET ${sets.join(", ")} WHERE ${wheres.join(" AND ")} RETURNING *`,
    values: params,
  });
}

/** DELETE … WHERE <primary key>. Refuses an empty key (would wipe the table). */
export function buildDeleteRow(
  schema: string,
  table: string,
  key: Record<string, unknown>,
): Result<ParameterizedSql> {
  const keyEntries = Object.entries(key);
  if (keyEntries.length === 0) {
    return err("No se puede borrar una fila sin clave primaria que la identifique.");
  }

  const params: unknown[] = [];
  const wheres = keyEntries.map(([c, v]) => {
    params.push(v);
    return `${quoteIdent(c)} = $${params.length}`;
  });

  return ok({
    text: `DELETE FROM ${quoteQualified(schema, table)} WHERE ${wheres.join(" AND ")}`,
    values: params,
  });
}
