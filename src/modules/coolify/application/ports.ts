import type { Result } from "@/shared/kernel/result";
import type { CoolifyConfig } from "@/modules/coolify/domain/config";
import type {
  CoolifyApp,
  CoolifyDeployment,
  CoolifyEnv,
  CoolifyEnvironment,
  CoolifyOverview,
} from "@/modules/coolify/domain/resource";

/** Credentials the client needs to talk to a Coolify instance. */
export interface CoolifyCredentials {
  baseUrl: string;
  token: string;
}

export type AppAction = "start" | "stop" | "restart";

/** API path segment for a controllable resource type. */
export type ResourceKind = "databases" | "services";

/** Editable application configuration (subset of Coolify's PATCH fields). */
export interface AppConfigPatch {
  name: string;
  description: string;
  domains: string;
  gitBranch: string;
  buildPack: string;
  portsExposes: string;
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  baseDirectory: string;
}

/** Input to create/update an application environment variable. */
export interface EnvInput {
  key: string;
  value: string;
  isPreview: boolean;
  isLiteral: boolean;
}

/** Input to create a new application (public Git repo or raw Dockerfile). */
export interface CreateAppInput {
  source: "public" | "dockerfile";
  name: string;
  projectUuid: string;
  environmentName: string;
  environmentUuid: string;
  serverUuid: string;
  domains: string;
  portsExposes: string;
  instantDeploy: boolean;
  // source === "public"
  gitRepository: string;
  gitBranch: string;
  buildPack: string;
  // source === "dockerfile"
  dockerfile: string;
}

/** Talks to the Coolify REST API. Adapters live in `infrastructure/`. */
export interface CoolifyClientPort {
  /** Cheap call to validate the connection (GET /version). */
  ping(cred: CoolifyCredentials): Promise<Result<string>>;
  overview(cred: CoolifyCredentials): Promise<Result<CoolifyOverview>>;
  listEnvironments(
    cred: CoolifyCredentials,
    projectUuid: string,
  ): Promise<Result<CoolifyEnvironment[]>>;
  createApp(
    cred: CoolifyCredentials,
    input: CreateAppInput,
  ): Promise<Result<string>>;
  getApp(cred: CoolifyCredentials, uuid: string): Promise<Result<CoolifyApp>>;
  updateApp(
    cred: CoolifyCredentials,
    uuid: string,
    patch: AppConfigPatch,
  ): Promise<Result<string>>;
  deploy(cred: CoolifyCredentials, uuid: string, force: boolean): Promise<Result<string>>;
  control(
    cred: CoolifyCredentials,
    uuid: string,
    action: AppAction,
  ): Promise<Result<string>>;
  listEnvs(cred: CoolifyCredentials, uuid: string): Promise<Result<CoolifyEnv[]>>;
  createEnv(
    cred: CoolifyCredentials,
    uuid: string,
    input: EnvInput,
  ): Promise<Result<string>>;
  updateEnv(
    cred: CoolifyCredentials,
    uuid: string,
    input: EnvInput,
  ): Promise<Result<string>>;
  deleteEnv(
    cred: CoolifyCredentials,
    uuid: string,
    envUuid: string,
  ): Promise<Result<string>>;
  logs(cred: CoolifyCredentials, uuid: string, lines: number): Promise<Result<string>>;
  listDeployments(
    cred: CoolifyCredentials,
  ): Promise<Result<CoolifyDeployment[]>>;
  cancelDeployment(
    cred: CoolifyCredentials,
    uuid: string,
  ): Promise<Result<string>>;
  /** Start/stop/restart a database or service. */
  controlResource(
    cred: CoolifyCredentials,
    kind: ResourceKind,
    uuid: string,
    action: AppAction,
  ): Promise<Result<string>>;
  resourceLogs(
    cred: CoolifyCredentials,
    kind: ResourceKind,
    uuid: string,
    lines: number,
  ): Promise<Result<string>>;
}

/** Persists the single Coolify connection config. */
export interface CoolifyConfigRepoPort {
  getActive(): Promise<CoolifyConfig | null>;
  upsert(input: { baseUrl: string; token: string }): Promise<CoolifyConfig>;
  remove(id: string): Promise<void>;
}
