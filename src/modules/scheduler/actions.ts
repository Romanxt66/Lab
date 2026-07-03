"use server";

import { type Result, ok, err } from "@/shared/kernel/result";
import { getJobRepo, getJobRunRepo, getRunJob } from "@/shared/di/container";
import { syncCronJobs } from "@/modules/scheduler/infrastructure/node-cron-scheduler";
import { isValidCron } from "@/modules/scheduler/domain/cron";
import type {
  ScheduledJob,
  JobAction,
  JobRun,
} from "@/modules/scheduler/application/ports";

export interface JobFormInput {
  id?: string;
  name: string;
  cron: string;
  action: JobAction;
  params: Record<string, unknown>;
  enabled: boolean;
}

export async function saveJobAction(
  input: JobFormInput,
): Promise<Result<ScheduledJob>> {
  if (!input.name.trim()) return err("El job necesita un nombre.");
  if (!isValidCron(input.cron)) {
    return err("Cron inválido. Formato: min hora día mes día-semana (ej. */5 * * * *).");
  }
  const data = {
    name: input.name.trim(),
    cron: input.cron.trim(),
    action: input.action,
    params: JSON.stringify(input.params ?? {}),
    enabled: input.enabled,
  };
  const repo = getJobRepo();
  const saved = input.id
    ? await repo.update(input.id, data)
    : await repo.create(data);
  await syncCronJobs();
  return ok(saved);
}

export async function toggleJobAction(
  id: string,
  enabled: boolean,
): Promise<void> {
  const repo = getJobRepo();
  const job = await repo.get(id);
  if (!job) return;
  await repo.update(id, {
    name: job.name,
    cron: job.cron,
    action: job.action,
    params: job.params,
    enabled,
  });
  await syncCronJobs();
}

export async function deleteJobAction(id: string): Promise<void> {
  await getJobRepo().remove(id);
  await syncCronJobs();
}

export async function listJobsAction(): Promise<ScheduledJob[]> {
  return getJobRepo().list();
}

/** Manual "run now" trigger from the UI. */
export async function runJobNowAction(id: string): Promise<Result<string>> {
  return getRunJob().execute(id);
}

export async function listRunsAction(
  limit = 20,
): Promise<(JobRun & { jobName: string })[]> {
  return getJobRunRepo().listRecent(limit);
}
