/** Format an ISO timestamp as a compact Spanish "hace …" string. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "hace un momento";

  const units: Array<[number, string, string]> = [
    [31_536_000, "año", "años"],
    [2_592_000, "mes", "meses"],
    [86_400, "día", "días"],
    [3_600, "hora", "horas"],
    [60, "minuto", "minutos"],
  ];

  for (const [secs, singular, plural] of units) {
    if (seconds >= secs) {
      const value = Math.floor(seconds / secs);
      return `hace ${value} ${value === 1 ? singular : plural}`;
    }
  }
  return "hace un momento";
}
