"use server";

import { type Result, ok } from "@/shared/kernel/result";
import { getUptimeService } from "@/shared/di/container";
import {
  toMonitorDTO,
  toCheckDTO,
  type HttpMethod,
  type MonitorDTO,
  type CheckDTO,
} from "@/modules/uptime/domain/monitor";

export interface MonitorDetailDTO {
  monitor: MonitorDTO;
  checks: CheckDTO[];
  uptime24h: number;
}

export async function listMonitorsAction(): Promise<MonitorDTO[]> {
  const rows = await getUptimeService().list();
  return rows.map(toMonitorDTO);
}

export async function monitorDetailAction(
  id: string,
): Promise<MonitorDetailDTO | null> {
  const detail = await getUptimeService().detail(id);
  if (!detail) return null;
  return {
    monitor: toMonitorDTO(detail.monitor),
    checks: detail.checks.map(toCheckDTO),
    uptime24h: detail.uptime24h,
  };
}

export async function saveMonitorAction(input: {
  id?: string;
  name: string;
  url: string;
  method: HttpMethod;
  expectedStatus: number;
  intervalSeconds: number;
  timeoutMs: number;
  active: boolean;
  notifyOnFailure: boolean;
}): Promise<Result<MonitorDTO>> {
  const res = await getUptimeService().save(input);
  return res.ok ? ok(toMonitorDTO(res.value)) : res;
}

export async function deleteMonitorAction(id: string): Promise<void> {
  await getUptimeService().remove(id);
}

export async function checkMonitorNowAction(
  id: string,
): Promise<Result<MonitorDTO>> {
  const res = await getUptimeService().checkNow(id);
  return res.ok ? ok(toMonitorDTO(res.value)) : res;
}
