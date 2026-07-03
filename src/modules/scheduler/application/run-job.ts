import { type Result, ok, err } from "@/shared/kernel/result";
import { cronMatches } from "@/modules/scheduler/domain/cron";
import type {
  ScheduledJobRepoPort,
  JobRunRepoPort,
  JobActionHandler,
  JobAction,
} from "./ports";

/**
 * RunJob: execute a single scheduled job by id and record the outcome.
 * The action handlers are injected, so RunJob knows nothing about email or
 * scraping — only how to dispatch and log.
 */
export class RunJob {
  constructor(
    private readonly jobs: ScheduledJobRepoPort,
    private readonly runs: JobRunRepoPort,
    private readonly handlers: Record<JobAction, JobActionHandler>,
  ) {}

  async execute(jobId: string): Promise<Result<string>> {
    const job = await this.jobs.get(jobId);
    if (!job) return err("Job no encontrado.");

    const handler = this.handlers[job.action];
    if (!handler) return err(`Acción desconocida: ${job.action}`);

    let params: unknown;
    try {
      params = JSON.parse(job.params);
    } catch {
      const msg = "Parámetros del job inválidos (JSON).";
      await this.runs.record({ jobId, status: "error", output: msg });
      return err(msg);
    }

    let result: Result<string>;
    try {
      result = await handler(params);
    } catch (e) {
      result = err(e instanceof Error ? e.message : "Error ejecutando el job.");
    }

    await this.runs.record({
      jobId,
      status: result.ok ? "success" : "error",
      output: result.ok ? result.value : result.error,
    });
    return result;
  }
}

/**
 * RunDueJobs: run every enabled job whose cron matches `now`. Used by the HTTP
 * cron endpoint (Vercel Cron) so cloud runs respect each job's schedule.
 */
export class RunDueJobs {
  constructor(
    private readonly jobs: ScheduledJobRepoPort,
    private readonly runJob: RunJob,
  ) {}

  async execute(now: Date = new Date()): Promise<{ ran: string[] }> {
    const enabled = await this.jobs.listEnabled();
    const ran: string[] = [];
    for (const job of enabled) {
      if (cronMatches(job.cron, now)) {
        await this.runJob.execute(job.id);
        ran.push(job.id);
      }
    }
    return { ran };
  }
}
