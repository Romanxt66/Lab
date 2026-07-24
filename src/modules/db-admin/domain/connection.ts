import { type Result, ok, err } from "@/shared/kernel/result";

/** Row shape as stored — never serialise to the browser as-is. */
export interface DbConnection {
  id: string;
  name: string;
  connectionUrl: string;
  readOnly: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Safe projection for the browser: NO connection URL. */
export interface DbConnectionDTO {
  id: string;
  name: string;
  /** Just the host (best-effort) so the user can tell them apart. */
  host: string;
  readOnly: boolean;
}

export function toDTO(c: DbConnection): DbConnectionDTO {
  return {
    id: c.id,
    name: c.name,
    host: hostFromUrl(c.connectionUrl),
    readOnly: c.readOnly,
  };
}

/** Extract host:port from a Postgres URL for display. */
export function hostFromUrl(url: string): string {
  try {
    const cleaned = url.trim().replace(/^["']|["']$/g, "");
    const u = new URL(cleaned);
    return `${u.hostname}${u.port ? ":" + u.port : ""}`;
  } catch {
    return "?";
  }
}

/** Validate that a URL looks like a Postgres connection string. */
export function validateConnectionUrl(url: string): Result<string> {
  const trimmed = url.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return err("Introduce una URL de conexión.");
  if (!/^postgres(ql)?:\/\//.test(trimmed)) {
    return err(
      "Debe empezar por postgres:// o postgresql:// (formato Prisma / libpq).",
    );
  }
  try {
    // Trigger URL parsing to catch obvious garbage.
    new URL(trimmed);
    return ok(trimmed);
  } catch {
    return err("La URL no tiene un formato válido.");
  }
}
