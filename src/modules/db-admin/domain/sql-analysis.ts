/**
 * Best-effort static analysis of a SQL string. Not a real parser — meant to
 * catch obvious cases in the UI so the user has to confirm before firing a
 * destructive statement. Real safety comes from using DB-level roles.
 */

/** Strip SQL comments so keyword matching isn't fooled by them. */
export function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*$/gm, "") // line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // block comments
}

export type Risk = "safe" | "modifying" | "destructive";

export interface SqlAnalysis {
  risk: Risk;
  /** True when the statement is a DELETE / UPDATE without a WHERE clause. */
  isUnbounded: boolean;
  /** Which keyword raised the flag, for a friendly message. */
  keyword?: string;
}

const DESTRUCTIVE = /^(DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|RESET|VACUUM)\b/i;
const MODIFYING = /^(INSERT|UPDATE|DELETE|MERGE|UPSERT)\b/i;

export function analyzeSql(rawSql: string): SqlAnalysis {
  const sql = stripComments(rawSql).trim();
  // Look at the first executable statement's leading keyword.
  const first = sql.split(/;\s*/).find((s) => s.trim()) ?? "";
  const head = first.trimStart();

  const destructive = head.match(DESTRUCTIVE);
  if (destructive) {
    return { risk: "destructive", isUnbounded: false, keyword: destructive[1].toUpperCase() };
  }

  const modifying = head.match(MODIFYING);
  if (modifying) {
    const keyword = modifying[1].toUpperCase();
    // UPDATE / DELETE without a WHERE clause hits every row → treat as destructive.
    const isMassChange = /^(UPDATE|DELETE)\b/i.test(head) && !/\bWHERE\b/i.test(head);
    return {
      risk: isMassChange ? "destructive" : "modifying",
      isUnbounded: isMassChange,
      keyword,
    };
  }

  return { risk: "safe", isUnbounded: false };
}
