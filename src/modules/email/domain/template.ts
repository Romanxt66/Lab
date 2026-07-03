/**
 * Template domain: pure `{{variable}}` interpolation. No I/O, no framework.
 */

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** List the unique variable names referenced in a template string. */
export function extractVariables(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) names.add(m[1]);
  return [...names];
}

/**
 * Replace `{{name}}` placeholders with values. Missing variables are left as
 * an empty string so a half-filled template never leaks `{{...}}` to a user.
 */
export function renderTemplate(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(VAR_RE, (_, name: string) => vars[name] ?? "");
}
