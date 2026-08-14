"use server";

import { type Result } from "@/shared/kernel/result";
import { getN8nService } from "@/shared/di/container";
import { toConfigDTO, type N8nConfigDTO } from "@/modules/n8n/domain/config";
import type { N8nWorkflow } from "@/modules/n8n/domain/workflow";

export async function getN8nConfigAction(): Promise<N8nConfigDTO | null> {
  const cfg = await getN8nService().getConfig();
  return cfg ? toConfigDTO(cfg) : null;
}

export async function connectN8nAction(input: {
  baseUrl: string;
  apiKey: string;
}): Promise<Result<N8nConfigDTO>> {
  const res = await getN8nService().connect(input);
  return res.ok ? { ok: true, value: toConfigDTO(res.value) } : res;
}

export async function disconnectN8nAction(): Promise<void> {
  await getN8nService().disconnect();
}

export async function listN8nWorkflowsAction(): Promise<Result<N8nWorkflow[]>> {
  return getN8nService().listWorkflows();
}

export async function setN8nWorkflowActiveAction(
  id: string,
  active: boolean,
): Promise<Result<void>> {
  return getN8nService().setActive(id, active);
}
