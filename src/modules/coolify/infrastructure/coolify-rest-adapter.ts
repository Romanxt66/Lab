import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type {
  AppAction,
  CoolifyClientPort,
  CoolifyCredentials,
} from "@/modules/coolify/application/ports";
import {
  parseState,
  type CoolifyApp,
  type CoolifyEnv,
  type CoolifyOverview,
  type CoolifyProject,
  type CoolifyResource,
  type CoolifyServer,
} from "@/modules/coolify/domain/resource";

const TIMEOUT_MS = 20_000;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Turn a non-2xx response into a friendly, localised error. */
async function toError(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    return "Token inválido o sin permisos. Revisa tu API token de Coolify.";
  }
  if (res.status === 404) {
    return "No encontrado en Coolify (¿existe el recurso?).";
  }
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    detail = body?.message || body?.error || detail;
  } catch {
    /* ignore */
  }
  return `Coolify: ${detail}`;
}

/** CoolifyClientPort over the REST API (v1), with Bearer auth and a timeout. */
export class CoolifyRestAdapter implements CoolifyClientPort {
  private async request(
    cred: CoolifyCredentials,
    path: string,
  ): Promise<Result<Response>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${cred.baseUrl}/api/v1${path}`, {
        headers: {
          Authorization: `Bearer ${cred.token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      return ok(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return err("La petición a Coolify superó el tiempo límite (20s).");
      }
      return err(e instanceof Error ? e.message : "Error de red con Coolify.");
    } finally {
      clearTimeout(timer);
    }
  }

  private async getJson<T>(
    cred: CoolifyCredentials,
    path: string,
  ): Promise<Result<T>> {
    const res = await this.request(cred, path);
    if (!res.ok) return res;
    if (!res.value.ok) return err(await toError(res.value));
    try {
      return ok((await res.value.json()) as T);
    } catch {
      return err("Coolify devolvió una respuesta no válida.");
    }
  }

  async ping(cred: CoolifyCredentials): Promise<Result<string>> {
    const res = await this.request(cred, "/version");
    if (!res.ok) return res;
    if (!res.value.ok) return err(await toError(res.value));
    const text = (await res.value.text()).replace(/^"|"$/g, "").trim();
    return ok(text || "ok");
  }

  async overview(cred: CoolifyCredentials): Promise<Result<CoolifyOverview>> {
    // Applications are the headline; the rest are best-effort (an instance may
    // return 404 for a resource type it doesn't expose).
    const apps = await this.getJson<RawApp[]>(cred, "/applications");
    if (!apps.ok) return apps;

    const [projects, servers, databases, services] = await Promise.all([
      this.getJson<RawProject[]>(cred, "/projects"),
      this.getJson<RawServer[]>(cred, "/servers"),
      this.getJson<RawResource[]>(cred, "/databases"),
      this.getJson<RawResource[]>(cred, "/services"),
    ]);

    return ok({
      apps: apps.value.map(mapApp),
      projects: projects.ok ? projects.value.map(mapProject) : [],
      servers: servers.ok ? servers.value.map(mapServer) : [],
      databases: databases.ok ? databases.value.map((r) => mapResource(r, "database")) : [],
      services: services.ok ? services.value.map((r) => mapResource(r, "service")) : [],
    });
  }

  async getApp(
    cred: CoolifyCredentials,
    uuid: string,
  ): Promise<Result<CoolifyApp>> {
    const res = await this.getJson<RawApp>(cred, `/applications/${uuid}`);
    return res.ok ? ok(mapApp(res.value)) : res;
  }

  async deploy(
    cred: CoolifyCredentials,
    uuid: string,
    force: boolean,
  ): Promise<Result<string>> {
    const res = await this.getJson<{ message?: string }>(
      cred,
      `/deploy?uuid=${encodeURIComponent(uuid)}&force=${force ? "true" : "false"}`,
    );
    return res.ok ? ok(res.value.message ?? "Despliegue encolado.") : res;
  }

  async control(
    cred: CoolifyCredentials,
    uuid: string,
    action: AppAction,
  ): Promise<Result<string>> {
    const res = await this.getJson<{ message?: string }>(
      cred,
      `/applications/${uuid}/${action}`,
    );
    if (!res.ok) return res;
    const done =
      action === "start" ? "iniciada" : action === "stop" ? "detenida" : "reiniciada";
    return ok(res.value.message ?? `Aplicación ${done}.`);
  }

  async listEnvs(
    cred: CoolifyCredentials,
    uuid: string,
  ): Promise<Result<CoolifyEnv[]>> {
    const res = await this.getJson<RawEnv[]>(cred, `/applications/${uuid}/envs`);
    if (!res.ok) return res;
    return ok(
      res.value.map((e) => ({
        uuid: String(e.uuid ?? e.key),
        key: String(e.key ?? ""),
        value: String(e.value ?? ""),
        isBuildTime: Boolean(e.is_build_time),
        isPreview: Boolean(e.is_preview),
      })),
    );
  }

  async logs(
    cred: CoolifyCredentials,
    uuid: string,
    lines: number,
  ): Promise<Result<string>> {
    const res = await this.getJson<{ logs?: string } | string>(
      cred,
      `/applications/${uuid}/logs?lines=${lines}`,
    );
    if (!res.ok) return res;
    const v = res.value;
    if (typeof v === "string") return ok(v);
    return ok(v.logs ?? "");
  }
}

// --- Raw shapes (only the fields we read; all optional/defensive) ----------

interface RawApp {
  uuid?: string;
  name?: string;
  description?: string | null;
  fqdn?: string | null;
  status?: string;
  git_repository?: string | null;
  git_branch?: string | null;
  build_pack?: string | null;
  environment?: { name?: string; project?: { name?: string } } | null;
  environment_name?: string | null;
  project_name?: string | null;
}
interface RawProject {
  uuid?: string;
  name?: string;
  description?: string | null;
}
interface RawServer {
  uuid?: string;
  name?: string;
  ip?: string | null;
  settings?: { is_reachable?: boolean } | null;
  is_reachable?: boolean;
}
interface RawResource {
  uuid?: string;
  name?: string;
  status?: string;
}
interface RawEnv {
  uuid?: string;
  key?: string;
  value?: string;
  is_build_time?: boolean;
  is_preview?: boolean;
}

function mapApp(a: RawApp): CoolifyApp {
  const { state, healthy } = parseState(a.status);
  return {
    uuid: String(a.uuid ?? ""),
    name: str(a.name) ?? "(sin nombre)",
    description: str(a.description ?? null),
    fqdn: str(a.fqdn ?? null),
    status: a.status ?? "",
    state,
    healthy,
    gitRepository: str(a.git_repository ?? null),
    gitBranch: str(a.git_branch ?? null),
    buildPack: str(a.build_pack ?? null),
    projectName:
      str(a.environment?.project?.name ?? null) ?? str(a.project_name ?? null),
    environmentName:
      str(a.environment?.name ?? null) ?? str(a.environment_name ?? null),
  };
}

function mapProject(p: RawProject): CoolifyProject {
  return {
    uuid: String(p.uuid ?? ""),
    name: str(p.name) ?? "(sin nombre)",
    description: str(p.description ?? null),
  };
}

function mapServer(s: RawServer): CoolifyServer {
  return {
    uuid: String(s.uuid ?? ""),
    name: str(s.name) ?? "(sin nombre)",
    ip: str(s.ip ?? null),
    reachable: s.settings?.is_reachable ?? s.is_reachable ?? null,
  };
}

function mapResource(r: RawResource, type: string): CoolifyResource {
  const { state } = parseState(r.status);
  return {
    uuid: String(r.uuid ?? ""),
    name: str(r.name) ?? "(sin nombre)",
    type,
    status: r.status ?? "",
    state,
  };
}
