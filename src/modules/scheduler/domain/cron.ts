import { type Result, ok, err } from "@/shared/kernel/result";

/**
 * Minimal, dependency-free cron matcher for standard 5-field expressions:
 *   minute(0-59) hour(0-23) day-of-month(1-31) month(1-12) day-of-week(0-6, 0=Sun)
 *
 * Supports: "*", step "/n", single "a", range "a-b", "a-b/n", and comma lists.
 * Used by both the local node-cron adapter (validation) and the HTTP cron
 * endpoint (due-check), so the schedule behaves identically in both modes.
 */

interface FieldSpec {
  min: number;
  max: number;
}

const FIELDS: FieldSpec[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 }, // day of week
];

function parseField(field: string, spec: FieldSpec): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    if (stepPart && (!Number.isInteger(step) || step <= 0)) return null;

    let lo: number;
    let hi: number;
    if (rangePart === "*") {
      lo = spec.min;
      hi = spec.max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
      lo = a;
      hi = b;
    } else {
      const n = Number(rangePart);
      if (!Number.isInteger(n)) return null;
      lo = n;
      hi = n;
    }
    if (lo < spec.min || hi > spec.max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return values;
}

/** Validate a 5-field cron expression. */
export function isValidCron(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((f, i) => parseField(f, FIELDS[i]) !== null);
}

/** Parse a cron expression into per-field value sets. */
export function parseCron(expr: string): Result<Set<number>[]> {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    return err("Un cron debe tener 5 campos: min hora dia mes dia-semana.");
  }
  const sets: Set<number>[] = [];
  for (let i = 0; i < 5; i++) {
    const parsed = parseField(fields[i], FIELDS[i]);
    if (!parsed) return err(`Campo cron inválido: "${fields[i]}"`);
    sets.push(parsed);
  }
  return ok(sets);
}

/** Does `date` (local time) satisfy the cron expression? */
export function cronMatches(expr: string, date: Date): boolean {
  const parsed = parseCron(expr);
  if (!parsed.ok) return false;
  const [min, hour, dom, month, dow] = parsed.value;
  // Normalise Sunday: cron allows 0 and 7; JS getDay() returns 0 for Sunday.
  const jsDow = date.getDay();
  return (
    min.has(date.getMinutes()) &&
    hour.has(date.getHours()) &&
    dom.has(date.getDate()) &&
    month.has(date.getMonth() + 1) &&
    (dow.has(jsDow) || (jsDow === 0 && dow.has(7)))
  );
}
