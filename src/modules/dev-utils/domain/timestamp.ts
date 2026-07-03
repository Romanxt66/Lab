import { type Result, ok, err } from "@/shared/kernel/result";

export interface TimeBreakdown {
  unixSeconds: number;
  unixMillis: number;
  iso: string;
  utc: string;
  local: string;
  relative: string;
}

/**
 * Parse a flexible input into a canonical time breakdown.
 * Accepts: unix seconds, unix millis, or any Date-parseable string.
 */
export function parseTime(input: string): Result<TimeBreakdown> {
  const trimmed = input.trim();
  if (!trimmed) return err("Introduce una fecha o timestamp.");

  let date: Date;
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    // Heuristic: 13+ digits → milliseconds, otherwise seconds.
    date = new Date(trimmed.length >= 13 ? num : num * 1000);
  } else {
    date = new Date(trimmed);
  }

  if (Number.isNaN(date.getTime())) {
    return err("No se pudo interpretar la fecha/timestamp.");
  }
  return ok(breakdown(date));
}

/** Current time as a breakdown. */
export function nowBreakdown(): TimeBreakdown {
  return breakdown(new Date());
}

function breakdown(date: Date): TimeBreakdown {
  const unixMillis = date.getTime();
  return {
    unixSeconds: Math.floor(unixMillis / 1000),
    unixMillis,
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString(),
    relative: relativeFromNow(unixMillis),
  };
}

function relativeFromNow(ms: number): string {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
    ["second", 1000],
  ];
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (abs >= size || unit === "second") {
      return rtf.format(Math.round(diff / size), unit);
    }
  }
  return "ahora";
}
