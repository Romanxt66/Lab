/**
 * Coolify runs on Laravel, so a 422 comes back as
 * `{ message: "Validation failed.", errors: { field: ["reason", ...] } }`.
 * The bare `message` is useless on its own — the actionable part is the
 * per-field bag, so flatten both into one line.
 */
export interface CoolifyErrorBody {
  message?: string;
  error?: string;
  errors?: Record<string, string[] | string>;
}

/** Build a human-readable error line from a non-2xx Coolify response. */
export function formatApiError(status: number, body: CoolifyErrorBody | null): string {
  if (status === 401 || status === 403) {
    return "Token inválido o sin permisos. Revisa tu API token de Coolify.";
  }
  if (status === 404) {
    return "No encontrado en Coolify (¿existe el recurso?).";
  }

  const headline = body?.message || body?.error || `HTTP ${status}`;
  const fields = body?.errors
    ? Object.entries(body.errors)
        .map(([field, reasons]) => {
          const text = Array.isArray(reasons) ? reasons.join(" ") : reasons;
          return `${field}: ${text}`;
        })
        .join(" · ")
    : "";

  return fields ? `Coolify: ${headline} — ${fields}` : `Coolify: ${headline}`;
}
