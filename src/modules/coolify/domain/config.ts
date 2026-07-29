import { type Result, ok, err } from "@/shared/kernel/result";

/**
 * Coolify connection config. `baseUrl` is the instance URL, `token` an API
 * token (Bearer). The token is stored server-side and never sent to the client.
 */
export interface CoolifyConfig {
  id: string;
  baseUrl: string;
  token: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Client-side projection: the token never reaches the browser. */
export interface CoolifyConfigDTO {
  id: string;
  baseUrl: string;
  hasToken: boolean;
}

export function toConfigDTO(c: CoolifyConfig): CoolifyConfigDTO {
  return { id: c.id, baseUrl: c.baseUrl, hasToken: Boolean(c.token) };
}

/** Normalise the instance URL: require http(s), strip a trailing slash. */
export function validateBaseUrl(raw: string): Result<string> {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return err("Introduce la URL de tu Coolify.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return err("La URL no es válida (ej. https://coolify.midominio.com).");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err("La URL debe empezar por http:// o https://");
  }
  return ok(trimmed);
}

export function validateToken(raw: string): Result<string> {
  const t = raw.trim();
  if (!t) return err("Introduce el API token de Coolify.");
  return ok(t);
}
