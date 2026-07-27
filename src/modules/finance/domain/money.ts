/** Format a number as money for display. Never throws on garbage inputs. */
export function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback for exotic currency codes Intl doesn't know about.
    const fixed = value.toLocaleString("es", { maximumFractionDigits: 2 });
    return `${fixed} ${currency.toUpperCase()}`;
  }
}
