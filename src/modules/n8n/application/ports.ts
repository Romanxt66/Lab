import { type Result } from "@/shared/kernel/result";
import type { N8nConfig } from "@/modules/n8n/domain/config";
import type { N8nWorkflow } from "@/modules/n8n/domain/workflow";

export interface N8nCredentials {
  baseUrl: string;
  apiKey: string;
}

export interface N8nClientPort {
  /** Verify the connection (also validates the API key). */
  ping(cred: N8nCredentials): Promise<Result<void>>;
  listWorkflows(cred: N8nCredentials): Promise<Result<N8nWorkflow[]>>;
  setActive(cred: N8nCredentials, id: string, active: boolean): Promise<Result<void>>;
}

export interface N8nConfigRepoPort {
  getActive(): Promise<N8nConfig | null>;
  upsert(input: { baseUrl: string; apiKey: string }): Promise<N8nConfig>;
  remove(id: string): Promise<void>;
}
