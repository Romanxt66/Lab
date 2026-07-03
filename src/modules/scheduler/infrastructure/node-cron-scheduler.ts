import "server-only";
import cron, { type ScheduledTask } from "node-cron";
import { getJobRepo, getRunJob } from "@/shared/di/container";

/**
 * Local scheduler adapter. Keeps a live node-cron task per enabled job, in
 * sync with the database. Tasks are stored on globalThis so they survive Next's
 * hot-reload in development. In production on serverless (Vercel) this process
 * isn't long-lived — there the HTTP `/api/cron` endpoint drives execution.
 */
const globalForCron = globalThis as unknown as {
  __cronTasks?: Map<string, ScheduledTask>;
};

function tasks(): Map<string, ScheduledTask> {
  return (globalForCron.__cronTasks ??= new Map());
}

/** Rebuild all node-cron tasks from the current set of enabled jobs. */
export async function syncCronJobs(): Promise<number> {
  const registry = tasks();
  for (const task of registry.values()) task.stop();
  registry.clear();

  const jobs = await getJobRepo().listEnabled();
  const runJob = getRunJob();

  for (const job of jobs) {
    if (!cron.validate(job.cron)) continue;
    const task = cron.schedule(job.cron, () => {
      void runJob.execute(job.id);
    });
    registry.set(job.id, task);
  }
  return registry.size;
}
