import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type { N8nClientPort, N8nCredentials } from "@/modules/n8n/application/ports";
import type { N8nWorkflow } from "@/modules/n8n/domain/workflow";

const TIMEOUT_MS = 20_000;

/** Turn a non-2xx response into a friendly, localised error. */
async function toError(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    return "API key inválida o sin permisos. Revisa tu API key de n8n.";
  }
  if (res.status === 404) return "No encontrado en n8n (¿existe el recurso?).";
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string };
    detail = body?.message || detail;
  } catch {
    /* ignore */
  }
  return `n8n: ${detail}`;
}

interface RawWorkflow {
  id?: string | number;
  name?: string;
  active?: boolean;
  updatedAt?: string | null;
}

function mapWorkflow(w: RawWorkflow): N8nWorkflow {
  return {
    id: String(w.id ?? ""),
    name: w.name ?? "(sin nombre)",
    active: Boolean(w.active),
    updatedAt: w.updatedAt ?? null,
  };
}

/** N8nClientPort over n8n's Public REST API (v1), authenticated via X-N8N-API-KEY. */
export class N8nRestAdapter implements N8nClientPort {
  private async request(
    cred: N8nCredentials,
    path: string,
    init?: { method?: string },
  ): Promise<Result<Response>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${cred.baseUrl}/api/v1${path}`, {
        method: init?.method ?? "GET",
        headers: {
          "X-N8N-API-KEY": cred.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      return ok(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return err("La petición a n8n superó el tiempo límite (20s).");
      }
      return err(e instanceof Error ? e.message : "Error de red con n8n.");
    } finally {
      clearTimeout(timer);
    }
  }

  async ping(cred: N8nCredentials): Promise<Result<void>> {
    const res = await this.request(cred, "/workflows?limit=1");
    if (!res.ok) return res;
    if (!res.value.ok) return err(await toError(res.value));
    return ok(undefined);
  }

  async listWorkflows(cred: N8nCredentials): Promise<Result<N8nWorkflow[]>> {
    const res = await this.request(cred, "/workflows?limit=250");
    if (!res.ok) return res;
    if (!res.value.ok) return err(await toError(res.value));
    try {
      const body = (await res.value.json()) as { data?: RawWorkflow[] } | RawWorkflow[];
      const list = Array.isArray(body) ? body : (body.data ?? []);
      return ok(list.map(mapWorkflow));
    } catch {
      return err("n8n devolvió una respuesta no válida.");
    }
  }

  async setActive(cred: N8nCredentials, id: string, active: boolean): Promise<Result<void>> {
    const res = await this.request(
      cred,
      `/workflows/${encodeURIComponent(id)}/${active ? "activate" : "deactivate"}`,
      { method: "POST" },
    );
    if (!res.ok) return res;
    if (!res.value.ok) return err(await toError(res.value));
    return ok(undefined);
  }
}
