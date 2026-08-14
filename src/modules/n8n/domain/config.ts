import { type Result, ok, err } from "@/shared/kernel/result";

/**
 * n8n connection config. `baseUrl` is the instance URL, `apiKey` a Public API
 * key (sent as `X-N8N-API-KEY`). The key is stored server-side and never
 * sent to the client.
 */
export interface N8nConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Client-side projection: the key never reaches the browser. */
export interface N8nConfigDTO {
  id: string;
  baseUrl: string;
  hasApiKey: boolean;
}

export function toConfigDTO(c: N8nConfig): N8nConfigDTO {
  return { id: c.id, baseUrl: c.baseUrl, hasApiKey: Boolean(c.apiKey) };
}

/** Normalise the instance URL: require http(s), strip a trailing slash. */
export function validateBaseUrl(raw: string): Result<string> {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return err("Introduce la URL de tu instancia de n8n.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return err("La URL no es válida (ej. https://n8n.midominio.com).");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err("La URL debe empezar por http:// o https://");
  }
  return ok(trimmed);
}

export function validateApiKey(raw: string): Result<string> {
  const k = raw.trim();
  if (!k) return err("Introduce el API key de n8n.");
  return ok(k);
}
