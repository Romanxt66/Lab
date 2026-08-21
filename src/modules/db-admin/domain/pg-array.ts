/**
 * Coerce a Postgres array column into a JS string array.
 *
 * node-postgres only auto-parses array types it has a registered parser for
 * (text[], int[], …). Less common ones — notably `name[]`, which is what you
 * get from `ARRAY(SELECT attname …)` — arrive as the raw literal `{a,b,c}`.
 * Queries should cast to ::text[] so this rarely matters, but a caller that
 * forgets would otherwise hand a string to code expecting an array and blow
 * up at the first `.forEach`, so parse defensively here.
 */
export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return [];
  const inner = trimmed.slice(1, -1);
  if (!inner) return [];

  // Split on commas that aren't inside a quoted element.
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "\\" && quoted) {
      current += inner[++i] ?? "";
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}
