import type { Result } from "@/shared/kernel/result";

export type JobAction = "email" | "scrape";

export interface ScheduledJob {
  id: string;
  name: string;
  cron: string;
  action: JobAction;
  /** JSON-encoded action parameters. */
  params: string;
  enabled: boolean;
  createdAt: Date;
}

export type ScheduledJobInput = Pick<
  ScheduledJob,
  "name" | "cron" | "action" | "params" | "enabled"
>;

export interface JobRun {
  id: string;
  jobId: string;
  status: "success" | "error";
  output: string | null;
  startedAt: Date;
}

export interface ScheduledJobRepoPort {
  list(): Promise<ScheduledJob[]>;
  listEnabled(): Promise<ScheduledJob[]>;
  get(id: string): Promise<ScheduledJob | null>;
  create(input: ScheduledJobInput): Promise<ScheduledJob>;
  update(id: string, input: ScheduledJobInput): Promise<ScheduledJob>;
  remove(id: string): Promise<void>;
}

export interface JobRunRepoPort {
  record(entry: {
    jobId: string;
    status: "success" | "error";
    output?: string;
  }): Promise<void>;
  listRecent(limit: number): Promise<(JobRun & { jobName: string })[]>;
}

/**
 * A handler executes one action type. The container wires "email" and "scrape"
 * to the corresponding use-cases, keeping RunJob decoupled from them.
 */
export type JobActionHandler = (params: unknown) => Promise<Result<string>>;
