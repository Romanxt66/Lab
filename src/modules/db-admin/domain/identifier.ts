import { type Result, ok, err } from "@/shared/kernel/result";

/**
 * SQL identifier quoting.
 *
 * Values in a query can be parameterized ($1, $2…), but identifiers (schema,
 * table, column names) CANNOT — they have to be interpolated. Doing that
 * naively is a SQL-injection hole, so every identifier that reaches a
 * statement builder must go through here first.
 *
 * Postgres rules: wrap in double quotes and double any embedded double quote.
 * A NUL byte can truncate the statement server-side, so reject it outright
 * rather than trying to escape it.
 */
export function quoteIdent(name: string): string {
  if (name.includes("\0")) {
    throw new Error("Identificador inválido: contiene un byte nulo.");
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/** `"schema"."table"` — both parts quoted. */
export function quoteQualified(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

/**
 * Validate an identifier before it is used to build a statement. Empty and
 * over-long names are rejected (Postgres truncates at 63 bytes, which would
 * silently target a different object than the caller intended).
 */
export function validateIdentifier(name: string, label = "identificador"): Result<string> {
  const trimmed = name.trim();
  if (!trimmed) return err(`El ${label} no puede estar vacío.`);
  if (trimmed.includes("\0")) return err(`El ${label} contiene caracteres no válidos.`);
  if (Buffer.byteLength(trimmed, "utf8") > 63) {
    return err(`El ${label} supera los 63 bytes que admite PostgreSQL.`);
  }
  return ok(trimmed);
}
