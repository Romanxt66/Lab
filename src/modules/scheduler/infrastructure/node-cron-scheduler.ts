import "server-only";
import cron, { type ScheduledTask } from "node-cron";
import {
  getJobRepo,
  getRunJob,
  getProcessCalendarReminders,
} from "@/shared/di/container";

/**
 * Local scheduler adapter. Keeps a live node-cron task per enabled job, in
 * sync with the database. Tasks are stored on globalThis so they survive Next's
 * hot-reload in development. In production on serverless (Vercel) this process
 * isn't long-lived — there the HTTP `/api/cron` endpoint drives execution.
 */
const globalForCron = globalThis as unknown as {
  __cronTasks?: Map<string, ScheduledTask>;
  __systemTasks?: ScheduledTask[];
};

function tasks(): Map<string, ScheduledTask> {
  return (globalForCron.__cronTasks ??= new Map());
}

/**
 * Start the built-in system tasks (currently just the calendar-reminder poll).
 * Idempotent: on hot-reload the previous tasks are stopped first.
 */
export function startSystemCronTasks(): void {
  for (const t of globalForCron.__systemTasks ?? []) {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  }
  const reminderTask = cron.schedule("* * * * *", async () => {
    try {
      const summary = await getProcessCalendarReminders().execute();
      if (summary.sent > 0 || summary.failed > 0) {
        console.log(
          `[reminders] enviados=${summary.sent} fallidos=${summary.failed}` +
            (summary.errors.length
              ? ` errores=${summary.errors.slice(0, 3).join(" | ")}`
              : ""),
        );
      }
    } catch (e) {
      console.error("[reminders] error:", e);
    }
  });
  globalForCron.__systemTasks = [reminderTask];
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
