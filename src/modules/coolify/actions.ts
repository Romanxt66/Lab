"use server";

import { type Result, ok } from "@/shared/kernel/result";
import { getCoolifyService } from "@/shared/di/container";
import {
  toConfigDTO,
  type CoolifyConfigDTO,
} from "@/modules/coolify/domain/config";
import type {
  CoolifyApp,
  CoolifyEnv,
  CoolifyOverview,
} from "@/modules/coolify/domain/resource";
import type { AppAction } from "@/modules/coolify/application/ports";

// --- Connection ------------------------------------------------------------

export async function getCoolifyConfigAction(): Promise<CoolifyConfigDTO | null> {
  const cfg = await getCoolifyService().getConfig();
  return cfg ? toConfigDTO(cfg) : null;
}

export async function connectCoolifyAction(input: {
  baseUrl: string;
  token: string;
}): Promise<Result<CoolifyConfigDTO>> {
  const res = await getCoolifyService().connect(input);
  return res.ok ? ok(toConfigDTO(res.value)) : res;
}

export async function disconnectCoolifyAction(): Promise<void> {
  await getCoolifyService().disconnect();
}

// --- Operations ------------------------------------------------------------

export async function coolifyOverviewAction(): Promise<Result<CoolifyOverview>> {
  return getCoolifyService().overview();
}

export async function coolifyAppAction(
  uuid: string,
): Promise<Result<CoolifyApp>> {
  return getCoolifyService().getApp(uuid);
}

export async function deployCoolifyAction(
  uuid: string,
  force = false,
): Promise<Result<string>> {
  return getCoolifyService().deploy(uuid, force);
}

export async function controlCoolifyAction(
  uuid: string,
  action: AppAction,
): Promise<Result<string>> {
  return getCoolifyService().control(uuid, action);
}

export async function coolifyEnvsAction(
  uuid: string,
): Promise<Result<CoolifyEnv[]>> {
  return getCoolifyService().listEnvs(uuid);
}

export async function coolifyLogsAction(
  uuid: string,
  lines = 200,
): Promise<Result<string>> {
  return getCoolifyService().logs(uuid, lines);
}
