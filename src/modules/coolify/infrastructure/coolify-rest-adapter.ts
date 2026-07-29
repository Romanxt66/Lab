import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type {
  AppAction,
  AppConfigPatch,
  CoolifyClientPort,
  CoolifyCredentials,
  CreateAppInput,
  CreateDatabaseInput,
  DeletableKind,
  EnvInput,
  ResourceKind,
} from "@/modules/coolify/application/ports";
import {
  parseState,
  parseDeployStatus,
  type CoolifyApp,
  type CoolifyDeployment,
  type CoolifyEnv,
  type CoolifyEnvironment,
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
    init?: { method?: string; body?: unknown },
  ): Promise<Result<Response>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${cred.token}`,
        Accept: "application/json",
      };
      if (init?.body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(`${cred.baseUrl}/api/v1${path}`, {
        method: init?.method ?? "GET",
        headers,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
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

  private async send<T>(
    cred: CoolifyCredentials,
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<Result<T>> {
    const res = await this.request(cred, path, init);
    if (!res.ok) return res;
    if (!res.value.ok) return err(await toError(res.value));
    try {
      const text = await res.value.text();
      return ok((text ? JSON.parse(text) : {}) as T);
    } catch {
      return err("Coolify devolvió una respuesta no válida.");
    }
  }

  private getJson<T>(cred: CoolifyCredentials, path: string): Promise<Result<T>> {
    return this.send<T>(cred, path);
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

  async listEnvironments(
    cred: CoolifyCredentials,
    projectUuid: string,
  ): Promise<Result<CoolifyEnvironment[]>> {
    const res = await this.getJson<RawEnvironment[]>(
      cred,
      `/projects/${projectUuid}/environments`,
    );
    if (!res.ok) return res;
    return ok(
      res.value.map((e) => ({
        uuid: String(e.uuid ?? ""),
        name: str(e.name) ?? "production",
      })),
    );
  }

  async createApp(
    cred: CoolifyCredentials,
    input: CreateAppInput,
  ): Promise<Result<string>> {
    const common: Record<string, unknown> = {
      project_uuid: input.projectUuid,
      server_uuid: input.serverUuid,
      environment_name: input.environmentName,
      environment_uuid: input.environmentUuid,
      instant_deploy: input.instantDeploy,
    };
    if (input.name.trim()) common.name = input.name.trim();
    if (input.domains.trim()) common.domains = input.domains.trim();
    if (input.portsExposes.trim()) common.ports_exposes = input.portsExposes.trim();

    const path =
      input.source === "dockerfile"
        ? "/applications/dockerfile"
        : "/applications/public";
    const body =
      input.source === "dockerfile"
        ? { ...common, dockerfile: input.dockerfile }
        : {
            ...common,
            git_repository: input.gitRepository.trim(),
            git_branch: input.gitBranch.trim(),
            build_pack: input.buildPack,
          };

    const res = await this.send<{ uuid?: string; message?: string }>(cred, path, {
      method: "POST",
      body,
    });
    return res.ok
      ? ok(res.value.message ?? `Aplicación creada${res.value.uuid ? ` (${res.value.uuid})` : ""}.`)
      : res;
  }

  async updateApp(
    cred: CoolifyCredentials,
    uuid: string,
    patch: AppConfigPatch,
  ): Promise<Result<string>> {
    const body: Record<string, unknown> = {
      name: patch.name,
      description: patch.description,
      domains: patch.domains,
      git_branch: patch.gitBranch,
      build_pack: patch.buildPack,
      ports_exposes: patch.portsExposes,
      install_command: patch.installCommand,
      build_command: patch.buildCommand,
      start_command: patch.startCommand,
      base_directory: patch.baseDirectory,
    };
    const res = await this.send<{ message?: string }>(
      cred,
      `/applications/${uuid}`,
      { method: "PATCH", body },
    );
    return res.ok ? ok(res.value.message ?? "Configuración guardada.") : res;
  }

  async deploy(
    cred: CoolifyCredentials,
    uuid: string,
    force: boolean,
  ): Promise<Result<string>> {
    // POST /deploy?uuid=&force= (query params, no body).
    const res = await this.send<{ message?: string }>(
      cred,
      `/deploy?uuid=${encodeURIComponent(uuid)}&force=${force ? "true" : "false"}`,
      { method: "POST" },
    );
    return res.ok ? ok(res.value.message ?? "Despliegue encolado.") : res;
  }

  async control(
    cred: CoolifyCredentials,
    uuid: string,
    action: AppAction,
  ): Promise<Result<string>> {
    // Control ops are POST (start/stop/restart), optionally with query params.
    const res = await this.send<{ message?: string }>(
      cred,
      `/applications/${uuid}/${action}`,
      { method: "POST" },
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
    return ok(res.value.map(mapEnv));
  }

  async createEnv(
    cred: CoolifyCredentials,
    uuid: string,
    input: EnvInput,
  ): Promise<Result<string>> {
    const res = await this.send<{ message?: string; uuid?: string }>(
      cred,
      `/applications/${uuid}/envs`,
      { method: "POST", body: toEnvBody(input) },
    );
    return res.ok ? ok(res.value.message ?? "Variable creada.") : res;
  }

  async updateEnv(
    cred: CoolifyCredentials,
    uuid: string,
    input: EnvInput,
  ): Promise<Result<string>> {
    const res = await this.send<{ message?: string }>(
      cred,
      `/applications/${uuid}/envs`,
      { method: "PATCH", body: toEnvBody(input) },
    );
    return res.ok ? ok(res.value.message ?? "Variable actualizada.") : res;
  }

  async deleteEnv(
    cred: CoolifyCredentials,
    uuid: string,
    envUuid: string,
  ): Promise<Result<string>> {
    const res = await this.send<{ message?: string }>(
      cred,
      `/applications/${uuid}/envs/${envUuid}`,
      { method: "DELETE" },
    );
    return res.ok ? ok(res.value.message ?? "Variable eliminada.") : res;
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

  async listDeployments(
    cred: CoolifyCredentials,
  ): Promise<Result<CoolifyDeployment[]>> {
    const res = await this.getJson<RawDeployment[] | { deployments?: RawDeployment[] }>(
      cred,
      "/deployments",
    );
    if (!res.ok) return res;
    const list = Array.isArray(res.value) ? res.value : res.value.deployments ?? [];
    return ok(list.map(mapDeployment));
  }

  async cancelDeployment(
    cred: CoolifyCredentials,
    uuid: string,
  ): Promise<Result<string>> {
    const res = await this.send<{ message?: string }>(
      cred,
      `/deployments/${uuid}/cancel`,
      { method: "POST" },
    );
    return res.ok ? ok(res.value.message ?? "Despliegue cancelado.") : res;
  }

  async controlResource(
    cred: CoolifyCredentials,
    kind: ResourceKind,
    uuid: string,
    action: AppAction,
  ): Promise<Result<string>> {
    const res = await this.send<{ message?: string }>(
      cred,
      `/${kind}/${uuid}/${action}`,
      { method: "POST" },
    );
    if (!res.ok) return res;
    const done =
      action === "start" ? "iniciado" : action === "stop" ? "detenido" : "reiniciado";
    return ok(res.value.message ?? `Recurso ${done}.`);
  }

  async resourceLogs(
    cred: CoolifyCredentials,
    kind: ResourceKind,
    uuid: string,
    lines: number,
  ): Promise<Result<string>> {
    const res = await this.getJson<{ logs?: string } | string>(
      cred,
      `/${kind}/${uuid}/logs?lines=${lines}`,
    );
    if (!res.ok) return res;
    const v = res.value;
    return ok(typeof v === "string" ? v : v.logs ?? "");
  }

  async createDatabase(
    cred: CoolifyCredentials,
    input: CreateDatabaseInput,
  ): Promise<Result<string>> {
    const body: Record<string, unknown> = {
      server_uuid: input.serverUuid,
      project_uuid: input.projectUuid,
      environment_name: input.environmentName,
      environment_uuid: input.environmentUuid,
      instant_deploy: input.instantDeploy,
    };
    if (input.name.trim()) body.name = input.name.trim();
    if (input.image.trim()) body.image = input.image.trim();

    const res = await this.send<{ uuid?: string; message?: string }>(
      cred,
      `/databases/${input.type}`,
      { method: "POST", body },
    );
    return res.ok
      ? ok(res.value.message ?? `Base de datos creada${res.value.uuid ? ` (${res.value.uuid})` : ""}.`)
      : res;
  }

  async createProject(
    cred: CoolifyCredentials,
    input: { name: string; description: string },
  ): Promise<Result<string>> {
    const res = await this.send<{ uuid?: string; message?: string }>(
      cred,
      "/projects",
      { method: "POST", body: { name: input.name, description: input.description } },
    );
    return res.ok ? ok(res.value.message ?? "Proyecto creado.") : res;
  }

  async updateProject(
    cred: CoolifyCredentials,
    uuid: string,
    input: { name: string; description: string },
  ): Promise<Result<string>> {
    const res = await this.send<{ message?: string }>(cred, `/projects/${uuid}`, {
      method: "PATCH",
      body: { name: input.name, description: input.description },
    });
    return res.ok ? ok(res.value.message ?? "Proyecto actualizado.") : res;
  }

  async deleteResource(
    cred: CoolifyCredentials,
    kind: DeletableKind,
    uuid: string,
  ): Promise<Result<string>> {
    const res = await this.send<{ message?: string }>(
      cred,
      `/${kind}/${uuid}`,
      { method: "DELETE" },
    );
    return res.ok ? ok(res.value.message ?? "Eliminado.") : res;
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
  ports_exposes?: string | null;
  install_command?: string | null;
  build_command?: string | null;
  start_command?: string | null;
  base_directory?: string | null;
  environment?: { name?: string; project?: { name?: string } } | null;
  environment_name?: string | null;
  project_name?: string | null;
}
interface RawProject {
  uuid?: string;
  name?: string;
  description?: string | null;
}
interface RawEnvironment {
  uuid?: string;
  name?: string;
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
  is_literal?: boolean;
}

function mapEnv(e: RawEnv): CoolifyEnv {
  return {
    uuid: String(e.uuid ?? e.key ?? ""),
    key: String(e.key ?? ""),
    value: String(e.value ?? ""),
    isBuildTime: Boolean(e.is_build_time),
    isPreview: Boolean(e.is_preview),
    isLiteral: Boolean(e.is_literal),
  };
}

/** Map our EnvInput to Coolify's snake_case body. */
function toEnvBody(input: EnvInput): Record<string, unknown> {
  return {
    key: input.key,
    value: input.value,
    is_preview: input.isPreview,
    is_literal: input.isLiteral,
  };
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
    portsExposes: a.ports_exposes ?? "",
    installCommand: a.install_command ?? "",
    buildCommand: a.build_command ?? "",
    startCommand: a.start_command ?? "",
    baseDirectory: a.base_directory ?? "",
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

interface RawDeployment {
  deployment_uuid?: string;
  uuid?: string;
  id?: number | string;
  application_name?: string;
  server_name?: string | null;
  status?: string;
  commit?: string | null;
  commit_message?: string | null;
  created_at?: string | null;
}

function mapDeployment(d: RawDeployment): CoolifyDeployment {
  return {
    uuid: String(d.deployment_uuid ?? d.uuid ?? d.id ?? ""),
    applicationName: str(d.application_name ?? null) ?? "(app)",
    serverName: str(d.server_name ?? null),
    status: parseDeployStatus(d.status),
    rawStatus: d.status ?? "",
    commit: str(d.commit ?? null),
    commitMessage: str(d.commit_message ?? null),
    createdAt: str(d.created_at ?? null),
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
