import { type Result, ok, err } from "@/shared/kernel/result";
import {
  validateBaseUrl,
  validateApiKey,
  type N8nConfig,
} from "@/modules/n8n/domain/config";
import type { N8nWorkflow } from "@/modules/n8n/domain/workflow";
import type { N8nClientPort, N8nConfigRepoPort, N8nCredentials } from "./ports";

/**
 * Orchestrates the n8n panel: connection config plus the workflow list and
 * activate/deactivate toggle. Every operation resolves the active config
 * first and fails with a friendly message when it's missing.
 */
export class N8nService {
  constructor(
    private readonly client: N8nClientPort,
    private readonly configs: N8nConfigRepoPort,
  ) {}

  getConfig(): Promise<N8nConfig | null> {
    return this.configs.getActive();
  }

  /** Validate + verify the credentials (ping) before persisting them. */
  async connect(input: { baseUrl: string; apiKey: string }): Promise<Result<N8nConfig>> {
    const url = validateBaseUrl(input.baseUrl);
    if (!url.ok) return url;
    const apiKey = validateApiKey(input.apiKey);
    if (!apiKey.ok) return apiKey;

    const ping = await this.client.ping({ baseUrl: url.value, apiKey: apiKey.value });
    if (!ping.ok) return ping;

    return ok(await this.configs.upsert({ baseUrl: url.value, apiKey: apiKey.value }));
  }

  async disconnect(): Promise<void> {
    const cfg = await this.configs.getActive();
    if (cfg) await this.configs.remove(cfg.id);
  }

  private async cred(): Promise<Result<N8nCredentials>> {
    const cfg = await this.configs.getActive();
    if (!cfg) return err("No hay conexión con n8n. Conéctala primero.");
    return ok({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
  }

  async listWorkflows(): Promise<Result<N8nWorkflow[]>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.listWorkflows(c.value);
  }

  async setActive(id: string, active: boolean): Promise<Result<void>> {
    const c = await this.cred();
    if (!c.ok) return c;
    return this.client.setActive(c.value, id, active);
  }
}
