import { type Result, ok, err } from "@/shared/kernel/result";

export interface RegexMatch {
  match: string;
  index: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

export interface RegexOutcome {
  matches: RegexMatch[];
  count: number;
}

const MAX_MATCHES = 10_000; // guard against catastrophic global loops

/** Run a regex against text, returning all matches (or a friendly error). */
export function runRegex(
  pattern: string,
  flags: string,
  text: string,
): Result<RegexOutcome> {
  if (!pattern) return err("Introduce un patrón.");

  let re: RegExp;
  try {
    // Ensure global flag so we can iterate all matches.
    const withGlobal = flags.includes("g") ? flags : flags + "g";
    re = new RegExp(pattern, withGlobal);
  } catch (e) {
    return err(`Expresión inválida: ${e instanceof Error ? e.message : e}`);
  }

  const matches: RegexMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({
      match: m[0],
      index: m.index,
      groups: m.slice(1).map((g) => g ?? ""),
      namedGroups: { ...(m.groups ?? {}) } as Record<string, string>,
    });
    if (m[0] === "") re.lastIndex++; // avoid infinite loop on empty matches
    if (matches.length >= MAX_MATCHES) break;
  }

  return ok({ matches, count: matches.length });
}
