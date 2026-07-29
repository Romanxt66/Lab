import { type Result, ok, err } from "@/shared/kernel/result";
import {
  validateBaseUrl,
  validateToken,
  type CoolifyConfig,
} from "@/modules/coolify/domain/config";
import type {
  CoolifyApp,
  CoolifyEnv,
  CoolifyOverview,
} from "@/modules/coolify/domain/resource";
import type {
  AppAction,
  CoolifyClientPort,
  CoolifyConfigRepoPort,
  CoolifyCredentials,
  EnvInput,
} from "./ports";

/**
 * Orchestrates the Coolify panel: connection config plus the read/control
 * operations against the instance. Every operation resolves the active config
 * first and fails with a friendly message when it's missing.
 */
export class CoolifyService {
  constructor(
    private readonly client: CoolifyClientPort,
    private readonly configs: CoolifyConfigRepoPort,
  ) {}

  // -- Config -------------------------------------------------------------

  getConfig(): Promise<CoolifyConfig | null> {
    return this.configs.getActive();
  }

  /** Validate + verify the credentials (ping) before persisting them. */
  async connect(input: {
    baseUrl: string;
    token: string;
  }): Promise<Result<CoolifyConfig>> {
    const url = validateBaseUrl(input.baseUrl);
    if (!url.ok) return url;
    const token = validateToken(input.token);
    if (!token.ok) return token;

    const ping = await this.client.ping({
      baseUrl: url.value,
      token: token.value,
    });
    if (!ping.ok) return ping;

    return ok(await this.configs.upsert({ baseUrl: url.value, token: token.value }));
  }

  async disconnect(): Promise<void> {
    const cfg = await this.configs.getActive();
    if (cfg) await this.configs.remove(cfg.id);
  }

  private async cred(): Promise<Result<CoolifyCredentials>> {
    const cfg = await this.configs.getActive();
    if (!cfg) {
      return err("No hay conexión con Coolify. Conéctala primero.");
    }
    return ok({ baseUrl: cfg.baseUrl, token: cfg.token });
  }

  // -- Operations ---------------------------------------------------------

  async overview(): Promise<Result<CoolifyOverview>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.overview(c.value);
  }

  async getApp(uuid: string): Promise<Result<CoolifyApp>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.getApp(c.value, uuid);
  }

  async deploy(uuid: string, force = false): Promise<Result<string>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.deploy(c.value, uuid, force);
  }

  async control(uuid: string, action: AppAction): Promise<Result<string>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.control(c.value, uuid, action);
  }

  async listEnvs(uuid: string): Promise<Result<CoolifyEnv[]>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.listEnvs(c.value, uuid);
  }

  async createEnv(uuid: string, input: EnvInput): Promise<Result<string>> {
    if (!input.key.trim()) return err("La clave no puede estar vacía.");
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.createEnv(c.value, uuid, {
      ...input,
      key: input.key.trim(),
    });
  }

  async updateEnv(uuid: string, input: EnvInput): Promise<Result<string>> {
    if (!input.key.trim()) return err("La clave no puede estar vacía.");
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.updateEnv(c.value, uuid, {
      ...input,
      key: input.key.trim(),
    });
  }

  async deleteEnv(uuid: string, envUuid: string): Promise<Result<string>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.deleteEnv(c.value, uuid, envUuid);
  }

  async logs(uuid: string, lines = 200): Promise<Result<string>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.logs(c.value, uuid, lines);
  }
}
