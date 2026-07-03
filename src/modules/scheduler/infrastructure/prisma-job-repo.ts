import "server-only";
import { db } from "@/shared/db";
import type {
  ScheduledJobRepoPort,
  JobRunRepoPort,
  ScheduledJob,
  ScheduledJobInput,
  JobRun,
  JobAction,
} from "@/modules/scheduler/application/ports";

type Row = {
  id: string;
  name: string;
  cron: string;
  action: string;
  params: string;
  enabled: boolean;
  createdAt: Date;
};

function toDomain(row: Row): ScheduledJob {
  return { ...row, action: row.action as JobAction };
}

export class PrismaJobRepo implements ScheduledJobRepoPort {
  async list(): Promise<ScheduledJob[]> {
    const rows = await db.scheduledJob.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async listEnabled(): Promise<ScheduledJob[]> {
    const rows = await db.scheduledJob.findMany({ where: { enabled: true } });
    return rows.map(toDomain);
  }

  async get(id: string): Promise<ScheduledJob | null> {
    const row = await db.scheduledJob.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(input: ScheduledJobInput): Promise<ScheduledJob> {
    return toDomain(await db.scheduledJob.create({ data: input }));
  }

  async update(id: string, input: ScheduledJobInput): Promise<ScheduledJob> {
    return toDomain(await db.scheduledJob.update({ where: { id }, data: input }));
  }

  async remove(id: string): Promise<void> {
    await db.scheduledJob.delete({ where: { id } });
  }
}

export class PrismaJobRunRepo implements JobRunRepoPort {
  async record(entry: {
    jobId: string;
    status: "success" | "error";
    output?: string;
  }): Promise<void> {
    await db.jobRun.create({
      data: {
        jobId: entry.jobId,
        status: entry.status,
        output: entry.output ?? null,
      },
    });
  }

  async listRecent(
    limit: number,
  ): Promise<(JobRun & { jobName: string })[]> {
    const rows = await db.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { job: { select: { name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      jobId: r.jobId,
      status: r.status as "success" | "error",
      output: r.output,
      startedAt: r.startedAt,
      jobName: r.job.name,
    }));
  }
}
