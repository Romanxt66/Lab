import { type Result, ok, err } from "@/shared/kernel/result";

/** Pretty-print JSON with the given indentation, or report a parse error. */
export function formatJson(input: string, indent = 2): Result<string> {
  const trimmed = input.trim();
  if (!trimmed) return err("Introduce algún JSON.");
  try {
    const parsed = JSON.parse(trimmed);
    return ok(JSON.stringify(parsed, null, indent));
  } catch (e) {
    return err(toParseMessage(e));
  }
}

/** Collapse JSON to a single line. */
export function minifyJson(input: string): Result<string> {
  const trimmed = input.trim();
  if (!trimmed) return err("Introduce algún JSON.");
  try {
    return ok(JSON.stringify(JSON.parse(trimmed)));
  } catch (e) {
    return err(toParseMessage(e));
  }
}

function toParseMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return `JSON inválido: ${msg}`;
}
