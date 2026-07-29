import type { Result } from "@/shared/kernel/result";
import type { CoolifyConfig } from "@/modules/coolify/domain/config";
import type {
  CoolifyApp,
  CoolifyEnv,
  CoolifyOverview,
} from "@/modules/coolify/domain/resource";

/** Credentials the client needs to talk to a Coolify instance. */
export interface CoolifyCredentials {
  baseUrl: string;
  token: string;
}

export type AppAction = "start" | "stop" | "restart";

/** Input to create/update an application environment variable. */
export interface EnvInput {
  key: string;
  value: string;
  isPreview: boolean;
  isLiteral: boolean;
}

/** Talks to the Coolify REST API. Adapters live in `infrastructure/`. */
export interface CoolifyClientPort {
  /** Cheap call to validate the connection (GET /version). */
  ping(cred: CoolifyCredentials): Promise<Result<string>>;
  overview(cred: CoolifyCredentials): Promise<Result<CoolifyOverview>>;
  getApp(cred: CoolifyCredentials, uuid: string): Promise<Result<CoolifyApp>>;
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
}

/** Persists the single Coolify connection config. */
export interface CoolifyConfigRepoPort {
  getActive(): Promise<CoolifyConfig | null>;
  upsert(input: { baseUrl: string; token: string }): Promise<CoolifyConfig>;
  remove(id: string): Promise<void>;
}
